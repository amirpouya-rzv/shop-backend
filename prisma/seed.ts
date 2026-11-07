import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const categories = ["Electronics", "Clothing", "Home & Kitchen", "Books", "Sports"];

// [name, category, priceCents, stock, description]
const products: [string, string, number, number, string][] = [
  ["Wireless Headphones", "Electronics", 8999, 40, "Over-ear Bluetooth headphones with noise reduction and 30 hours of battery life."],
  ["Mechanical Keyboard", "Electronics", 6999, 25, "Compact tenkeyless keyboard with tactile switches and white backlight."],
  ["HD Webcam", "Electronics", 5499, 30, "1080p webcam with built-in microphone for calls and streaming."],
  ["Portable Charger", "Electronics", 2999, 60, "10000 mAh power bank with fast charging and two USB ports."],
  ["Smart Watch", "Electronics", 12999, 15, "Fitness tracking, heart rate monitor and notifications on your wrist."],
  ["Classic Cotton T-Shirt", "Clothing", 1999, 100, "Soft everyday t-shirt made from 100% combed cotton."],
  ["Slim Fit Jeans", "Clothing", 4999, 50, "Stretch denim jeans with a modern slim cut."],
  ["Hooded Sweatshirt", "Clothing", 3999, 45, "Warm fleece-lined hoodie with a front pocket."],
  ["Running Jacket", "Clothing", 7499, 20, "Lightweight water-resistant jacket with reflective details."],
  ["Ceramic Mug Set", "Home & Kitchen", 2499, 70, "Set of four 350 ml ceramic mugs, dishwasher safe."],
  ["Non-stick Frying Pan", "Home & Kitchen", 3499, 35, "28 cm frying pan with a durable non-stick coating."],
  ["Desk Lamp", "Home & Kitchen", 2999, 4, "Adjustable LED desk lamp with three brightness levels."],
  ["Steel Water Bottle", "Home & Kitchen", 1899, 80, "Insulated 750 ml bottle that keeps drinks cold for 24 hours."],
  ["TypeScript in Practice", "Books", 3499, 40, "A hands-on guide to building typed applications with TypeScript."],
  ["Writing Clean Code", "Books", 3999, 3, "Practical habits for readable, maintainable code."],
  ["Machine Learning Basics", "Books", 4499, 25, "An introduction to core machine learning ideas with worked examples."],
  ["Yoga Mat", "Sports", 2299, 55, "6 mm non-slip yoga mat with a carrying strap."],
  ["Adjustable Dumbbells", "Sports", 8999, 12, "Pair of adjustable dumbbells, 2 to 20 kg each."],
  ["Jump Rope", "Sports", 1299, 90, "Speed rope with ball bearings and adjustable length."],
  ["Running Shoes", "Sports", 8499, 28, "Cushioned road running shoes with a breathable mesh upper."],
];

// Offline-friendly placeholder images, generated locally as SVG files
function writePlaceholder(slug: string, name: string): string {
  const dir = path.resolve("uploads");
  fs.mkdirSync(dir, { recursive: true });
  const hue = [...name].reduce((h, c) => (h + c.charCodeAt(0) * 7) % 360, 0);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
<rect width="600" height="600" fill="hsl(${hue},60%,90%)"/>
<circle cx="300" cy="250" r="110" fill="hsl(${hue},55%,62%)"/>
<text x="300" y="440" font-family="Arial, sans-serif" font-size="30" text-anchor="middle" fill="hsl(${hue},45%,25%)">${name}</text>
</svg>`;
  const file = `seed-${slug}.svg`;
  fs.writeFileSync(path.join(dir, file), svg);
  return `/uploads/${file}`;
}

async function main() {
  const categoryIds = new Map<string, string>();
  for (const name of categories) {
    const c = await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name) },
    });
    categoryIds.set(name, c.id);
  }

  for (const [name, category, priceCents, stock, description] of products) {
    const slug = slugify(name);
    await prisma.product.upsert({
      where: { slug },
      update: {},
      create: {
        name,
        slug,
        description,
        priceCents,
        stock,
        imageUrl: writePlaceholder(slug, name),
        categoryId: categoryIds.get(category)!,
      },
    });
  }

  await prisma.user.upsert({
    where: { email: "admin@shop.dev" },
    update: {},
    create: {
      email: "admin@shop.dev",
      name: "Admin",
      role: "ADMIN",
      passwordHash: await bcrypt.hash("Admin12345", 10),
    },
  });
  await prisma.user.upsert({
    where: { email: "user@shop.dev" },
    update: {},
    create: {
      email: "user@shop.dev",
      name: "Demo User",
      passwordHash: await bcrypt.hash("User12345", 10),
    },
  });

  console.log("Seed complete");
  console.log("  admin: admin@shop.dev / Admin12345");
  console.log("  user:  user@shop.dev / User12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
