import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { parseDocx, parsePdf, parsePptx, parsePlainText } from "@/lib/document-parser";
import { generateScripts } from "@/lib/claude";
import type { ProcessedDocument } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const text = formData.get("text") as string | null;
    const url  = formData.get("url")  as string | null;

    let raw: { title: string; sections: { title: string; content: string }[] };
    let filename = "document";

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const name = file.name.toLowerCase();
      filename = file.name;

      if (name.endsWith(".docx") || name.endsWith(".doc")) {
        raw = await parseDocx(buffer);
      } else if (name.endsWith(".pdf")) {
        raw = await parsePdf(buffer);
      } else if (name.endsWith(".pptx") || name.endsWith(".ppt")) {
        raw = await parsePptx(buffer);
      } else if (name.endsWith(".txt")) {
        raw = parsePlainText(buffer.toString("utf-8"));
      } else {
        return NextResponse.json({ error: "Unsupported file type. Please upload PDF, DOCX, PPTX, or TXT." }, { status: 400 });
      }

    } else if (url) {
      // Google Slides plain-text export
      filename = "google-slides.txt";
      const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!resp.ok) {
        return NextResponse.json({
          error: "Could not fetch the Google Slides URL. Make sure the presentation is public (Anyone with the link can view).",
        }, { status: 400 });
      }
      const content = await resp.text();
      if (content.trim().length < 50) {
        return NextResponse.json({
          error: "The presentation appears empty or is not publicly accessible.",
        }, { status: 400 });
      }
      raw = parsePlainText(content);
      // Use a better title from the URL if possible
      raw.title = raw.title || "Google Slides Presentation";

    } else if (text) {
      raw = parsePlainText(text);
      filename = "pasted-content.txt";

    } else {
      return NextResponse.json({ error: "No file, URL, or text provided." }, { status: 400 });
    }

    const { summary, sections } = await generateScripts(raw.title, raw.sections);

    const doc: ProcessedDocument = {
      id: uuidv4(),
      filename,
      title: raw.title,
      summary,
      sections,
      totalDuration: sections.reduce((acc, s) => acc + s.duration, 0),
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ document: doc, sessionId: uuidv4() });
  } catch (err) {
    console.error("Process error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("API key") || msg.includes("API_KEY") || msg.includes("auth") || msg.includes("401") || msg.includes("403") || msg.includes("key")) {
      return NextResponse.json({ error: "Invalid or missing Gemini API key. Add GEMINI_API_KEY to .env.local — get a free key at aistudio.google.com" }, { status: 500 });
    }
    return NextResponse.json({ error: `Processing failed: ${msg}` }, { status: 500 });
  }
}
