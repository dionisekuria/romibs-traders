import { z } from "zod";

const productId = z.string().trim().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const variantId = z.string().trim().min(1).max(96).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const nonEmptyText = (max: number) => z.string().trim().min(1).max(max);

const variantDraftSchema = z.object({
  id: variantId.optional(),
  label: nonEmptyText(80),
  color: nonEmptyText(50),
  stock: z.number().int().min(0).max(1_000_000),
}).strict();

export const createProductSchema = z.object({
  id: productId,
  name: nonEmptyText(100),
  category: z.enum(["Everyday wear", "Sets", "Outerwear"]),
  price: z.number().int().min(0).max(100_000_000),
  description: z.string().trim().max(2_000),
  image: z.url().refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Image URL must use HTTP or HTTPS."),
  imageAlt: nonEmptyText(250),
  featured: z.boolean().optional(),
  variants: z.array(variantDraftSchema).min(1).max(100),
}).strict().superRefine((product, context) => {
  const ids = product.variants.flatMap((variant) => variant.id ? [variant.id] : []);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["variants"], message: "Variant IDs must be unique." });
  }
});

export const updateProductSchema = z.object({
  id: productId,
  price: z.number().int().min(0).max(100_000_000),
  variants: z.array(z.object({
    id: variantId,
    stock: z.number().int().min(0).max(1_000_000),
  }).strict()).min(1).max(100),
}).strict().superRefine((product, context) => {
  const ids = product.variants.map((variant) => variant.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["variants"], message: "Variant IDs must be unique." });
  }
});
