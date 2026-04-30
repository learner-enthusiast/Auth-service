import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { oidc } from "@/backendRoutes";

type ApiResponse<T> = {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
};

type OidcClient = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  createdAt: string;
};

type CreatedClientState = {
  created?: {
    clientId: string;
    clientName: string;
    redirectUris: string[];
    createdAt: string;
    clientSecret: string;
  };
};

export function Client() {
  const { id } = useParams();
  const location = useLocation();

  const createdState = (location.state ?? null) as CreatedClientState | null;

  const created = useMemo(() => {
    if (!createdState?.created) return null;
    if (!id) return null;
    return createdState.created.clientId === id ? createdState.created : null;
  }, [createdState, id]);

  const [client, setClient] = useState<OidcClient | null>(() => {
    if (!created) return null;
    return {
      clientId: created.clientId,
      clientName: created.clientName,
      redirectUris: created.redirectUris,
      createdAt: created.createdAt,
    };
  });

  const [clientSecret] = useState<string | null>(
    () => created?.clientSecret ?? null,
  );
  const [loading, setLoading] = useState(!created);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) return;

      // If we just created the client, we already have the details + secret.
      // Secret is shown only once, so skip the initial fetch.
      if (created) return;

      try {
        setLoading(true);
        setError(null);

        const res = await oidc.getAClient(id);
        const body = res.data as ApiResponse<{ client: OidcClient }>;

        if (!cancelled) {
          setClient(body.data.client);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load client";
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, created]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-red-500">Client</h1>
        <p className="text-zinc-400">Client details and redirect URIs.</p>
      </div>

      <Card className="rounded-2xl border border-red-900/60 bg-zinc-950/80 shadow-2xl shadow-red-950/20 text-white">
        <CardHeader>
          <CardTitle className="text-xl text-red-400">
            {client?.clientName ?? (loading ? "Loading..." : "Client")}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {client?.clientId ?? id}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {error && <div className="text-red-400">{error}</div>}

          {clientSecret && (
            <div className="rounded-xl border border-red-900/40 bg-black/40 p-4">
              <div className="text-sm font-semibold text-red-300">
                Client secret (shown only once)
              </div>
              <div className="mt-2 font-mono text-sm break-all text-white">
                {clientSecret}
              </div>
            </div>
          )}

          {loading && !client ? (
            <div className="text-zinc-400">Loading client...</div>
          ) : client ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-900/30 bg-black/40 p-4">
                <div className="text-sm text-zinc-400">Created</div>
                <div className="text-white">
                  {new Date(client.createdAt).toLocaleString()}
                </div>
              </div>

              <div className="rounded-xl border border-red-900/30 bg-black/40 p-4">
                <div className="text-sm text-zinc-400">Redirect URIs</div>
                <div className="mt-2 flex flex-col gap-2">
                  {client.redirectUris.map((uri) => (
                    <div
                      key={uri}
                      className="rounded-lg border border-red-900/20 bg-black/30 px-3 py-2 font-mono text-xs text-zinc-200 break-all"
                    >
                      {uri}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-zinc-400">No client loaded.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
