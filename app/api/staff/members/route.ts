import { NextResponse } from "next/server";
import { z } from "zod";
import { staffMemberCreateSchema, staffMemberUpdateSchema } from "@/lib/catalog-validation";
import { requireStaffUser } from "@/lib/staff-auth";
import { supabase } from "@/lib/supabase";

const requireAdmin = async (request: Request) => {
  const result = await requireStaffUser(request);
  if ("status" in result) return result;
  if (result.role !== "admin") return { error: "Administrator access is required.", status: 403 as const };
  return result;
};

export async function GET(request: Request) {
  const result = await requireAdmin(request);
  if ("status" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!supabase) return NextResponse.json({ error: "Staff services are not configured." }, { status: 503 });

  const { data, error } = await supabase
    .from("staff_members")
    .select("user_id, role, active, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Staff members could not be loaded." }, { status: 500 });
  return NextResponse.json({ members: data ?? [] });
}

export async function POST(request: Request) {
  const result = await requireAdmin(request);
  if ("status" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!supabase) return NextResponse.json({ error: "Staff services are not configured." }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = staffMemberCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Staff member details are invalid." }, { status: 400 });

  let userId = parsed.data.user_id;
  if (!userId) {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(parsed.data.email!, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/staff`,
    });
    if (error) return NextResponse.json({ error: "The staff invitation could not be created." }, { status: 400 });
    userId = data.user?.id;
  }
  if (!userId) return NextResponse.json({ error: "A staff user ID is required." }, { status: 400 });

  const { error } = await supabase.from("staff_members").upsert({
    user_id: userId,
    role: parsed.data.role,
    active: true,
  }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "The staff membership could not be saved." }, { status: 500 });

  return NextResponse.json({ member: { user_id: userId, role: parsed.data.role, active: true } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const result = await requireAdmin(request);
  if ("status" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!supabase) return NextResponse.json({ error: "Staff services are not configured." }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = staffMemberUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Staff member update is invalid." }, { status: 400 });

  const updates: { role?: "admin" | "staff"; active?: boolean } = {};
  if (parsed.data.role !== undefined) updates.role = parsed.data.role;
  if (parsed.data.active !== undefined) updates.active = parsed.data.active;

  const { data, error } = await supabase
    .from("staff_members")
    .update(updates)
    .eq("user_id", parsed.data.user_id)
    .select("user_id, role, active")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "The staff membership could not be updated." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
  return NextResponse.json({ member: data });
}

export async function DELETE(request: Request) {
  const result = await requireAdmin(request);
  if ("status" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!supabase) return NextResponse.json({ error: "Staff services are not configured." }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = z.object({ user_id: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Staff user ID is invalid." }, { status: 400 });
  if (parsed.data.user_id === result.userId) return NextResponse.json({ error: "You cannot remove your own administrator membership." }, { status: 400 });

  const { error, count } = await supabase
    .from("staff_members")
    .delete({ count: "exact" })
    .eq("user_id", parsed.data.user_id);
  if (error) return NextResponse.json({ error: "The staff membership could not be removed." }, { status: 500 });
  if (!count) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
