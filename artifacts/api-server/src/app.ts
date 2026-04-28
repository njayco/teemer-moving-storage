import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import stripeRouter from "./routes/stripe";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust only the single immediate upstream proxy (Replit / load balancer) so
// `req.ip` reflects the real client address. We deliberately do NOT use
// `true` here, which would trust the entire `X-Forwarded-For` chain and let
// a remote attacker spoof their IP by prepending one — which would defeat
// the per-IP auth-email rate limiter.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const allowedOrigins = process.env.NODE_ENV === "production"
  ? [process.env.APP_ORIGIN].filter(Boolean) as string[]
  : true;
app.use(cors({ credentials: true, origin: allowedOrigins }));
app.use(cookieParser());

app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", stripeRouter);
app.use("/api", router);

export default app;
