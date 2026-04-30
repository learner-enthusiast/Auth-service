import { api } from "./axios";

export type CreateOidcClientInput = {
  organisationName: string;
  // Comma-separated redirect URIs (matches backend controller)
  redirectUris: string;
  isConfidential?: boolean;
};

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

export async function getClients() {
  // This endpoint gets all the client created by user
  const res = await api.get("/oidc/clients");
  return res;
}

export type CreateClientBody = {
  organisationName: string;
  // Comma-separated redirect URIs
  redirectUris: string;
};

export async function createClient(body: CreateClientBody) {
  const res = await api.post("/oidc/clients", body);
  return res;
}

// Backwards-compatible alias
export async function createOidcClient(input: CreateOidcClientInput) {
  const res = await api.post("/oidc/clients", {
    organisationName: input.organisationName,
    redirectUris: input.redirectUris,
  });
  return res.data as unknown;
}

export async function getAClient(clientId: string) {
  const res = await api.get(`/oidc/clients/${clientId}`);
  return res;
}
