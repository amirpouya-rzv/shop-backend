import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { config } from "../config";

export const signAccess = (user: { id: string; role: Role }) =>
  jwt.sign({ role: user.role }, config.JWT_ACCESS_SECRET, {
    subject: user.id,
    expiresIn: "15m",
  });

export const signRefresh = (userId: string) =>
  jwt.sign({}, config.JWT_REFRESH_SECRET, { subject: userId, expiresIn: "7d" });
