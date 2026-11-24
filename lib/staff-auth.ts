import { supabase, supabaseAuth } from "@/lib/supabase";

type StaffRole = "admin" | "staff";

export type StaffAuthorization =
  | { userId: string; role: StaffRole }
  | { error: string; status: 401 | 403 | 500 | 503 };

export async function requireStaffUser(request: Request): Promise<StaffAuthorization> {
  if (!supabase || !supabaseAuth) {
    return { error: "Staff access is not configured.", status: 503 };
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return { error: "Authentication is required.", status: 401 };
  }

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) {
    return { error: "Your session is invalid or has expired.", status: 401 };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("staff_members")
    .select("role, active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (membershipError) {
    console.error("Could not verify staff membership.", membershipError);
    return { error: "Staff access could not be verified.", status: 500 };
  }

  if (!membership || !["admin", "staff"].includes(membership.role)) {
    return { error: "You do not have staff access.", status: 403 };
  }

  return { userId: user.id, role: membership.role };
}
