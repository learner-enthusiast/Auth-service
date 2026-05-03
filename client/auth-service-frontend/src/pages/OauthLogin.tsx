import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import * as oidcApi from "@/backendRoutes/oidc";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ENV } from "@/lib/utils";

type FieldErrors = Partial<Record<"emailOrUsername" | "password", string>>;

function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if ((key === "emailOrUsername" || key === "password") && !out[key]) {
      out[key] = issue.message;
    }
  }
  return out;
}

function redirectWithCode(redirectUri: string, code: string) {
  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  window.location.href = url.toString();
}

export default function OauthLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clientId = searchParams.get("client_id") ?? "";
  // support both names since you asked for redirect_url
  const redirectUri =
    searchParams.get("redirect_url") ?? searchParams.get("redirect_uri") ?? "";

  const [loadingClient, setLoadingClient] = useState(true);
  const [clientName, setClientName] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    emailOrUsername: "",
    password: "",
  });

  const schema = useMemo(
    () =>
      z.object({
        emailOrUsername: z
          .string()
          .trim()
          .min(1, "Email or username is required"),
        password: z.string().min(1, "Password is required"),
      }),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadClient() {
      try {
        setLoadingClient(true);
        setPageError(null);
        setClientName(null);

        if (!clientId || !redirectUri) {
          throw new Error("Missing client_id or redirect_url in URL");
        }

        const raw = await oidcApi.authorizeGet({
          client_id: clientId,
          redirect_uri: redirectUri,
        });
        const parsed = JSON.parse(raw) as { data?: { clientName?: string } };
        setClientName(parsed.data?.clientName ?? null);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to validate client";
        setPageError(message);
      } finally {
        if (!cancelled) setLoadingClient(false);
      }
    }

    loadClient();
    return () => {
      cancelled = true;
    };
  }, [clientId, redirectUri]);

  function updateField(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    setFormError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);
      setFieldErrors({});
      setFormError(null);

      const parsed = schema.safeParse(form);
      if (!parsed.success) {
        setFieldErrors(zodFieldErrors(parsed.error));
        return;
      }

      const res = await oidcApi.authorizePost({
        client_id: clientId,
        redirect_uri: redirectUri,
        emailOrUsername: parsed.data.emailOrUsername,
        password: parsed.data.password,
      });

      // production: backend may send redirect
      const location = res?.data?.data.redirectUri as string | undefined;
      if (ENV.ENVIRONMENT === "production") {
        console.log(res);
        console.log(res?.data?.data.redirectUri);
        if (location) {
          window.location.href = location;
          return;
        }
      } else {
        // dev: backend returns { code }
        const code = (res.data as { code?: string } | undefined)?.code;
        if (code) {
          redirectWithCode(redirectUri, code);
          return;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setFormError(message);
    } finally {
      setLoading(false);
    }
  }

  // Error screen (don’t render the form)
  if (!loadingClient && pageError) {
    return (
      <div className="min-h-screen bg-linear-to-br from-black via-zinc-950 to-red-950 text-white flex items-center justify-center px-4">
        <Card className="w-full max-w-md rounded-2xl border border-red-900/60 bg-zinc-950 shadow-2xl shadow-red-950/40">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-red-500">
              Authorization Error
            </CardTitle>
            <CardDescription className="text-zinc-400 mt-2">
              {pageError}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-black via-zinc-950 to-red-950 text-white flex items-center justify-center px-4">
      <Card className="w-full max-w-md rounded-2xl border border-red-900/60 bg-zinc-950 shadow-2xl shadow-red-950/40">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl font-bold text-red-500">
            {loadingClient ? "Checking client..." : "Sign in"}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {clientName
              ? `Continue to ${clientName}`
              : "Enter your credentials to continue"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-red-300">Email or Username</Label>
              <Input
                name="emailOrUsername"
                value={form.emailOrUsername}
                onChange={updateField}
                placeholder="you@example.com"
                className="bg-black border-red-900 text-white placeholder:text-zinc-500 focus:border-red-500"
                disabled={loadingClient || !!pageError}
              />
              {fieldErrors.emailOrUsername && (
                <p className="text-sm text-red-400">
                  {fieldErrors.emailOrUsername}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-red-300">Password</Label>
              <Input
                type="password"
                name="password"
                value={form.password}
                onChange={updateField}
                placeholder="••••••••"
                className="bg-black border-red-900 text-white placeholder:text-zinc-500 focus:border-red-500"
                disabled={loadingClient || !!pageError}
              />
              {fieldErrors.password && (
                <p className="text-sm text-red-400">{fieldErrors.password}</p>
              )}
            </div>

            {formError && (
              <p className="text-sm text-red-400" role="alert">
                {formError}
              </p>
            )}

            <Button
              className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold"
              disabled={loading || loadingClient || !!pageError}
            >
              {loading ? "Please wait..." : "Sign In"}
            </Button>
          </form>
          <Button
            onClick={() => navigate("/login")}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold text-center mt-4"
          >
            Dont have an account ? Create one...
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
