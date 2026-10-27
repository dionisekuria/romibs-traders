import { NextResponse } from "next/server";
import { products as demoProducts, type Product } from "@/lib/catalog";
import { supabase, supabaseAuth } from "@/lib/supabase";

type ProductRow = Omit<Product, "imageAlt" | "variants"> & { image_alt: string; product_variants: Product["variants"] };

const toProduct = (product: ProductRow): Product => ({ ...product, imageAlt: product.image_alt, variants: product.product_variants });

const requireStaffUser = async (request: Request) => {
  if (!supabase || !supabaseAuth) {
    return { error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY to your environment.", status: 503 };
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!token) {
    return { error: "Authentication is required to update the catalog.", status: 401 };
  }

  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
  if (error || !user) {
    return { error: "Your session has expired or is invalid.", status: 401 };
  }

  return { user };
};

export async function GET() {
  if (!supabase) return NextResponse.json({ products: demoProducts.filter((product) => product.variants.some((variant) => variant.stock > 0)), source: "demo" });
  const { data, error } = await supabase.from("products").select("*, product_variants(*)").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: (data ?? []).map((product) => toProduct(product as ProductRow)), source: "supabase" });
}

export async function POST(request: Request) {
  const authResult = await requireStaffUser(request);
  if ("status" in authResult && authResult.status !== 200) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  if (!supabase) return NextResponse.json({ error: "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your environment." }, { status: 503 });

  const body = await request.json() as Product;
  const { error: productError } = await supabase.from("products").insert({ id: body.id, name: body.name, category: body.category, price: body.price, description: body.description, image: body.image, image_alt: body.imageAlt, featured: body.featured ?? false });
  if (productError) return NextResponse.json({ error: productError.message }, { status: 400 });
  const { error: variantError } = await supabase.from("product_variants").insert(body.variants.map((variant) => ({ ...variant, product_id: body.id })));
  if (variantError) { await supabase.from("products").delete().eq("id", body.id); return NextResponse.json({ error: variantError.message }, { status: 400 }); }
  return NextResponse.json({ product: body }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authResult = await requireStaffUser(request);
  if ("status" in authResult && authResult.status !== 200) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  if (!supabase) return NextResponse.json({ error: "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your environment." }, { status: 503 });

  const body = await request.json() as Pick<Product, "id" | "price" | "variants">;
  const { error: productError } = await supabase.from("products").update({ price: body.price }).eq("id", body.id);
  if (productError) return NextResponse.json({ error: productError.message }, { status: 400 });
  for (const variant of body.variants) {
    const { error } = await supabase.from("product_variants").update({ stock: variant.stock }).eq("id", variant.id).eq("product_id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
