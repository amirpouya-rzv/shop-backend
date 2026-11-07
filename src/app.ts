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

// Swagger UI is mounted before helmet so its CSP does not interfere with the docs page
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(openapi, {
    customSiteTitle: "Shop API Docs",
    swaggerOptions: { persistAuthorization: true },
  })
);

// cross-origin resource policy is relaxed so the Next.js app can load /uploads images
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: config.CLIENT_URL.split(",").map((s) => s.trim()), credentials: true }));
app.use(morgan(isProd ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use("/uploads", placeholdersRouter);
app.use("/uploads", express.static(uploadDir));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 1000 }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: isProd ? 30 : 1000 }), authRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/products", productsRouter);
app.use("/api/cart", cartRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/admin", adminRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
