import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import {
  AuthSessionResponseSchema,
  AuthUserSchema,
  type AuthSessionResponse,
  type AuthUser,
  type BoardRole,
  type LoginRequest,
  type RegisterRequest,
} from "@kinetix/contracts";
import { AppError } from "../errors.js";
import type { StorageRepository, UserRecord } from "../db/repository.js";

const DEFAULT_JWT_SECRET = "super_secret_dev_key_change_in_prod";
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface JWTPayload {
  sub: string;
  email: string;
  name: string;
  role: BoardRole;
  exp: number;
  iat: number;
}

export class AuthService {
  private readonly secret: string;

  constructor(private readonly repository: StorageRepository) {
    this.secret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
  }

  // ==========================================================================
  // CRYPTO & TOKEN SIGNING / VERIFICATION
  // ==========================================================================

  public hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const derived = scryptSync(password, salt, 32).toString("hex");
    return `${salt}:${derived}`;
  }

  public verifyPassword(password: string, storedHash: string): boolean {
    const [salt, expectedHash] = storedHash.split(":");
    if (!salt || !expectedHash) return false;
    const derived = scryptSync(password, salt, 32).toString("hex");
    return (
      derived.length === expectedHash.length &&
      timingSafeEqual(Buffer.from(derived), Buffer.from(expectedHash))
    );
  }

  public signToken(user: {
    id: string;
    email: string;
    name: string;
    role: BoardRole;
  }): { token: string; expires_at: string } {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + TOKEN_TTL_SECONDS;
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      exp,
      iat: now,
    };

    const header = { alg: "HS256", typ: "JWT" };
    const b64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
    const b64Payload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const dataToSign = `${b64Header}.${b64Payload}`;
    const signature = createHmac("sha256", this.secret)
      .update(dataToSign)
      .digest("base64url");

    return {
      token: `${dataToSign}.${signature}`,
      expires_at: new Date(exp * 1000).toISOString(),
    };
  }

  public verifyToken(token: string): JWTPayload | null {
    const cleanToken = token.startsWith("Bearer ") ? token.slice(7).trim() : token.trim();
    const parts = cleanToken.split(".");
    if (parts.length !== 3) return null;

    const [b64Header, b64Payload, signature] = parts;
    if (!b64Header || !b64Payload || !signature) return null;

    const expectedSig = createHmac("sha256", this.secret)
      .update(`${b64Header}.${b64Payload}`)
      .digest("base64url");

    if (
      signature.length !== expectedSig.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
    ) {
      return null;
    }

    try {
      const payload = JSON.parse(
        Buffer.from(b64Payload, "base64url").toString("utf8")
      ) as JWTPayload;

      if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // AUTH FLOWS
  // ==========================================================================

  public async getDemoUsers(): Promise<(AuthUser & { token: string })[]> {
    const rawDemoUsers = await this.repository.getDemoUsers();
    // Return the 3 primary demo accounts (ADMIN, EDITOR, VIEWER) as specified in contract
    const demoEmails = ["alex@kinetix.dev", "maya@kinetix.dev", "elena@kinetix.dev"];
    const filtered = demoEmails
      .map((email) => rawDemoUsers.find((u) => u.email.toLowerCase() === email))
      .filter((u): u is NonNullable<typeof u> => Boolean(u));

    return filtered.map((u) => {
      const { token } = this.signToken({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.default_role,
      });

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        avatar_url: u.avatar_url,
        initials: u.initials,
        color: u.color,
        default_role: u.default_role,
        token,
      };
    });
  }

  public async register(req: RegisterRequest): Promise<AuthSessionResponse> {
    const emailNormalized = req.email.toLowerCase().trim();
    const existing = await this.repository.getUserByEmail(emailNormalized);
    if (existing) {
      throw new AppError(400, "VALIDATION_ERROR", "Email already in use", {
        email: req.email,
      });
    }

    const nameParts = req.name.trim().split(/\s+/);
    const initials =
      nameParts.length > 1
        ? `${nameParts[0]![0]}${nameParts[nameParts.length - 1]![0]}`.toUpperCase()
        : req.name.slice(0, 2).toUpperCase();

    const userRecord: UserRecord = {
      id: randomUUID(),
      name: req.name.trim(),
      email: emailNormalized,
      password_hash: this.hashPassword(req.password),
      avatar_url: null,
      initials,
      color: "#3b82f6",
      default_role: "EDITOR",
      created_at: new Date().toISOString(),
    };

    await this.repository.createUser(userRecord);

    const { token, expires_at } = this.signToken({
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      role: userRecord.default_role,
    });

    const user: AuthUser = {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      avatar_url: userRecord.avatar_url,
      initials: userRecord.initials,
      color: userRecord.color,
      default_role: userRecord.default_role,
    };

    return AuthSessionResponseSchema.parse({
      token,
      user,
      expires_at,
    });
  }

  public async login(req: LoginRequest): Promise<AuthSessionResponse> {
    const emailNormalized = req.email.toLowerCase().trim();
    const user = await this.repository.getUserByEmail(emailNormalized);
    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid email or password", {
        email: req.email,
      });
    }

    // Demo users without password hash allow instant 1-click login
    if (user.password_hash !== null) {
      if (!this.verifyPassword(req.password, user.password_hash)) {
        throw new AppError(401, "UNAUTHORIZED", "Invalid email or password", {
          email: req.email,
        });
      }
    }

    const { token, expires_at } = this.signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.default_role,
    });

    const authUser: AuthUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      initials: user.initials,
      color: user.color,
      default_role: user.default_role,
    };

    return AuthSessionResponseSchema.parse({
      token,
      user: authUser,
      expires_at,
    });
  }

  public async resolveUserFromToken(token: string): Promise<AuthUser | null> {
    // 1. Direct demo token aliases support
    if (token.includes("alex") || token.includes("admin")) {
      const u = await this.repository.getUserByEmail("alex@kinetix.dev");
      if (u) return this.toAuthUser(u);
    }
    if (token.includes("maya") || token.includes("editor")) {
      const u = await this.repository.getUserByEmail("maya@kinetix.dev");
      if (u) return this.toAuthUser(u);
    }
    if (token.includes("elena") || token.includes("viewer")) {
      const u = await this.repository.getUserByEmail("elena@kinetix.dev");
      if (u) return this.toAuthUser(u);
    }

    // 2. JWT verification
    const payload = this.verifyToken(token);
    if (!payload) return null;

    const user = await this.repository.getUserById(payload.sub);
    if (user) {
      return this.toAuthUser(user);
    }

    // If user not in DB anymore, use JWT claims
    return {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      avatar_url: null,
      initials: payload.name.slice(0, 2).toUpperCase(),
      color: "#3b82f6",
      default_role: payload.role,
    };
  }

  public async getDefaultAdminUser(): Promise<AuthUser> {
    const admin = await this.repository.getUserByEmail("alex@kinetix.dev");
    if (admin) return this.toAuthUser(admin);
    return {
      id: "88888888-8888-4888-8888-888888888881",
      name: "Alex Rivera",
      email: "alex@kinetix.dev",
      avatar_url: null,
      initials: "AR",
      color: "#3b82f6",
      default_role: "ADMIN",
    };
  }

  private toAuthUser(u: UserRecord): AuthUser {
    return AuthUserSchema.parse({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar_url: u.avatar_url,
      initials: u.initials,
      color: u.color,
      default_role: u.default_role,
    });
  }
}
