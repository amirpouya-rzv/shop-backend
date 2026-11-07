import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler, HttpError } from "../utils/http";
import { slugify } from "../utils/slug";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();
const bodySchema = z.object({ name: z.string().trim().min(2).max(60) });

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
    });
    res.json({ items: categories });
  })
);

router.post(
  "/",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name } = bodySchema.parse(req.body);
    const category = await prisma.category.create({ data: { name, slug: slugify(name) } });
    res.status(201).json(category);
  })
);

router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name } = bodySchema.parse(req.body);
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { name, slug: slugify(name) },
    });
    res.json(category);
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const count = await prisma.product.count({ where: { categoryId: req.params.id } });
    if (count > 0) throw new HttpError(409, "Category still has products");
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

export default router;
