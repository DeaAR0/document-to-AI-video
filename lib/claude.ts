import { GoogleGenerativeAI } from "@google/generative-ai";
import type { RawSection } from "./document-parser";
import type { DocumentSection, SlideLayout } from "./types";
import { v4 as uuidv4 } from "uuid";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

const FREE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
];

async function generateWithFallback(prompt: string): Promise<string> {
  let lastError: Error | null = null;
  for (const modelName of FREE_MODELS) {
    try {
      const m = genAI.getGenerativeModel({ model: modelName });
      const result = await m.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastError = err as Error;
      const msg = lastError.message ?? "";
      if (msg.includes("429") || msg.includes("404") || msg.includes("quota") || msg.includes("not found")) continue;
      throw lastError;
    }
  }
  throw lastError ?? new Error("All Gemini models unavailable");
}

async function chatWithFallback(
  systemInstruction: string,
  history: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>,
  message: string
): Promise<string> {
  let lastError: Error | null = null;
  for (const modelName of FREE_MODELS) {
    try {
      const m = genAI.getGenerativeModel({ model: modelName, systemInstruction });
      const chat = m.startChat({ history });
      const result = await chat.sendMessage(message);
      return result.response.text();
    } catch (err) {
      lastError = err as Error;
      const msg = lastError.message ?? "";
      if (msg.includes("429") || msg.includes("404") || msg.includes("quota") || msg.includes("not found")) continue;
      throw lastError;
    }
  }
  throw lastError ?? new Error("All Gemini models unavailable");
}

const VALID_LAYOUTS: SlideLayout[] = ["hero", "bullets", "steps", "two-column", "stat"];

export async function generateScripts(
  docTitle: string,
  rawSections: RawSection[]
): Promise<{ summary: string; sections: DocumentSection[] }> {

  // ── Pass the ENTIRE document to Gemini — no truncation by section ──
  const fullText = rawSections.map((s) => `${s.title}\n${s.content}`).join("\n\n");
  // Gemini 2.5-flash has 1M token context — send up to 30k chars safely
  const documentContent = fullText.slice(0, 30000);

  const prompt = `You are an expert professor preparing a comprehensive video lecture from a document. Your job is to teach ALL the important information to a student who has never seen this material — like a professor explaining slides to a class.

DOCUMENT TITLE: "${docTitle}"

FULL DOCUMENT CONTENT:
${documentContent}

INSTRUCTIONS:
1. Read and fully understand the entire document above
2. Identify ALL important topics, concepts, facts, figures, and arguments
3. Organize them into logical teaching sections (minimum 4, maximum 12 sections)
4. For each section write a FULL professor-style explanation that a student can actually learn from
5. The script must TEACH — not just mention. Explain WHY, HOW, and WHAT it means

Return raw JSON only (no markdown fences, no code blocks):
{
  "summary": "2-3 sentence overview of what this document teaches",
  "sections": [
    {
      "title": "Clear descriptive section title",
      "script": "150-250 word professor-style explanation. Speak directly to the student. Use phrases like 'What this means is...', 'The key thing to understand here is...', 'Notice how...', 'This is important because...'. Include ALL specific details, numbers, examples from the source. Never be vague.",
      "layout": "hero | bullets | steps | two-column | stat",
      "slidePoints": [
        {
          "heading": "2-5 word label",
          "detail": "1-2 sentences with the actual fact, number, or explanation from the document — never generic"
        }
      ]
    }
  ]
}

LAYOUT GUIDE — choose based on content type:
- "hero": introduction or single big concept — 1 big card + 2-3 supporting pills
- "bullets": list of concepts, features, requirements — 3-5 stacked cards
- "steps": process, workflow, numbered sequence — 3-5 numbered steps with connectors
- "two-column": comparison, pros vs cons, two sides — exactly 4 points (2 per column)
- "stat": numbers, percentages, metrics, data — 3-4 big stat boxes

CONTENT RULES:
- slidePoints must contain REAL information extracted from the document — no filler like "Key information" or "Important point"
- Each section needs 3-5 slidePoints
- Vary layouts — maximum 3 sections of the same layout
- Script must be comprehensive enough that a student fully understands the topic after hearing it
- Return valid JSON only`;

  const raw = (await generateWithFallback(prompt)).trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  let parsed: {
    summary: string;
    sections: Array<{
      title: string;
      script: string;
      layout?: string;
      slidePoints?: Array<{ heading: string; detail: string }>;
    }>;
  };

  try {
    parsed = JSON.parse(raw);
  } catch {
    // Hard fallback — use raw sections directly
    parsed = {
      summary: `This document covers ${rawSections.length} topics related to ${docTitle}.`,
      sections: rawSections.slice(0, 12).map((s, i) => ({
        title: s.title,
        script: `Let's examine ${s.title}. ${s.content.slice(0, 400)}`,
        layout: i === 0 ? "hero" : "bullets",
        slidePoints: [
          { heading: "Overview", detail: s.content.slice(0, 150) },
          { heading: "Key Detail", detail: s.content.slice(150, 300) || "See full content above" },
        ],
      })),
    };
  }

  const sections: DocumentSection[] = parsed.sections.map((s, i) => {
    const slidePoints = (s.slidePoints && s.slidePoints.length > 0)
      ? s.slidePoints
      : [{ heading: "Content", detail: rawSections[i]?.content.slice(0, 200) || "" }];

    const layout: SlideLayout = VALID_LAYOUTS.includes(s.layout as SlideLayout)
      ? (s.layout as SlideLayout)
      : i === 0 ? "hero" : "bullets";

    // Duration based on actual script length at ~2.5 words/sec speaking pace
    const wordCount = s.script.trim().split(/\s+/).length;
    const duration = Math.ceil(wordCount / 2.5);

    return {
      id: uuidv4(),
      index: i,
      title: s.title || rawSections[i]?.title || `Section ${i + 1}`,
      content: rawSections[i]?.content || s.script,
      script: s.script,
      keyPoints: slidePoints.map((p) => p.heading),
      slidePoints,
      layout,
      duration,
    };
  });

  return { summary: parsed.summary, sections };
}

export interface Citation {
  index: number;       // [1], [2], etc.
  sectionIndex: number;
  sectionTitle: string;
  quote: string;       // short verbatim excerpt from the source
}

export interface AnswerWithCitations {
  answer: string;      // answer text with [1] [2] markers inline
  citations: Citation[];
}

export async function answerQuestion(
  question: string,
  docContext: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  sections?: Array<{ title: string; index: number }>
): Promise<AnswerWithCitations> {
  const sectionList = sections
    ? sections.map((s, i) => `[Section ${i + 1}] "${s.title}"`).join("\n")
    : "";

  const systemInstruction = `You are an AI teaching assistant inside a video lecture platform. Help students understand the document below.

DOCUMENT CONTENT:
${docContext.slice(0, 8000)}

${sectionList ? `VIDEO SECTIONS:\n${sectionList}` : ""}

Rules:
- Answer ONLY from the document content above
- Explain clearly like a teacher
- Include specific facts, numbers, examples from the document
- If not in the document, say "That topic isn't covered in this document"
- IMPORTANT: After your answer, add citations in this exact format on a new line:
  CITATIONS: [{"index":1,"sectionIndex":0,"sectionTitle":"Section Title","quote":"exact short phrase from source max 12 words"}]
- Add [1] [2] markers inline in your answer text where each citation is used
- Use 1-3 citations maximum
- Keep answer to 2-5 sentences`;

  const history = conversationHistory.map((m) => ({
    role: m.role === "assistant" ? "model" as const : "user" as const,
    parts: [{ text: m.content }],
  }));

  const raw = await chatWithFallback(systemInstruction, history, question) || "";

  // Parse citations from response
  const citationMatch = raw.match(/CITATIONS:\s*(\[[\s\S]*?\])/);
  let citations: Citation[] = [];
  let answer = raw;

  if (citationMatch) {
    try {
      citations = JSON.parse(citationMatch[1]);
    } catch { citations = []; }
    // Remove the CITATIONS line from the visible answer
    answer = raw.slice(0, raw.indexOf("CITATIONS:")).trim();
  }

  return { answer, citations };
}
