import { NextResponse } from "next/server";
import { products as demoProducts, type Product } from "@/lib/catalog";
import { createProductSchema, deleteProductSchema, updateProductSchema } from "@/lib/catalog-validation";
import { requireStaffUser } from "@/lib/staff-auth";
import { supabase } from "@/lib/supabase";

type ProductRow = Omit<Product, "imageAlt" | "variants"> & { image_alt: string; product_variants: Product["variants"] };

const toProduct = (product: ProductRow): Product => ({ ...product, imageAlt: product.image_alt, variants: product.product_variants });

const writeErrorResponse = (error: { code?: string; message?: string }, operation: string) => {
  if (error.code === "23505") {
    return NextResponse.json({ error: "A product or variant with that ID already exists." }, { status: 409 });
  }
  if (error.code === "P0002") {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }
  if (error.code === "22023") {
    return NextResponse.json({ error: "A variant is invalid or does not belong to this product." }, { status: 400 });
  }

  console.error(`Catalog ${operation} failed.`, error);
  return NextResponse.json({ error: "The catalog could not be saved." }, { status: 500 });
};

export async function GET() {
  if (!supabase) return NextResponse.json({ products: demoProducts.filter((product) => product.variants.some((variant) => variant.stock > 0)), source: "demo" });
  const { data, error } = await supabase.from("products").select("*, product_variants(*)").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: (data ?? []).map((product) => toProduct(product as ProductRow)), source: "supabase" });
}

export async function POST(request: Request) {
  const authResult = await requireStaffUser(request);
  if ("status" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  if (!supabase) return NextResponse.json({ error: "Catalog storage is not configured." }, { status: 503 });

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = createProductSchema.safeParse(requestBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Product details are invalid.", details: parsed.error.issues.map(({ path, message }) => ({ path, message })) }, { status: 400 });
  }

  const product = parsed.data;
  const variants = product.variants.map((variant, index) => ({
    ...variant,
    id: variant.id || `${product.id}-variant-${index + 1}`,
  }));
  if (new Set(variants.map((variant) => variant.id)).size !== variants.length) {
    return NextResponse.json({ error: "Variant IDs must be unique." }, { status: 400 });
  }

  const { error } = await supabase.rpc("create_product_with_variants", {
    p_id: product.id,
    p_name: product.name,
    p_category: product.category,
    p_price: product.price,
    p_description: product.description,
    p_image: product.image,
    p_image_alt: product.imageAlt,
    p_featured: product.featured ?? false,
    p_variants: variants,
  });
  if (error) return writeErrorResponse(error, "creation");

  return NextResponse.json({ product: { ...product, variants } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authResult = await requireStaffUser(request);
  if ("status" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  if (!supabase) return NextResponse.json({ error: "Catalog storage is not configured." }, { status: 503 });

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = updateProductSchema.safeParse(requestBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Product update is invalid.", details: parsed.error.issues.map(({ path, message }) => ({ path, message })) }, { status: 400 });
  }

  const product = parsed.data;
  const { error } = await supabase.rpc("update_catalog_product", {
    p_id: parsed.data.id,
    p_name: product.name,
    p_category: product.category,
    p_price: product.price,
    p_description: product.description,
    p_image: product.image,
    p_image_alt: product.imageAlt,
    p_featured: product.featured,
    p_variants: product.variants,
  });
  if (error) return writeErrorResponse(error, "update");

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const authResult = await requireStaffUser(request);
  if ("status" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  if (!supabase) return NextResponse.json({ error: "Catalog storage is not configured." }, { status: 503 });

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = deleteProductSchema.safeParse(requestBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Product ID is invalid.", details: parsed.error.issues.map(({ path, message }) => ({ path, message })) }, { status: 400 });
  }

  const { error } = await supabase.rpc("delete_catalog_product", { p_id: parsed.data.id });
  if (error) return writeErrorResponse(error, "deletion");
  return NextResponse.json({ ok: true });
}
