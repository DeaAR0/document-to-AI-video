import type { ProcessedDocument } from "./types";

export function generateHtmlReport(doc: ProcessedDocument): string {
  const sectionCards = doc.sections.map((s, i) => {
    const points = s.slidePoints && s.slidePoints.length > 0
      ? s.slidePoints.map((p) => `
        <div class="point">
          <div class="point-heading">${escHtml(p.heading)}</div>
          <div class="point-detail">${escHtml(p.detail)}</div>
        </div>`).join("")
      : (s.keyPoints || []).map((kp) => `
        <div class="point">
          <div class="point-heading">${escHtml(kp)}</div>
        </div>`).join("");

    return `
    <div class="section-card">
      <div class="section-header">
        <span class="section-chip">SECTION ${String(i + 1).padStart(2, "0")}</span>
        <h2 class="section-title">${escHtml(s.title)}</h2>
      </div>
      <div class="section-script">${escHtml(s.script)}</div>
      <div class="points-grid">${points}</div>
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(doc.title)} — DocVid Report</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0d0d1a;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 0 0 60px;
    }
    a { color: #a78bfa; }

    /* Header */
    .report-header {
      background: linear-gradient(135deg, #1a1033 0%, #0d0d1a 100%);
      border-bottom: 1px solid rgba(139,92,246,0.2);
      padding: 48px 48px 36px;
    }
    .report-badge {
      display: inline-block;
      background: rgba(139,92,246,0.15);
      border: 1px solid rgba(139,92,246,0.35);
      color: #a78bfa;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 14px;
    }
    .report-title {
      font-size: 36px;
      font-weight: 800;
      color: #fff;
      line-height: 1.2;
      margin-bottom: 16px;
    }
    .report-summary {
      font-size: 15px;
      color: rgba(255,255,255,0.55);
      max-width: 720px;
      line-height: 1.7;
      margin-bottom: 24px;
    }
    .report-meta {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: rgba(255,255,255,0.4);
    }
    .meta-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #8b5cf6;
    }

    /* Sections */
    .sections-container {
      max-width: 900px;
      margin: 40px auto;
      padding: 0 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .section-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 14px;
      overflow: hidden;
    }
    .section-header {
      padding: 20px 24px 0;
      border-left: 4px solid #8b5cf6;
    }
    .section-chip {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #a78bfa;
      background: rgba(139,92,246,0.12);
      border: 1px solid rgba(139,92,246,0.25);
      padding: 2px 10px;
      border-radius: 20px;
      margin-bottom: 8px;
    }
    .section-title {
      font-size: 20px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 12px;
    }
    .section-script {
      font-size: 14px;
      color: rgba(255,255,255,0.45);
      line-height: 1.7;
      padding: 0 24px 16px;
      font-style: italic;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .points-grid {
      padding: 16px 24px 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .point {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 8px;
      padding: 12px 14px;
      border-left: 3px solid #8b5cf6;
    }
    .point:nth-child(2) { border-left-color: #ec4899; }
    .point:nth-child(3) { border-left-color: #38bdf8; }
    .point:nth-child(4) { border-left-color: #34d399; }
    .point:nth-child(5) { border-left-color: #f59e0b; }
    .point-heading {
      font-size: 13px;
      font-weight: 700;
      color: #a78bfa;
      margin-bottom: 4px;
    }
    .point:nth-child(2) .point-heading { color: #f9a8d4; }
    .point:nth-child(3) .point-heading { color: #7dd3fc; }
    .point:nth-child(4) .point-heading { color: #6ee7b7; }
    .point:nth-child(5) .point-heading { color: #fcd34d; }
    .point-detail {
      font-size: 13px;
      color: rgba(255,255,255,0.7);
      line-height: 1.6;
    }

    /* Footer */
    .report-footer {
      text-align: center;
      padding: 40px 24px 0;
      font-size: 12px;
      color: rgba(255,255,255,0.2);
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div class="report-badge">DocVid — Generated Report</div>
    <h1 class="report-title">${escHtml(doc.title)}</h1>
    <p class="report-summary">${escHtml(doc.summary)}</p>
    <div class="report-meta">
      <div class="meta-item"><span class="meta-dot"></span>${doc.sections.length} sections</div>
      <div class="meta-item"><span class="meta-dot"></span>${formatDur(doc.totalDuration)} total runtime</div>
      <div class="meta-item"><span class="meta-dot"></span>Generated ${new Date(doc.createdAt).toLocaleDateString()}</div>
    </div>
  </div>

  <div class="sections-container">
    ${sectionCards}
  </div>

  <div class="report-footer">Generated by DocVid · AI Document-to-Video Platform</div>
</body>
</html>`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDur(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
