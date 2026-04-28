import {
  pgTable,
  serial,
  text,
  varchar,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  // Primary key
  id: serial("id").primaryKey(),

  // Identity
  username: varchar("username", { length: 50 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  fullName: text("full_name"),

  // Auth
  passwordHash: text("password_hash").notNull(),

  // Optional phone
  phone: varchar("phone", { length: 20 }),

  // Verification flags
  emailVerified: boolean("email_verified").default(false),
  phoneVerified: boolean("phone_verified").default(false),

  // OIDC useful fields
  picture: text("picture"),
  refreshToken: text("refresh_token"), // simple starter approach

  // Account state
  isActive: boolean("is_active").default(true),
  isLocked: boolean("is_locked").default(false),

  // Audit
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
});
