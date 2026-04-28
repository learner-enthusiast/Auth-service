CREATE TABLE "oidc_access_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"client_id" varchar(128) NOT NULL,
	"user_id" integer NOT NULL,
	"scope" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oidc_access_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "oidc_auth_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"client_id" varchar(128) NOT NULL,
	"redirect_uri" text NOT NULL,
	"user_id" integer NOT NULL,
	"scope" text NOT NULL,
	"nonce" text,
	"code_challenge" text NOT NULL,
	"code_challenge_method" varchar(16) DEFAULT 'S256' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oidc_auth_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "oidc_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" varchar(128) NOT NULL,
	"client_secret" text,
	"redirect_uris" text NOT NULL,
	"is_confidential" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oidc_clients_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "oidc_refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"client_id" varchar(128) NOT NULL,
	"user_id" integer NOT NULL,
	"scope" text NOT NULL,
	"replaced_by_token_hash" text,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oidc_refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
