import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";

export const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  category: z.string().optional(), // category slug
  minPrice: z.coerce.number().int().min(0).optional(), // cents
  maxPrice: z.coerce.number().int().min(0).optional(), // cents
  sort: z.enum(["newest", "price_asc", "price_desc", "name"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

const orderByMap: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  price_asc: { priceCents: "asc" },
  price_desc: { priceCents: "desc" },
  name: { name: "asc" },
};

export async function listProducts(rawQuery: unknown, opts: { includeInactive?: boolean } = {}) {
  const { q, category, minPrice, maxPrice, sort, page, limit } = listQuerySchema.parse(rawQuery);

  const where: Prisma.ProductWhereInput = {
    ...(opts.includeInactive ? {} : { isActive: true }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(category ? { category: { slug: category } } : {}),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? { priceCents: { gte: minPrice, lte: maxPrice } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: orderByMap[sort],
      skip: (page - 1) * limit,
      take: limit,
      include: { category: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.product.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
