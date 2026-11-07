import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler, HttpError } from "../utils/http";
import { uniqueSlug } from "../utils/slug";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { listProducts } from "../services/products";

const router = Router();

const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(5000),
  priceCents: z.number().int().min(1),
  stock: z.number().int().min(0),
  imageUrl: z.string().max(500).nullable().optional(),
  categoryId: z.string().min(1),
  isActive: z.boolean().default(true),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await listProducts(req.query));
  })
);

// Accepts either the product id or its slug
router.get(
  "/:idOrSlug",
  asyncHandler(async (req, res) => {
    const key = req.params.idOrSlug;
    const product = await prisma.product.findFirst({
      where: { isActive: true, OR: [{ id: key }, { slug: key }] },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (!product) throw new HttpError(404, "Product not found");
    res.json(product);
  })
);

router.post(
  "/",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = productSchema.parse(req.body);
    const product = await prisma.product.create({
      data: { ...data, slug: uniqueSlug(data.name) },
    });
    res.status(201).json(product);
  })
);

router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = productSchema.partial().parse(req.body);
    const product = await prisma.product.update({ where: { id: req.params.id }, data });
    res.json(product);
  })
);

// Soft delete: keeps order history intact, hides the product from the store
router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await prisma.$transaction([
      prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } }),
      prisma.cartItem.deleteMany({ where: { productId: req.params.id } }),
    ]);
    res.status(204).end();
  })
);

export default router;
