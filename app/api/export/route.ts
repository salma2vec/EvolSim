import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "Use the browser Export control; server-side upload/export is disabled" }, { status: 410 });
}
