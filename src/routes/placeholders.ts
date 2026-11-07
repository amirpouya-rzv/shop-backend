import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler, HttpError } from "../utils/http";

const router = Router();

// Demo product images are generated on the fly from the product name,
// so no image files need to exist on the server (works on serverless hosts too).
router.get(
  /^\/seed-([a-z0-9-]+)\.svg$/,
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { slug: req.params[0] },
      select: { name: true },
    });
    if (!product) throw new HttpError(404, "Image not found");

    const hue = [...product.name].reduce((h, c) => (h + c.charCodeAt(0) * 7) % 360, 0);
    const name = product.name.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
<rect width="600" height="600" fill="hsl(${hue},60%,90%)"/>
<circle cx="300" cy="250" r="110" fill="hsl(${hue},55%,62%)"/>
<text x="300" y="440" font-family="Arial, sans-serif" font-size="30" text-anchor="middle" fill="hsl(${hue},45%,25%)">${name}</text>
</svg>`;

    res.type("image/svg+xml").set("Cache-Control", "public, max-age=86400").send(svg);
  })
);

export default router;
