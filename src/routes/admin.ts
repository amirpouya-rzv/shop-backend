import { Router } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler, HttpError } from "../utils/http";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { listProducts } from "../services/products";
import { cancelOrderTx } from "../services/orders";

const router = Router();
router.use(requireAuth, requireAdmin);

// ---- image upload (stored on local disk in ./uploads) ----
const uploadDir = path.resolve("uploads");
// Serverless hosts (Vercel) have a read-only disk, so uploads are disabled there
const uploadsEnabled = !process.env.VERCEL;
if (uploadsEnabled) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) =>
      cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, "Only png, jpg, webp or gif images are allowed"));
  },
});

router.post(
  "/uploads",
  (_req, _res, next) => {
    if (!uploadsEnabled) {
      throw new HttpError(501, "Image upload is not available on this deployment. Use an image URL instead.");
    }
    next();
  },
  upload.single("image"),
  (req, res) => {
    if (!req.file) throw new HttpError(400, "No file uploaded (field name: image)");
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  }
);

// ---- products (includes inactive ones) ----
router.get(
  "/products",
  asyncHandler(async (req, res) => {
    res.json(await listProducts(req.query, { includeInactive: true }));
  })
);

// ---- orders ----
const transitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

const ordersQuery = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

router.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const { status, page, limit } = ordersQuery.parse(req.query);
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { items: true, user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.order.count({ where }),
    ]);
    res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
  })
);

router.get(
  "/orders/:id",
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, user: { select: { id: true, name: true, email: true } } },
    });
    if (!order) throw new HttpError(404, "Order not found");
    res.json(order);
  })
);

router.patch(
  "/orders/:id/status",
  asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.nativeEnum(OrderStatus) }).parse(req.body);
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new HttpError(404, "Order not found");
    if (!transitions[order.status].includes(status)) {
      throw new HttpError(409, `Cannot change status from ${order.status} to ${status}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (status === "CANCELLED") return cancelOrderTx(tx, order.id);
      return tx.order.update({
        where: { id: order.id },
        data: { status, ...(status === "PAID" ? { paidAt: new Date() } : {}) },
        include: { items: true },
      });
    });
    res.json(updated);
  })
);

// ---- users ----
router.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const items = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, role: true, createdAt: true, _count: { select: { orders: true } } },
    });
    res.json({ items });
  })
);

// ---- dashboard ----
router.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [users, products, orders, revenue, byStatus, lowStock, recentOrders] = await Promise.all([
      prisma.user.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.count(),
      prisma.order.aggregate({
        _sum: { totalCents: true },
        where: { status: { in: ["PAID", "SHIPPED", "DELIVERED"] } },
      }),
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.product.findMany({
        where: { isActive: true, stock: { lte: 5 } },
        orderBy: { stock: "asc" },
        take: 10,
        select: { id: true, name: true, stock: true },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);

    res.json({
      users,
      products,
      orders,
      revenueCents: revenue._sum.totalCents ?? 0,
      ordersByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      lowStock,
      recentOrders,
    });
  })
);

export default router;
