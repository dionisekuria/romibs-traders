import { NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/staff-auth";

export async function GET(request: Request) {
  const result = await requireStaffUser(request);
  if ("status" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ role: result.role });
}
