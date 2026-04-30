import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Label } from "@/components/ui/label";

import * as authApi from "@/backendRoutes/auth";
import { useAuth } from "@/state/auth/AuthContext";
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "@/state/auth/cookies";

type FieldErrors = Partial<Record<"username" | "email" | "password", string>>;

function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (key === "username" || key === "email" || key === "password") {
      if (!out[key]) out[key] = issue.message;
    }
  }
  return out;
}

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { refreshFromCookies } = useAuth();

  const redirectTo: string =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? "/";

  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.string().trim().min(1, "Email or username is required"),
        password: z.string().min(1, "Password is required"),
      }),
    [],
  );

  const registerSchema = useMemo(
    () =>
      z.object({
        username: z
          .string()
          .trim()
          .min(3, "Username must be at least 3 characters"),
        email: z.string().trim().email("Invalid email"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    [],
  );

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  function updateField(e: ChangeEvent<HTMLInputElement>) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
    setFieldErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
    setFormError(null);
    setNotice(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);
      setFieldErrors({});
      setFormError(null);
      setNotice(null);

      if (isLogin) {
        const parsed = loginSchema.safeParse({
          email: form.email,
          password: form.password,
        });
        if (!parsed.success) {
          setFieldErrors(zodFieldErrors(parsed.error));
          return;
        }

        const tokens = await authApi.login({
          emailOrUsername: parsed.data.email,
          password: parsed.data.password,
        });
        setAccessTokenCookie(tokens.accessToken);
        setRefreshTokenCookie(tokens.refreshToken);
        refreshFromCookies();
        navigate(redirectTo, { replace: true });
      } else {
        const parsed = registerSchema.safeParse(form);
        if (!parsed.success) {
          setFieldErrors(zodFieldErrors(parsed.error));
          return;
        }

        await authApi.register(parsed.data);
        setIsLogin(true);
        setNotice("Account created. Please sign in.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setFormError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-black via-zinc-950 to-red-950 text-white flex items-center justify-center px-4">
      <Card className="w-full max-w-md rounded-2xl border border-red-900/60 bg-zinc-950 shadow-2xl shadow-red-950/40">
        <CardHeader className="space-y-6">
          <div className="flex rounded-xl bg-zinc-900 p-1 border border-red-900/40">
            <button
              onClick={() => {
                setFieldErrors({});
                setIsLogin(true);
              }}
              className={`flex-1 rounded-lg py-2.5 font-medium transition
          ${
            isLogin
              ? "bg-red-600 text-white shadow-lg"
              : "text-zinc-400 hover:text-red-300"
          }`}
            >
              Login
            </button>

            <button
              onClick={() => {
                setIsLogin(false);
                setFieldErrors({});
              }}
              className={`flex-1 rounded-lg py-2.5 font-medium transition
          ${
            !isLogin
              ? "bg-red-600 text-white shadow-lg"
              : "text-zinc-400 hover:text-red-300"
          }`}
            >
              Register
            </button>
          </div>

          <div>
            <CardTitle className="text-3xl font-bold text-red-500">
              {isLogin ? "Welcome Back" : "Create Account"}
            </CardTitle>

            <CardDescription className="text-zinc-400 mt-2">
              {isLogin ? "Sign in to continue" : "Register a new account"}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <Label className="text-red-300">Username</Label>

                <Input
                  name="username"
                  value={form.username}
                  onChange={updateField}
                  placeholder="moumita"
                  className="bg-black border-red-900 text-white placeholder:text-zinc-500 focus:border-red-500"
                />

                {fieldErrors.username && (
                  <p className="text-sm text-red-400">{fieldErrors.username}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-red-300">
                {!isLogin ? "Email" : "Email or Username"}
              </Label>

              <Input
                name="email"
                value={form.email}
                onChange={updateField}
                placeholder="you@example.com"
                className="bg-black border-red-900 text-white placeholder:text-zinc-500 focus:border-red-500"
              />

              {fieldErrors.email && (
                <p className="text-sm text-red-400">{fieldErrors.email}</p>
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

            {notice && <p className="text-sm text-zinc-400">{notice}</p>}

            <Button
              className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : isLogin
                  ? "Sign In"
                  : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-sm text-zinc-500 mt-6">
            {isLogin ? "Need an account?" : "Already have one?"}

            <button
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 text-red-400 hover:text-red-300 font-medium"
            >
              {isLogin ? "Register" : "Login"}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
