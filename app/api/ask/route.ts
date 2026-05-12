import { NextRequest, NextResponse } from "next/server";
import { answerQuestion } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, docContext, history, sections } = body as {
      question: string;
      docContext: string;
      history: Array<{ role: "user" | "assistant"; content: string }>;
      sections?: Array<{ title: string; index: number }>;
    };

    if (!question || !docContext) {
      return NextResponse.json({ error: "question and docContext are required" }, { status: 400 });
    }

    const result = await answerQuestion(question, docContext, history ?? [], sections);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Ask error:", err);
    return NextResponse.json({ error: "Failed to answer question." }, { status: 500 });
  }
}
