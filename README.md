# Auth Mantra

A full-stack authentication and OIDC/SSO service built with:

- Backend: Node.js, Express, TypeScript, PostgreSQL, Drizzle ORM
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Auth: JWT access/refresh tokens
- OIDC: Authorization Code flow, JWKS, token endpoint, userinfo endpoint
- Key management: RSA signing keys and JWKS generation via `key-gen.sh`

## Overview

This project is both:

1. A traditional authentication service for users
2. An OIDC provider so third-party applications can use SSO

It supports:

- User registration and login
- JWT access token + refresh token flow
- Refresh token rotation
- User profile endpoints
- OIDC client registration and management
- OIDC authorization and token exchange
- JWKS publishing for token verification
- Hosted login UI for the OIDC authorization flow

## Project Structure

```text
auth-service/
├── client/
│   └── auth-service-frontend/
│       ├── src/
│       │   ├── backendRoutes/
│       │   ├── components/
│       │   ├── layouts/
│       │   ├── pages/
│       │   ├── routes/
│       │   └── state/
│       └── package.json
├── drizzle/
├── keys/
│   └── oidc/
├── public/
├── src/
│   ├── controllers/
│   ├── db/
│   ├── middlewares/
│   ├── models/
│   ├── routes/
│   ├── types/
│   └── utils/
├── docker-compose.yml
├── drizzle.config.ts
├── key-gen.sh
└── package.json
```

````

## Features

### Backend Auth

- Register a new user
- Login with email or username
- Refresh access token using refresh token
- Logout and revoke refresh token
- Protected profile endpoints

### OIDC / SSO

- OIDC discovery endpoint
- JWKS endpoint
- Authorization endpoint
- Token endpoint
- Userinfo endpoint
- OIDC client creation and listing
- Client detail lookup by client ID

### Frontend

- Login/Register screen
- OIDC login screen
- Client list page
- Client detail page
- Responsive red/black themed UI

---

## Tech Stack

### Backend

- `express`
- `drizzle-orm`
- `pg`
- `jsonwebtoken`
- `bcrypt`
- `node-jose`
- `dotenv`

### Frontend

- `react`
- `react-router-dom`
- `axios`
- `zod`
- `tailwindcss`
- `@fontsource-variable/inter`
- `@fontsource-variable/instrument-sans`

---

## Requirements

- Node.js 20+ recommended
- PostgreSQL 17+ recommended
- npm
- OpenSSL
- PostgreSQL database access

---

## Backend Setup

### 1) Install dependencies

From the repo root:

```bash
npm install
```

### 2) Start PostgreSQL

Using Docker:

```bash
docker compose up -d
```

The provided docker-compose.yml starts PostgreSQL on:

- Host port: `5433`
- Container port: `5432`

Default database settings in the compose file:

- User: `admin`
- Password: `admin`
- Database: `OIDC_AUTH`

### 3) Generate keys for OIDC/JWT

Run the key generation script from the repo root:

```bash
chmod +x ./key-gen.sh
./key-gen.sh
```

This generates:

- private.pem
- public.pem
- kid.txt
- jwks.json

It also copies the JWKS to:

- jwks.json

Important:

- The private key is used for signing tokens
- The public key is exposed through JWKS
- The `kid` must match between the signed JWT header and the JWKS entry

### 4) Configure environment variables

The backend loads env files using:

- .env.development when `NODE_ENV=development`
- .env.production when `NODE_ENV=production`

Create a file like .env.development in the repo root.

### 5) Push schema / migrations

The repo uses Drizzle migrations.

```bash
npm run db:push-schema
```

This runs:

- `drizzle-kit generate`
- `drizzle-kit migrate`

### 6) Run the backend

Development:

```bash
npm run dev
```

Production-style local run:

```bash
npm run build
npm start
```

---

## Backend Environment Variables

The backend currently expects these variables:

- `DATABASE_URL`
- `NODE_ENV`
- `OIDC_PUBLIC_JWKS_PATH`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `OIDC_ISSUER`
- `OIDC_PRIVATE_KEY_PATH`
- `OIDC_KID_PATH`
- `ACCESS_TOKEN_TTL`
- `REFRESH_TOKEN_TTL`
- `FRONTEND_URL`
- `CORS_ORIGIN`
- `PORT`

### Example: .env.development

```env
NODE_ENV=development
PORT=3000

DATABASE_URL=postgres://admin:admin@localhost:5433/OIDC_AUTH

FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

JWT_ACCESS_SECRET=dev-access-secret-change-me
JWT_REFRESH_SECRET=dev-refresh-secret-change-me

ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d

OIDC_ISSUER=http://localhost:3000
OIDC_PRIVATE_KEY_PATH=./keys/oidc/private.pem
OIDC_KID_PATH=./keys/oidc/kid.txt
OIDC_PUBLIC_JWKS_PATH=./keys/oidc/jwks.json
```

### Example: .env.production

```env
NODE_ENV=production
PORT=3000

DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/OIDC_AUTH

FRONTEND_URL=https://your-frontend-domain.com
CORS_ORIGIN=https://your-frontend-domain.com

JWT_ACCESS_SECRET=replace-with-strong-secret
JWT_REFRESH_SECRET=replace-with-strong-secret

ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d

OIDC_ISSUER=https://your-backend-domain.com
OIDC_PRIVATE_KEY_PATH=./keys/oidc/private.pem
OIDC_KID_PATH=./keys/oidc/kid.txt
OIDC_PUBLIC_JWKS_PATH=./keys/oidc/jwks.json
```

### Notes on env values

- `CORS_ORIGIN` is treated as a comma-separated list of allowed origins.
- `OIDC_PUBLIC_JWKS_PATH` is what the JWKS endpoint reads from.
- `OIDC_PRIVATE_KEY_PATH` and `OIDC_KID_PATH` are used by the JWT signer.
- `ACCESS_TOKEN_TTL` and `REFRESH_TOKEN_TTL` control JWT expiry.
- `FRONTEND_URL` is used to redirect users into the hosted login UI.

---

## Frontend Setup

### 1) Install frontend dependencies

```bash
cd client/auth-service-frontend
npm install
```

### 2) Configure frontend env

Create a file like .env.development in auth-service-frontend.

```env
VITE_API_URL=http://localhost:3000
```

### 3) Run the frontend

```bash
npm run dev
```

### 4) Build the frontend

```bash
npm run build
```

---

## Frontend Overview

The frontend is a React app that provides:

- Login/Register screen
- Hosted OIDC login screen
- Client list screen
- Client detail screen
- Protected app layout with sidebar navigation
- Logout button in the top header

### Frontend routes

- `/login`
- `/oauth/login`
- `/`
- `/clients`
- `/client/:id`

### Authentication handling

- After login, the frontend stores the access token in a readable cookie
- The refresh token is set by the backend as an HttpOnly cookie
- Protected routes read the access token from cookies
- Logout clears cookies and resets auth state

---

## Backend API Overview

### Auth routes

Base path: `/api/auth`

#### `POST /api/auth/register`

Creates a new user.

Request body:

```json
{
  "username": "john",
  "email": "john@example.com",
  "password": "StrongPassword123",
  "fullName": "John Doe",
  "phone": "+1234567890"
}
```

Response contains:

- created user
- access token
- refresh token

#### `POST /api/auth/login`

Logs in a user with email or username.

Request body:

```json
{
  "emailOrUsername": "john@example.com",
  "password": "StrongPassword123"
}
```

Response contains:

- user object
- access token
- refresh token

Also sets cookies:

- `accessToken`
- `refreshToken`

#### `POST /api/auth/refresh-token`

Refreshes access token using refresh token.

The refresh token can come from:

- request body
- cookies

#### `POST /api/auth/logout`

Revokes refresh token and clears cookies.

---

### User routes

Base path: `/api/users`

All routes require authentication.

#### `GET /api/users/me`

Returns current user profile.

#### `PATCH /api/users/me`

Updates user profile fields.

#### `POST /api/users/change-password`

Changes the current password and revokes existing refresh tokens.

---

### OIDC routes

Base path: `/oidc`

#### `GET /oidc/authorize`

Validates `client_id` and `redirect_uri`.

Query params:

```text
client_id=...
redirect_uri=...
```

#### `POST /oidc/authorize`

Validates user credentials and issues an auth code.

Request body:

```json
{
  "client_id": "client_123",
  "redirect_uri": "https://app.example.com/callback",
  "emailOrUsername": "john@example.com",
  "password": "StrongPassword123"
}
```

Behavior:

- In development, returns JSON with `code`
- In production, returns a redirect payload for the client app

#### `POST /oidc/token`

Exchanges authorization code for a signed token.

Request body:

```json
{
  "client_id": "client_123",
  "client_secret": "secret-value",
  "code": "auth-code"
}
```

Response contains:

```json
{
  "token_type": "Bearer",
  "access_token": "jwt-here",
  "expires_in": 900
}
```

#### `GET /oidc/userinfo`

Returns user claims for a valid bearer token.

Header:

```http
Authorization: Bearer ACCESS_TOKEN
```

#### `POST /oidc/clients`

Creates a new OIDC client.

Requires authentication.

Request body:

```json
{
  "organisationName": "Acme Inc",
  "redirectUris": "http://localhost:5173/callback, https://app.example.com/callback"
}
```

Response includes:

- `clientName`
- `client_id`
- `client_secret`
- `redirect_uris`
- `created_at`

Important:

- `client_secret` is returned only once at creation time

#### `GET /oidc/clients`

Lists the current user's clients.

Requires authentication.

#### `GET /oidc/clients/:clientId`

Returns one client belonging to the current user.

Requires authentication.

---

## OIDC Discovery and JWKS

### Discovery

- `GET /.well-known/openid-configuration`

### JWKS

- `GET /.well-known/jwks.json`

These endpoints let third-party applications discover:

- issuer
- authorization endpoint
- token endpoint
- userinfo endpoint
- signing keys

---

## OIDC / SSO Flow

This is the typical login flow for a third-party app.

### 1) Register an OIDC client

Create the client in the app’s client dashboard.

### 2) Send the user to the authorization endpoint

Example:

```text
GET /oidc/authorize?client_id=CLIENT_ID&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback
```

### 3) User signs in

The hosted login page handles credentials.

### 4) Receive authorization code

The backend returns a one-time code.

### 5) Exchange code for tokens

Send the code to `/oidc/token`.

### 6) Verify or inspect user identity

Use `/oidc/userinfo` with the bearer token.

### 7) Verify signatures via JWKS

Third-party apps fetch your JWKS and validate tokens using the matching `kid`.

---

## Database Schema

The project uses Drizzle ORM and PostgreSQL.

### `users`

Stores application users.

Important columns:

- `id`
- `username`
- `email`
- `passwordHash`
- `refreshToken`
- `isActive`
- `isLocked`
- `createdAt`
- `updatedAt`

### `oidc_clients`

Stores OIDC clients.

Important columns:

- `clientId`
- `clientSecret`
- `clientName`
- `redirectUris`
- `userId`
- `createdAt`

### `oidc_auth_codes`

Stores one-time authorization codes.

Important columns:

- `code`
- `clientId`
- `redirectUri`
- `userId`
- `scope`
- `expiresAt`
- `consumedAt`

### `oidc_access_tokens`

Stores hashed access tokens.

### `oidc_refresh_tokens`

Stores hashed refresh tokens.

---

## JWT and Key Management

The project signs OIDC tokens using RSA keys.

### Files generated by key-gen.sh

- private.pem
- public.pem
- kid.txt
- jwks.json

### What they do

- `private.pem` signs tokens
- `public.pem` is the public key representation
- `kid.txt` stores the key id used in JWT headers
- `jwks.json` exposes the public key in JWKS format for verification

### Rotation

If you regenerate keys:

- new tokens will be signed with the new private key
- JWKS must be regenerated too
- backend should be restarted so the signing code loads the new key and kid

---

## Scripts

### Root

```bash
npm run dev
```

Runs the backend in development mode.

```bash
npm run prod
```

Runs the backend with `NODE_ENV=production` using `tsx watch`.

```bash
npm run build
```

Compiles TypeScript.

```bash
npm start
```

Runs `node dist/index.js`.

```bash
npm run db:push-schema
```

Generates and applies Drizzle migrations.

### Frontend

Inside auth-service-frontend:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

---

## Local Development Checklist

1. Start PostgreSQL
2. Create backend env file
3. Generate keys with key-gen.sh
4. Run migrations
5. Start backend
6. Configure frontend `VITE_API_URL`
7. Start frontend

---

## Example Local Run

### Backend

```bash
docker compose up -d
./key-gen.sh
npm install
npm run db:push-schema
npm run dev
```

### Frontend

```bash
cd client/auth-service-frontend
npm install
npm run dev
```

---

## Security Notes

- Access token cookie is readable by the frontend for convenience
- Refresh token cookie is HttpOnly
- JWKS must match the signing key
- Client secret is shown only once when the OIDC client is created
- Never commit private keys or secrets
- Use strong production secrets for JWT and OIDC signing

---

## Troubleshooting

### `Cannot access 'ENV' before initialization`

Make sure env helpers read from `process.env` directly instead of referencing the `ENV` object during initialization.

### `dist/index.js` missing

Run `npm run build` first.

### OIDC login redirect errors

Check:

- `client_id`
- `redirect_uri`
- registered redirect URIs
- CORS origin
- issuer URL
- JWKS path

### 401 after 15 minutes

The access token TTL is short by design. Use the refresh token endpoint to obtain a new access token.

---
````
