import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { oidc } from "@/backendRoutes";

type ApiResponse<T> = {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
};

type OidcClientListItem = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  createdAt: string;
};

type CreatedClient = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  createdAt: string;
  clientSecret: string;
};

function parseRedirectUrisRaw(raw: string): string[] {
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function CreateClientModal(props: {
  onClose: () => void;
  onCreated: (created: CreatedClient) => void;
}) {
  const { onClose, onCreated } = props;

  const schema = useMemo(
    () =>
      z.object({
        organisationName: z
          .string()
          .trim()
          .min(1, "Organisation name is required"),
        redirectUris: z
          .string()
          .trim()
          .min(1, "Redirect URIs are required")
          .refine((raw) => parseRedirectUrisRaw(raw).length > 0, {
            message: "Provide at least one redirect URI",
          })
          .refine((raw) => {
            const uris = parseRedirectUrisRaw(raw);
            for (const uri of uris) {
              try {
                new URL(uri);
              } catch {
                return false;
              }
            }
            return true;
          }, "All redirect URIs must be valid URLs"),
      }),
    [],
  );

  const [organisationName, setOrganisationName] = useState("");
  const [redirectUris, setRedirectUris] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();

    const parsed = schema.safeParse({ organisationName, redirectUris });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      const res = await oidc.createClient({
        organisationName: parsed.data.organisationName,
        redirectUris: parsed.data.redirectUris,
      });

      const body = res.data as ApiResponse<{
        clientName: string;
        client_id: string;
        client_secret: string;
        redirect_uris: string[];
        created_at: string;
      }>;

      const created: CreatedClient = {
        clientId: body.data.client_id,
        clientName: body.data.clientName,
        redirectUris: body.data.redirect_uris,
        createdAt: body.data.created_at,
        clientSecret: body.data.client_secret,
      };

      onCreated(created);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create client";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg rounded-2xl border border-red-900/60 bg-zinc-950 shadow-2xl shadow-red-950/40 text-white">
          <CardHeader className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-bold text-red-500">
                  Create Client
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Enter organisation name and comma-separated redirect URIs.
                </CardDescription>
              </div>

              <Button
                type="button"
                variant="ghost"
                className="text-zinc-400 hover:text-red-300"
                onClick={() => {
                  if (!submitting) onClose();
                }}
              >
                Close
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-red-300">Organisation Name</Label>
                <Input
                  value={organisationName}
                  onChange={(e) => setOrganisationName(e.target.value)}
                  placeholder="My Company"
                  className="bg-black border-red-900 text-white placeholder:text-zinc-500 focus:border-red-500"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-red-300">Redirect URIs</Label>
                <Input
                  value={redirectUris}
                  onChange={(e) => setRedirectUris(e.target.value)}
                  placeholder="http://localhost:5173/callback, https://example.com/callback"
                  className="bg-black border-red-900 text-white placeholder:text-zinc-500 focus:border-red-500"
                  disabled={submitting}
                />
                <p className="text-xs text-zinc-500">
                  Comma-separated, must be valid URLs.
                </p>
              </div>

              {formError && (
                <p className="text-sm text-red-400" role="alert">
                  {formError}
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="bg-red-600 hover:bg-red-500 text-white font-semibold"
                  disabled={submitting}
                >
                  {submitting ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function Clients() {
  const navigate = useNavigate();

  const [clients, setClients] = useState<OidcClientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await oidc.getClients();
        const body = res.data as ApiResponse<{ clients: OidcClientListItem[] }>;

        if (!cancelled) {
          setClients(body.data.clients ?? []);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load clients";
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-red-500">Clients</h1>
          <p className="text-zinc-400">Manage OIDC clients you created.</p>
        </div>

        <Button
          className="bg-red-600 hover:bg-red-500 text-white font-semibold"
          onClick={() => setOpenCreate(true)}
        >
          Create Client
        </Button>
      </div>

      <Card className="rounded-2xl border border-red-900/60 bg-zinc-950/80 shadow-2xl shadow-red-950/20 text-white">
        <CardHeader>
          <CardTitle className="text-xl text-red-400">Your clients</CardTitle>
          <CardDescription className="text-zinc-400">
            Click a client to view details.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-zinc-400">Loading...</div>
          ) : error ? (
            <div className="text-red-400">{error}</div>
          ) : clients.length === 0 ? (
            <div className="text-zinc-400">No clients yet.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {clients.map((c) => (
                <button
                  key={c.clientId}
                  type="button"
                  className="w-full text-left rounded-xl border border-red-900/30 bg-black/40 hover:bg-red-900/20 transition-colors px-4 py-3"
                  onClick={() => navigate(`/client/${c.clientId}`)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-white">
                        {c.clientName}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {c.clientId}
                      </div>
                      <div className="text-sm text-zinc-300 mt-2">
                        Redirect URIs: {c.redirectUris.length}
                      </div>
                    </div>

                    <div className="text-xs text-zinc-500">
                      {new Date(c.createdAt).toLocaleString()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {openCreate && (
        <CreateClientModal
          onClose={() => setOpenCreate(false)}
          onCreated={(created) => {
            setOpenCreate(false);
            navigate(`/client/${created.clientId}`, {
              state: {
                created,
              },
            });
          }}
        />
      )}
    </div>
  );
}
