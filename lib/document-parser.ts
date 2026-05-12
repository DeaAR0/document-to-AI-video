import mammoth from "mammoth";

export interface RawSection {
  title: string;
  content: string;
}

export async function parseDocx(buffer: Buffer): Promise<{ title: string; sections: RawSection[] }> {
  const result = await mammoth.extractRawText({ buffer });
  return splitIntoSections(result.value, "Document");
}

export async function parsePdf(buffer: Buffer): Promise<{ title: string; sections: RawSection[] }> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return splitIntoSections(data.text, "Document");
}

export async function parsePptx(buffer: Buffer): Promise<{ title: string; sections: RawSection[] }> {
  const { parseOffice } = await import("officeparser");
  const result = await parseOffice(buffer, { outputErrorToConsole: false }) as { toText?: () => string };
  const text = typeof result?.toText === "function" ? result.toText() : String(result ?? "");
  return splitIntoSections(text || "", "Presentation");
}

export function parsePlainText(text: string): { title: string; sections: RawSection[] } {
  return splitIntoSections(text, "Document");
}

function splitIntoSections(text: string, fallbackTitle: string): { title: string; sections: RawSection[] } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { title: fallbackTitle, sections: [{ title: "Content", content: text }] };

  const docTitle = lines[0].length < 120 ? lines[0] : fallbackTitle;
  const sections: RawSection[] = [];
  let currentTitle = "Introduction";
  let currentLines: string[] = [];

  // A line is a heading only if:
  // - short (< 60 chars)
  // - looks like a heading (title-case, all-caps, or numbered)
  // - the NEXT line(s) have real content (prevents treating every bullet as a heading)
  const isHeadingCandidate = (line: string, nextLine?: string): boolean => {
    if (line.length > 72) return false;
    if (line.endsWith(".") || line.endsWith(",") || line.endsWith(":")) return false;

    const titleCase = /^[A-Z][a-z]/.test(line) && line.split(" ").length <= 8;
    const allCaps = line === line.toUpperCase() && /[A-Z]/.test(line) && line.length > 3;
    const numbered = /^\d+[\.\)]\s+[A-Z]/.test(line);
    const hashMd = /^#{1,3}\s/.test(line);

    if (!titleCase && !allCaps && !numbered && !hashMd) return false;

    // Require the next line to be a real content line (> 40 chars) to confirm this is actually a heading
    if (nextLine && nextLine.length > 40) return true;
    // Or if this line is very clearly a section marker
    if (allCaps || numbered || hashMd) return true;

    return false;
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];

    if (isHeadingCandidate(line, nextLine) && currentLines.length > 0) {
      // Only create a section if we have meaningful content (> 80 chars total)
      const content = currentLines.join(" ");
      if (content.length > 80) {
        sections.push({ title: currentTitle, content });
      } else if (sections.length > 0) {
        // Merge tiny content into previous section
        sections[sections.length - 1].content += " " + content;
      }
      currentTitle = line.replace(/^#+\s*/, "").replace(/^\d+[\.\)]\s*/, "");
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Push final section
  if (currentLines.length > 0) {
    const content = currentLines.join(" ");
    if (content.length > 80 || sections.length === 0) {
      sections.push({ title: currentTitle, content });
    } else if (sections.length > 0) {
      sections[sections.length - 1].content += " " + content;
    }
  }

  // Merge sections that are too short (< 150 chars) into neighbours
  const merged: RawSection[] = [];
  for (const sec of sections) {
    if (merged.length > 0 && sec.content.length < 150) {
      merged[merged.length - 1].content += " " + sec.content;
    } else {
      merged.push(sec);
    }
  }

  // Fallback: if nothing was split, treat whole text as one section
  if (merged.length === 0) {
    return { title: docTitle, sections: [{ title: docTitle, content: text }] };
  }

  return { title: docTitle, sections: merged };
}
