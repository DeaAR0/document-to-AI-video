import { NextRequest, NextResponse } from "next/server";
import { recordEvent, getAnalytics, getAllDocIds } from "@/lib/analytics-store";
import type { AnalyticsEvent } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const event = (await req.json()) as AnalyticsEvent;
    recordEvent(event);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get("docId");
  if (docId) {
    return NextResponse.json(getAnalytics(docId));
  }
  const allIds = getAllDocIds();
  return NextResponse.json({ docIds: allIds });
}
