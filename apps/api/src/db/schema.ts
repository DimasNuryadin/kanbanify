import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import type {
  Activity,
  Attachment,
  BoardBackground,
  CardCover,
  Checklist,
  Comment,
  Label,
  Member,
  Subtask,
} from "@kinetix/contracts";

export const priorityEnum = pgEnum("priority", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const boards = pgTable("boards", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspace_id: uuid("workspace_id").notNull(),
  title: varchar("title", { length: 150 }).notNull(),
  description: text("description").default("").notNull(),
  is_starred: boolean("is_starred").default(false).notNull(),
  background: jsonb("background")
    .$type<BoardBackground>()
    .default({
      type: "gradient",
      value: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)",
    })
    .notNull(),
  labels: jsonb("labels").$type<Label[]>().default([]).notNull(),
  members: jsonb("members").$type<Member[]>().default([]).notNull(),
  activities: jsonb("activities").$type<Activity[]>().default([]).notNull(),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const columns = pgTable("columns", {
  id: uuid("id").defaultRandom().primaryKey(),
  board_id: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 100 }).notNull(),
  position: varchar("position", { length: 64 }).notNull(),
  wip_limit: integer("wip_limit"),
  color: varchar("color", { length: 64 }),
  is_archived: boolean("is_archived").default(false).notNull(),
});

export const cards = pgTable("cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  board_id: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  column_id: uuid("column_id")
    .notNull()
    .references(() => columns.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").default("").notNull(),
  position: varchar("position", { length: 64 }).notNull(),
  priority: priorityEnum("priority").default("MEDIUM").notNull(),
  story_points: integer("story_points"),
  tags: jsonb("tags").$type<string[]>().default([]).notNull(),
  subtasks: jsonb("subtasks").$type<Subtask[]>().default([]).notNull(),
  blocked_by_card_ids: jsonb("blocked_by_card_ids")
    .$type<string[]>()
    .default([])
    .notNull(),
  due_date: timestamp("due_date", { withTimezone: true, mode: "string" }),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  // Phase 2 Trello Parity Fields
  cover: jsonb("cover")
    .$type<CardCover>()
    .default({ type: "none", value: null, size: "normal" })
    .notNull(),
  label_ids: jsonb("label_ids").$type<string[]>().default([]).notNull(),
  member_ids: jsonb("member_ids").$type<string[]>().default([]).notNull(),
  checklists: jsonb("checklists").$type<Checklist[]>().default([]).notNull(),
  comments: jsonb("comments").$type<Comment[]>().default([]).notNull(),
  attachments: jsonb("attachments").$type<Attachment[]>().default([]).notNull(),
  start_date: timestamp("start_date", { withTimezone: true, mode: "string" }),
  is_due_complete: boolean("is_due_complete").default(false).notNull(),
  is_archived: boolean("is_archived").default(false).notNull(),
  is_watching: boolean("is_watching").default(false).notNull(),
});

export const subtasks = pgTable("subtasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  card_id: uuid("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 280 }).notNull(),
  is_completed: boolean("is_completed").default(false).notNull(),
  position: varchar("position", { length: 64 }).notNull(),
});
