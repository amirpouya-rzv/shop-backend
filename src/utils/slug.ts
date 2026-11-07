import crypto from "crypto";

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const uniqueSlug = (s: string) =>
  `${slugify(s) || "item"}-${crypto.randomBytes(3).toString("hex")}`;
