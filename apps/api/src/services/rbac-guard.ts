import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthUser, BoardRole } from "@kinetix/contracts";
import type { AuthService } from "./auth-service.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
    role?: BoardRole;
  }
}

export async function resolveActorAndRole(
  req: FastifyRequest,
  authService: AuthService
): Promise<{ user: AuthUser; role: BoardRole }> {
  // 1. Inspect direct role override header (X-Kanbanify-Role or X-Kinetix-Role)
  const roleHeader = (
    req.headers["x-kanbanify-role"] || req.headers["x-kinetix-role"]
  ) as string | undefined;

  // 2. Inspect Authorization header
  const authHeader = req.headers.authorization;

  if (roleHeader && roleHeader.trim().length > 0) {
    const rawRole = roleHeader.trim().toUpperCase();
    const role: BoardRole =
      rawRole === "VIEWER" ? "VIEWER" : rawRole === "EDITOR" ? "EDITOR" : "ADMIN";

    // Map role to corresponding demo user profile
    const demoEmail =
      role === "VIEWER"
        ? "elena@kinetix.dev"
        : role === "EDITOR"
        ? "maya@kinetix.dev"
        : "alex@kinetix.dev";

    // If an Authorization token is also provided, try to resolve the actual user
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const user = await authService.resolveUserFromToken(authHeader.slice(7).trim());
      if (user) {
        return { user: { ...user, default_role: role }, role };
      }
    }

    const demoUsers = await authService.getDemoUsers();
    const demo = demoUsers.find((u) => u.email === demoEmail);
    if (demo) {
      return { user: demo, role };
    }

    return {
      user: {
        id: "88888888-8888-4888-8888-888888888881",
        name: "Alex Rivera",
        email: "alex@kinetix.dev",
        avatar_url: null,
        initials: "AR",
        color: "#3b82f6",
        default_role: role,
      },
      role,
    };
  }

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const user = await authService.resolveUserFromToken(token);
    if (user) {
      return { user, role: user.default_role };
    }
  }

  // 3. Backward Compatibility Rule:
  // If neither header is present (or token resolution yielded default), default to primary ADMIN
  const defaultAdmin = await authService.getDefaultAdminUser();
  return { user: defaultAdmin, role: "ADMIN" };
}

export function requireRole(allowedRoles: BoardRole[], authService: AuthService) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    // If authorization header is explicitly present and malformed/invalid, check if we need 401
    const authHeader = req.headers.authorization;
    if (
      authHeader &&
      authHeader.startsWith("Bearer ") &&
      !req.headers["x-kanbanify-role"] &&
      !req.headers["x-kinetix-role"]
    ) {
      const token = authHeader.slice(7).trim();
      const resolved = await authService.resolveUserFromToken(token);
      if (!resolved) {
        return reply.status(401).send({
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired authorization token",
            details: {},
          },
        });
      }
    }

    const { user, role } = await resolveActorAndRole(req, authService);
    req.user = user;
    req.role = role;

    if (!allowedRoles.includes(role)) {
      if (role === "VIEWER") {
        return reply.status(403).send({
          error: {
            code: "FORBIDDEN",
            message:
              "Viewer role has read-only access and cannot modify board content.",
            details: {
              required_role: allowedRoles.includes("EDITOR") ? "EDITOR" : "ADMIN",
              current_role: "VIEWER",
            },
          },
        });
      }

      return reply.status(403).send({
        error: {
          code: "FORBIDDEN",
          message: "Admin role required to perform this action.",
          details: {
            required_role: "ADMIN",
            current_role: role,
          },
        },
      });
    }
  };
}
