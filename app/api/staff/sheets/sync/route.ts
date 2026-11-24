import { createSign } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffUser } from "@/lib/staff-auth";
import { supabase } from "@/lib/supabase";

const sheetRowSchema = z.object({
  id: z.string().trim().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(100),
  category: z.enum(["Everyday wear", "Sets", "Outerwear"]),
  price: z.coerce.number().int().min(0).max(100_000_000),
  description: z.string().trim().max(2_000).default(""),
  image: z.string().trim().url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
  image_alt: z.string().trim().min(1).max(250),
  featured: z.enum(["TRUE", "FALSE", "true", "false", "1", "0", ""]).transform((value) => value === "TRUE" || value === "true" || value === "1"),
  variant_id: z.string().trim().min(1).max(96).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  variant_label: z.string().trim().min(1).max(80),
  variant_color: z.string().trim().min(1).max(50),
  variant_stock: z.coerce.number().int().min(0).max(1_000_000),
});

const base64Url = (value: string | Buffer) =>
  Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function getGoogleAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !privateKey) throw new Error("Google service account configuration is missing.");

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));
  const unsigned = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey, "base64");
  const jwt = `${unsigned}.${signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!response.ok) throw new Error("Google authentication failed.");
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error("Google did not return an access token.");
  return data.access_token;
}

async function recordFailedSync(actorUserId: string, errorMessage: string) {
  if (!supabase) return;
  await supabase.from("catalog_sync_runs").insert({
    source: "google_sheets",
    status: "failed",
    completed_at: new Date().toISOString(),
    actor_user_id: actorUserId,
    error: errorMessage.slice(0, 2_000),
  });
}

export async function GET(request: Request) {
  const result = await requireStaffUser(request);
  if ("status" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.role !== "admin") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: "Catalog storage is not configured." }, { status: 503 });

  const { data, error } = await supabase
    .from("catalog_sync_runs")
    .select("id, source, status, started_at, completed_at, actor_user_id, product_count, variant_count, error")
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: "Sync history could not be loaded." }, { status: 500 });
  return NextResponse.json({ sync_runs: data ?? [] });
}

export async function POST(request: Request) {
  const result = await requireStaffUser(request);
  if ("status" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.role !== "admin") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: "Catalog storage is not configured." }, { status: 503 });

  const sheetId = process.env.GOOGLE_SHEET_ID;
  const range = process.env.GOOGLE_SHEET_RANGE ?? "Catalog!A1:L";
  if (!sheetId) return NextResponse.json({ error: "Google Sheets synchronization is not configured." }, { status: 503 });

  let values: unknown[][];
  try {
    const accessToken = await getGoogleAccessToken();
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) throw new Error("Google Sheets could not be read.");
    const data = await response.json() as { values?: unknown[][] };
    values = data.values ?? [];
  } catch (error) {
    await recordFailedSync(result.userId, error instanceof Error ? error.message : "Google Sheets read failed.");
    return NextResponse.json({ error: "Google Sheets could not be read." }, { status: 502 });
  }

  if (values.length < 2) return NextResponse.json({ error: "The catalog sheet contains no product rows." }, { status: 400 });

  const headers = values[0].map((value) => String(value).trim());
  const expected = ["id", "name", "category", "price", "description", "image", "image_alt", "featured", "variant_id", "variant_label", "variant_color", "variant_stock"];
  if (headers.join("|") !== expected.join("|")) {
    await recordFailedSync(result.userId, "Unexpected Google Sheets headers.");
    return NextResponse.json({ error: "Google Sheets headers do not match the catalog schema." }, { status: 400 });
  }

  const rows: unknown[] = [];
  for (const [index, valuesRow] of values.slice(1).entries()) {
    if (valuesRow.every((value) => String(value ?? "").trim() === "")) continue;
    const padded = expected.map((_, column) => valuesRow[column] ?? "");
    const record = Object.fromEntries(expected.map((key, column) => [key, padded[column]]));
    const parsed = sheetRowSchema.safeParse(record);
    if (!parsed.success) {
      await recordFailedSync(result.userId, `Invalid row ${index + 2}.`);
      return NextResponse.json({ error: `Invalid catalog row ${index + 2}.`, details: parsed.error.issues }, { status: 400 });
    }
    rows.push(parsed.data);
  }

  const ids = rows.map((row) => (row as { variant_id: string }).variant_id);
  if (new Set(ids).size !== ids.length) {
    await recordFailedSync(result.userId, "Duplicate variant IDs.");
    return NextResponse.json({ error: "Duplicate variant IDs are not allowed." }, { status: 400 });
  }

  const rpcRows = rows.map((row) => {
    const record = row as z.infer<typeof sheetRowSchema>;
    return {
      id: record.id,
      name: record.name,
      category: record.category,
      price: record.price,
      description: record.description,
      image: record.image,
      image_alt: record.image_alt,
      featured: record.featured,
      variant_id: record.variant_id,
      variant_label: record.variant_label,
      variant_color: record.variant_color,
      variant_stock: record.variant_stock,
    };
  });

  const { data, error } = await supabase.rpc("sync_catalog_from_sheets", {
    p_rows: rpcRows,
    p_actor_user_id: result.userId,
  });
  if (error) {
    await recordFailedSync(result.userId, error.message);
    return NextResponse.json({ error: "The catalog import failed safely and was rolled back." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    sync_run_id: data,
    product_count: new Set(rpcRows.map((row) => row.id)).size,
    variant_count: rpcRows.length,
  });
}
