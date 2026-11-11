
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";

import { config, isProd } from "./config";
import { errorHandler, notFound } from "./middleware/error";

import authRouter from "./routes/auth";
import categoriesRouter from "./routes/categories";
import productsRouter from "./routes/products";
import cartRouter from "./routes/cart";
import ordersRouter from "./routes/orders";
import adminRouter from "./routes/admin";
import placeholdersRouter from "./routes/placeholders";

import { openapi } from "./docs/openapi";

const app = express();

const uploadDir = path.resolve("uploads");

try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch {
  // read-only filesystem (e.g. serverless hosting): uploads are disabled there
}

app.set("trust proxy", 1);

// Swagger UI
const swaggerCdn = "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5";

const swaggerAssets: Record<string, unknown> = process.env.VERCEL
  ? {
      customCssUrl: `${swaggerCdn}/swagger-ui.min.css`,
      customJs: [
        `${swaggerCdn}/swagger-ui-bundle.min.js`,
        `${swaggerCdn}/swagger-ui-standalone-preset.min.js`,
      ],
    }
  : {};

app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(openapi, {
    customSiteTitle: "Shop API Docs",
    swaggerOptions: { persistAuthorization: true },
    ...swaggerAssets,
  })
);

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

// CORS configuration
const allowedOrigins = config.CLIENT_URL
  .split(",")
  .map((origin) => origin.trim());

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests without Origin header
    if (!origin) {
      return callback(null, true);
    }

    const isAllowed =
      allowedOrigins.includes(origin) ||
      /^https:\/\/nova-frontend-[a-z0-9-]+-amirpouya-rzvs-projects\.vercel\.app$/.test(
        origin
      );

    if (isAllowed) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },

  credentials: true,
};

app.use(cors(corsOptions));

// Logging and body parsing
app.use(morgan(isProd ? "combined" : "dev"));

app.use(express.json({ limit: "1mb" }));

app.use(cookieParser());

// Static files
app.use("/uploads", placeholdersRouter);
app.use("/uploads", express.static(uploadDir));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
  });
});

// API rate limits
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
  })
);

app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isProd ? 30 : 1000,
  }),
  authRouter
);

// API routes
app.use("/api/categories", categoriesRouter);
app.use("/api/products", productsRouter);
app.use("/api/cart", cartRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/admin", adminRouter);

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;
