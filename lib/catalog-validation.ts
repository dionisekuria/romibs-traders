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
  name: nonEmptyText(100),
  category: z.enum(["Everyday wear", "Sets", "Outerwear"]),
  price: z.number().int().min(0).max(100_000_000),
  description: z.string().trim().max(2_000),
  image: z.url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Image URL must use HTTP or HTTPS."),
  imageAlt: nonEmptyText(250),
  featured: z.boolean(),
  variants: z.array(variantDraftSchema.omit({ stock: true }).extend({
    id: variantId,
    stock: z.number().int().min(0).max(1_000_000),
  }).strict()).min(1).max(100),
}).strict().superRefine((product, context) => {
  const ids = product.variants.map((variant) => variant.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["variants"], message: "Variant IDs must be unique." });
  }
});

export const deleteProductSchema = z.object({ id: productId }).strict();

export const staffMemberUpdateSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin", "staff"]).optional(),
  active: z.boolean().optional(),
}).strict().refine((value) => value.role !== undefined || value.active !== undefined, "Role or active status is required.");

export const staffMemberCreateSchema = z.object({
  user_id: z.string().uuid().optional(),
  email: z.string().email().max(320).optional(),
  role: z.enum(["admin", "staff"]),
}).strict().refine((value) => value.user_id !== undefined || value.email !== undefined, "A user ID or email is required.");
