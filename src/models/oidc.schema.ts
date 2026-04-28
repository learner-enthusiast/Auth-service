import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// Minimal OIDC Provider storage.
// - Clients are configured via env (not stored in DB in this MVP).

export const oidcAuthCodes = pgTable("oidc_auth_codes", {
  id: serial("id").primaryKey(),

  code: text("code").notNull().unique(),

  clientId: varchar("client_id", { length: 128 }).notNull(),
  redirectUri: text("redirect_uri").notNull(),

  userId: integer("user_id").notNull(),

  scope: text("scope").notNull(),
  nonce: text("nonce"),

  codeChallenge: text("code_challenge").notNull(),
  codeChallengeMethod: varchar("code_challenge_method", { length: 16 })
    .notNull()
    .default("S256"),

  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const oidcAccessTokens = pgTable("oidc_access_tokens", {
  id: serial("id").primaryKey(),

  tokenHash: text("token_hash").notNull().unique(),

  clientId: varchar("client_id", { length: 128 }).notNull(),
  userId: integer("user_id").notNull(),

  scope: text("scope").notNull(),

  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const oidcRefreshTokens = pgTable("oidc_refresh_tokens", {
  id: serial("id").primaryKey(),

  tokenHash: text("token_hash").notNull().unique(),

  clientId: varchar("client_id", { length: 128 }).notNull(),
  userId: integer("user_id").notNull(),

  scope: text("scope").notNull(),

  // for rotation support (optional)
  replacedByTokenHash: text("replaced_by_token_hash"),

  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const oidcClients = pgTable("oidc_clients", {
  // Optional: keep a DB-backed client registry if you want later.
  id: serial("id").primaryKey(),
  clientId: varchar("client_id", { length: 128 }).notNull().unique(),
  clientSecret: text("client_secret"),
  // store as comma-separated list for MVP
  redirectUris: text("redirect_uris").notNull(),
  isConfidential: boolean("is_confidential").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
