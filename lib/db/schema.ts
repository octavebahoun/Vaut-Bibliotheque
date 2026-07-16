import {
  pgTable,
  uuid,
  text,
  bigint,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

// ── Utilisateurs ──────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("member"), // 'admin' | 'member'
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Invitations (inscription sur invitation) ──────────────────
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    email: text("email"), // si défini, restreint l'invitation à cet e-mail
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    usedBy: uuid("used_by").references(() => users.id, {
      onDelete: "set null",
    }),
    usedAt: timestamp("used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("invites_code_idx").on(t.code)],
);

// ── Sessions (cookie HTTP-only) ───────────────────────────────
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // token de session (opaque)
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

// ── Config Cloudinary par utilisateur (BYO credentials) ───────
export const cloudinaryConfigs = pgTable("cloudinary_configs", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  cloudName: text("cloud_name").notNull(),
  apiKey: text("api_key").notNull(),
  apiSecretEncrypted: text("api_secret_encrypted").notNull(),
  folder: text("folder").notNull().default("vault"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Images ────────────────────────────────────────────────────
export const images = pgTable(
  "images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    publicId: text("public_id").notNull(), // Cloudinary public_id
    url: text("url").notNull(), // secure_url
    name: text("name").notNull(),
    size: bigint("size", { mode: "number" }).notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    format: text("format"),
    shareToken: text("share_token").unique(), // null = non partagée
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("images_user_id_idx").on(t.userId),
    index("images_share_token_idx").on(t.shareToken),
  ],
);

// ── Projets (regroupent des secrets .env) ─────────────────────
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("projects_user_id_idx").on(t.userId)],
);

// ── Secrets (.env) — valeur chiffrée au repos (AES-256-GCM) ────
export const secrets = pgTable(
  "secrets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    valueEncrypted: text("value_encrypted").notNull(), // iv:authTag:ciphertext (base64)
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("secrets_project_id_idx").on(t.projectId)],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type CloudinaryConfig = typeof cloudinaryConfigs.$inferSelect;
export type Image = typeof images.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Secret = typeof secrets.$inferSelect;
