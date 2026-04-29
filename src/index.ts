import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { assertDbConnected } from "./db";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/users.routes";
import oidcRoutes from "./routes/oidc.routes";
import { oidcDiscovery, oidcJwks } from "./controllers/oidc.controller";

dotenv.config();

const app = express();
const whitelist = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://yourapp.com",
];

app.use(
  cors({
    origin(origin, callback) {
      // allow Postman/server-to-server (no origin)
      if (!origin) {
        return callback(null, true);
      }

      if (whitelist.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error("Not allowed by CORS"));
    },

    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/oidc", oidcRoutes);

app.get("/.well-known/openid-configuration", oidcDiscovery);
app.get("/.well-known/jwks.json", oidcJwks);

app.get("/health", (_req: express.Request, res: express.Response) => {
  return res.json({ health: "good" });
});

async function start() {
  try {
    await assertDbConnected();
    console.log("db connected");
  } catch (err) {
    console.error("db connection failed:", err);
    process.exit(1);
  }

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => console.log(`App is listening at PORT : ${port}`));
}

start();
