import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db";
import { config, isProd } from "../config";
import { asyncHandler, HttpError } from "../utils/http";
import { signAccess, signRefresh } from "../utils/tokens";
import { requireAuth } from "../middleware/auth";

const router = Router();

const publicUser = { id: true, email: true, name: true, role: true, createdAt: true } as const;

const cookieBase = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  path: "/api/auth",
};

const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(2).max(60),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) throw new HttpError(409, "Email already registered");

    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: await bcrypt.hash(data.password, 10),
      },
      select: publicUser,
    });

    res.cookie("refresh_token", signRefresh(user.id), { ...cookieBase, maxAge: 7 * 24 * 3600 * 1000 });
    res.status(201).json({ user, accessToken: signAccess(user) });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const found = await prisma.user.findUnique({ where: { email: data.email } });
    if (!found || !(await bcrypt.compare(data.password, found.passwordHash))) {
      throw new HttpError(401, "Invalid email or password");
    }
    const user = { id: found.id, email: found.email, name: found.name, role: found.role, createdAt: found.createdAt };

    res.cookie("refresh_token", signRefresh(user.id), { ...cookieBase, maxAge: 7 * 24 * 3600 * 1000 });
    res.json({ user, accessToken: signAccess(user) });
  })
);

// Uses the httpOnly refresh cookie to issue a new access token
router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.refresh_token as string | undefined;
    if (!token) throw new HttpError(401, "No refresh token");
    let userId: string;
    try {
      userId = jwt.verify(token, config.JWT_REFRESH_SECRET).sub as string;
    } catch {
      throw new HttpError(401, "Invalid or expired refresh token");
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUser });
    if (!user) throw new HttpError(401, "User no longer exists");
    res.json({ user, accessToken: signAccess(user) });
  })
);

router.post("/logout", (_req, res) => {
  res.clearCookie("refresh_token", cookieBase);
  res.json({ ok: true });
});

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: publicUser });
    if (!user) throw new HttpError(404, "User not found");
    res.json({ user });
  })
);

export default router;
