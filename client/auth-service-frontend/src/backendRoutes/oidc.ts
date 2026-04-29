import { api } from "./axios";

export type CreateOidcClientInput = {
  organisationName: string;
  // Comma-separated redirect URIs (matches backend controller)
  redirectUris: string;
  isConfidential?: boolean;
};

export async function createOidcClient(input: CreateOidcClientInput) {
  // POST http://localhost:3000/oidc/clients
  // Note: this route is protected in backend (requireAuth)
  const res = await api.post("/oidc/clients", input);
  return res.data as unknown;
}

export type AuthorizeGetQuery = {
  client_id: string;
  redirect_uri: string;
};

export async function authorizeGet(query: AuthorizeGetQuery) {
  // GET http://localhost:3000/oidc/authorize
  const res = await api.get<string>("/oidc/authorize", {
    params: query,
    // original implementation served HTML; keep it flexible
    responseType: "text",
  });
  return res.data;
}

export type AuthorizePostBody = {
  client_id: string;
  redirect_uri: string;
  emailOrUsername: string;
  password: string;
};

export async function authorizePost(body: AuthorizePostBody) {
  // POST http://localhost:3000/oidc/authorize
  // This endpoint typically redirects; axios will follow redirects within same origin.
  const res = await api.post("/oidc/authorize", body, {
    maxRedirects: 0,
    validateStatus: (status) => status >= 200 && status < 400,
  });
  return res;
}
