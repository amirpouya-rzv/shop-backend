import { RequestHandler } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Role } from "@prisma/client";
import { config } from "../config";
import { HttpError } from "../utils/http";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new HttpError(401, "Authentication required");
  try {
    const payload = jwt.verify(header.slice(7), config.JWT_ACCESS_SECRET) as JwtPayload;
    req.user = { id: payload.sub as string, role: payload.role as Role };
    next();
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== "ADMIN") throw new HttpError(403, "Admin access required");
  next();
};
