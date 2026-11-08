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
import type { Subtask } from "@kinetix/contracts";

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
