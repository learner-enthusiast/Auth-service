import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function CodeBlock(props: { children: string }) {
  return (
    <pre className="mt-2 rounded-xl border border-red-900/40 bg-black/50 p-4 overflow-x-auto text-xs text-zinc-100">
      <code className="whitespace-pre">{props.children}</code>
    </pre>
  );
}

function InlineCode(props: { children: string }) {
  return (
    <span className="rounded-md border border-red-900/40 bg-black/40 px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-100">
      {props.children}
    </span>
  );
}

export function Docs() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-red-500">Documentation</h1>
        <p className="text-zinc-400">
          Auth Service provides user login plus an OIDC (SSO) provider that
          supports the Authorization Code flow.
        </p>
      </div>

      <Card className="rounded-2xl border border-red-900/60 bg-zinc-950/80 shadow-2xl shadow-red-950/20 text-white">
        <CardHeader>
          <CardTitle className="text-xl text-red-400">What is this?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-200">
          <p>
            This project is both:
            <br />
            <span className="text-zinc-300">(1)</span> an app where users can
            sign in (JWT-based auth), and
            <br />
            <span className="text-zinc-300">(2)</span> an OIDC provider so other
            apps (clients) can use SSO.
          </p>

          <p>
            In OIDC terms, this service is the <b>Issuer</b> (Authorization
            Server). Your external app is an <b>OIDC Client</b>.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-red-900/60 bg-zinc-950/80 shadow-2xl shadow-red-950/20 text-white">
        <CardHeader>
          <CardTitle className="text-xl text-red-400">Base URL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-200">
          <p>
            Backend defaults to <InlineCode>http://localhost:3000</InlineCode>.
            The frontend uses <InlineCode>VITE_API_URL</InlineCode> if set.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-red-900/60 bg-zinc-950/80 shadow-2xl shadow-red-950/20 text-white">
        <CardHeader>
          <CardTitle className="text-xl text-red-400">
            Connect SSO (OIDC Authorization Code)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-zinc-200">
          <div className="space-y-2">
            <div className="font-semibold text-red-300">1) Create a client</div>
            <p>
              Create an OIDC client from the UI at{" "}
              <InlineCode>/clients</InlineCode>
              (requires being signed in), or by calling the endpoint below.
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-red-300">2) Redirect user</div>
            <p>
              Send the user to the authorization endpoint with:
              <InlineCode>client_id</InlineCode> and{" "}
              <InlineCode>redirect_uri</InlineCode>.
            </p>
            <CodeBlock>
              {`GET /oidc/authorize?client_id=CLIENT_ID&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback`}
            </CodeBlock>
            <p className="text-zinc-400">
              If valid, the API responds with client info. Your client app then
              shows a login screen and submits credentials to the POST authorize
              endpoint.
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-red-300">
              3) Exchange code for tokens
            </div>
            <p>
              After successful login/consent, the server returns a one-time
              authorization <InlineCode>code</InlineCode>.
            </p>

            <CodeBlock>
              {`POST /oidc/token
Content-Type: application/json

{
  "client_id": "CLIENT_ID",
  "client_secret": "CLIENT_SECRET",
  "code": "AUTH_CODE"
}`}
            </CodeBlock>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-red-300">4) Call userinfo</div>
            <CodeBlock>
              {`GET /oidc/userinfo
Authorization: Bearer ACCESS_TOKEN`}
            </CodeBlock>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-red-900/60 bg-zinc-950/80 shadow-2xl shadow-red-950/20 text-white">
        <CardHeader>
          <CardTitle className="text-xl text-red-400">Endpoints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-200">
          <CodeBlock>
            {`OIDC
- GET /.well-known/openid-configuration
- GET /.well-known/jwks.json
- GET /oidc/authorize
- POST /oidc/authorize
- POST /oidc/token
- GET /oidc/userinfo

Client management (requires app user auth)
- POST /oidc/clients
- GET /oidc/clients
- GET /oidc/clients/:clientId

User auth
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/refresh-token
- POST /api/auth/logout`}
          </CodeBlock>
          <p className="text-zinc-400">
            On client creation, <InlineCode>client_secret</InlineCode> is shown
            only once.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
