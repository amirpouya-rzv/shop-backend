import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler, HttpError } from "../utils/http";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

async function getCart(userId: string) {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: true },
    orderBy: { createdAt: "asc" },
  });
  return {
    items,
    count: items.reduce((sum, i) => sum + i.quantity, 0),
    totalCents: items.reduce((sum, i) => sum + i.quantity * i.product.priceCents, 0),
  };
}

const addSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99).default(1),
});
const updateSchema = z.object({ quantity: z.number().int().min(1).max(99) });

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getCart(req.user!.id));
  })
);

router.post(
  "/items",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { productId, quantity } = addSchema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) throw new HttpError(404, "Product not found");

    const existing = await prisma.cartItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    const newQty = (existing?.quantity ?? 0) + quantity;
    if (newQty > product.stock) throw new HttpError(400, "Not enough stock");

    await prisma.cartItem.upsert({
      where: { userId_productId: { userId, productId } },
      update: { quantity: newQty },
      create: { userId, productId, quantity },
    });
    res.status(201).json(await getCart(userId));
  })
);

router.patch(
  "/items/:productId",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const productId = req.params.productId;
    const { quantity } = updateSchema.parse(req.body);

    const item = await prisma.cartItem.findUnique({
      where: { userId_productId: { userId, productId } },
      include: { product: true },
    });
    if (!item) throw new HttpError(404, "Item not in cart");
    if (quantity > item.product.stock) throw new HttpError(400, "Not enough stock");

    await prisma.cartItem.update({
      where: { userId_productId: { userId, productId } },
      data: { quantity },
    });
    res.json(await getCart(userId));
  })
);

router.delete(
  "/items/:productId",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    await prisma.cartItem.deleteMany({ where: { userId, productId: req.params.productId } });
    res.json(await getCart(userId));
  })
);

router.delete(
  "/",
  asyncHandler(async (req, res) => {
    await prisma.cartItem.deleteMany({ where: { userId: req.user!.id } });
    res.json(await getCart(req.user!.id));
  })
);

export default router;
