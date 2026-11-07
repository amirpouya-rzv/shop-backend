import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler, HttpError } from "../utils/http";
import { requireAuth } from "../middleware/auth";
import { cancelOrderTx } from "../services/orders";

const router = Router();
router.use(requireAuth);

const checkoutSchema = z.object({
  shippingName: z.string().trim().min(2).max(80),
  shippingPhone: z.string().trim().min(5).max(30),
  shippingAddress: z.string().trim().min(5).max(300),
  shippingCity: z.string().trim().min(2).max(80),
  shippingPostalCode: z.string().trim().min(2).max(20),
});

// Creates an order from the current cart. Stock is decremented atomically.
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const shipping = checkoutSchema.parse(req.body);

    const order = await prisma.$transaction(async (tx) => {
      const cart = await tx.cartItem.findMany({ where: { userId }, include: { product: true } });
      if (cart.length === 0) throw new HttpError(400, "Cart is empty");

      for (const item of cart) {
        if (!item.product.isActive) {
          throw new HttpError(409, `${item.product.name} is no longer available`);
        }
        const result = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (result.count === 0) {
          throw new HttpError(409, `Not enough stock for ${item.product.name}`);
        }
      }

      const created = await tx.order.create({
        data: {
          userId,
          ...shipping,
          totalCents: cart.reduce((sum, i) => sum + i.quantity * i.product.priceCents, 0),
          items: {
            create: cart.map((i) => ({
              productId: i.productId,
              name: i.product.name,
              unitPriceCents: i.product.priceCents,
              quantity: i.quantity,
            })),
          },
        },
        include: { items: true },
      });
      await tx.cartItem.deleteMany({ where: { userId } });
      return created;
    });

    res.status(201).json(order);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.order.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
    res.json({ items });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { items: true },
    });
    if (!order) throw new HttpError(404, "Order not found");
    res.json(order);
  })
);

// Mock payment: marks a pending order as paid. Swap in Stripe test mode later if you want.
router.post(
  "/:id/pay",
  asyncHandler(async (req, res) => {
    const result = await prisma.order.updateMany({
      where: { id: req.params.id, userId: req.user!.id, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (result.count === 0) throw new HttpError(409, "Order not found or not payable");
    res.json(await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } }));
  })
);

router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!order) throw new HttpError(404, "Order not found");
    if (order.status !== "PENDING") throw new HttpError(409, "Only pending orders can be cancelled");
    res.json(await prisma.$transaction((tx) => cancelOrderTx(tx, order.id)));
  })
);

export default router;
