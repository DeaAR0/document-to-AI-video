"use client";

import { useEffect, useRef } from "react";
import type { DocumentSection, SlideLayout } from "@/lib/types";

interface VideoCanvasProps {
  section: DocumentSection;
  isPlaying: boolean;
  elapsed: number;
  totalDuration: number;
}

// ── Palette ──────────────────────────────────────────────────────────
const P = {
  bg:       "#0d0d1a",
  purple:   "#8b5cf6",
  pink:     "#ec4899",
  blue:     "#38bdf8",
  green:    "#34d399",
  amber:    "#f59e0b",
  red:      "#f87171",
  white:    "#ffffff",
  dim:      "rgba(255,255,255,0.60)",
  faint:    "rgba(255,255,255,0.08)",
  card:     "rgba(255,255,255,0.04)",
  border:   "rgba(255,255,255,0.08)",
};

const ACCENTS = [P.purple, P.pink, P.blue, P.green, P.amber, P.red];

function ease(t: number) { return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3); }
function easeIn(t: number) { return Math.pow(Math.min(Math.max(t, 0), 1), 2); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * Math.min(Math.max(t, 0), 1); }

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function lines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; }
    else line = t;
  }
  if (line) out.push(line);
  return out;
}

// ── Shared background ────────────────────────────────────────────────
function drawBg(ctx: CanvasRenderingContext2D, W: number, H: number, hue: string) {
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);
  const g1 = ctx.createRadialGradient(W * 0.1, H * 0.1, 0, W * 0.1, H * 0.1, W * 0.6);
  g1.addColorStop(0, hue + "22"); g1.addColorStop(1, "transparent");
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(W * 0.9, H * 0.9, 0, W * 0.9, H * 0.9, W * 0.5);
  g2.addColorStop(0, P.blue + "14"); g2.addColorStop(1, "transparent");
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
}

// ── Shared header (chip + title + divider) ───────────────────────────
function drawHeader(
  ctx: CanvasRenderingContext2D,
  section: DocumentSection,
  p: number,
  W: number,
  PAD: number,
  titleSize = 34
): number {
  // Chip
  ctx.save();
  ctx.globalAlpha = ease(p * 9);
  ctx.font = "bold 11px Inter, sans-serif";
  const chip = `SECTION ${String(section.index + 1).padStart(2, "0")}`;
  const cw = ctx.measureText(chip).width + 20;
  rr(ctx, PAD, 24, cw, 22, 11);
  ctx.fillStyle = "rgba(139,92,246,0.18)"; ctx.fill();
  ctx.strokeStyle = "rgba(139,92,246,0.4)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#a78bfa"; ctx.fillText(chip, PAD + 10, 39);
  ctx.restore();

  // Title
  const tprog = ease(Math.max(0, (p - 0.05) * 7));
  ctx.save();
  ctx.globalAlpha = tprog;
  ctx.font = `bold ${titleSize}px Inter, sans-serif`;
  ctx.fillStyle = P.white;
  const tlines = lines(ctx, section.title, W - PAD * 2);
  tlines.slice(0, 2).forEach((l, i) => ctx.fillText(l, PAD + lerp(36, 0, tprog), 76 + i * (titleSize + 8)));
  ctx.restore();

  const titleBottom = 76 + Math.min(tlines.length, 2) * (titleSize + 8);

  // Divider
  const dp = ease(Math.max(0, (p - 0.14) * 6));
  const dg = ctx.createLinearGradient(PAD, 0, PAD + (W - PAD * 2) * dp, 0);
  dg.addColorStop(0, P.purple); dg.addColorStop(0.5, P.pink); dg.addColorStop(1, "transparent");
  ctx.strokeStyle = dg; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PAD, titleBottom + 6); ctx.lineTo(PAD + (W - PAD * 2) * dp, titleBottom + 6); ctx.stroke();

  return titleBottom + 16;
}

// ── Shared footer (progress bar + watermark) ─────────────────────────
function drawFooter(ctx: CanvasRenderingContext2D, p: number, W: number, H: number, PAD: number) {
  const by = H - 12;
  ctx.fillStyle = P.faint; rr(ctx, PAD, by, W - PAD * 2, 4, 2); ctx.fill();
  const fg = ctx.createLinearGradient(PAD, 0, PAD + (W - PAD * 2) * p, 0);
  fg.addColorStop(0, P.purple); fg.addColorStop(1, P.pink);
  ctx.fillStyle = fg; rr(ctx, PAD, by, (W - PAD * 2) * Math.min(p, 1), 4, 2); ctx.fill();
  ctx.save(); ctx.globalAlpha = 0.18; ctx.font = "bold 11px Inter, sans-serif";
  ctx.fillStyle = P.white; ctx.fillText("DocVid", W - PAD - 36, H - 18); ctx.restore();
}

// ── Left stripe ───────────────────────────────────────────────────────
function drawStripe(ctx: CanvasRenderingContext2D, p: number, H: number, c1 = P.purple, c2 = P.pink) {
  const sg = ctx.createLinearGradient(0, 0, 0, H * ease(p * 7));
  sg.addColorStop(0, c1); sg.addColorStop(1, c2);
  ctx.fillStyle = sg; ctx.fillRect(0, 0, 5, H * ease(p * 7));
}

// ═══════════════════════════════════════════════════════════════════════
// LAYOUT 1: HERO — big statement + supporting pills
// ═══════════════════════════════════════════════════════════════════════
function drawHero(ctx: CanvasRenderingContext2D, section: DocumentSection, p: number, W: number, H: number) {
  const PAD = 56;
  drawBg(ctx, W, H, P.purple);
  drawStripe(ctx, p, H);

  // Big decorative circle top-right
  ctx.save(); ctx.globalAlpha = ease(p * 4) * 0.12;
  ctx.beginPath(); ctx.arc(W - 80, 80, 140, 0, Math.PI * 2);
  const cg = ctx.createRadialGradient(W - 80, 80, 0, W - 80, 80, 140);
  cg.addColorStop(0, P.purple); cg.addColorStop(1, "transparent");
  ctx.fillStyle = cg; ctx.fill(); ctx.restore();

  const contentY = drawHeader(ctx, section, p, W, PAD, 38);

  const pts = section.slidePoints.slice(0, 4);
  const firstPt = pts[0];

  // Hero statement box
  const heroP = ease(Math.max(0, (p - 0.2) * 4));
  if (firstPt) {
    ctx.save(); ctx.globalAlpha = heroP;
    const boxY = contentY + 8;
    const boxH = 80;
    rr(ctx, PAD, boxY, W - PAD * 2, boxH, 12);
    const bg = ctx.createLinearGradient(PAD, boxY, W - PAD * 2, boxY + boxH);
    bg.addColorStop(0, "rgba(139,92,246,0.18)"); bg.addColorStop(1, "rgba(236,72,153,0.08)");
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = "rgba(139,92,246,0.3)"; ctx.lineWidth = 1; ctx.stroke();

    ctx.font = "bold 18px Inter, sans-serif"; ctx.fillStyle = P.white;
    ctx.fillText(firstPt.heading, PAD + 20, boxY + 28);
    ctx.font = "14px Inter, sans-serif"; ctx.fillStyle = P.dim;
    const dl = lines(ctx, firstPt.detail, W - PAD * 2 - 40);
    dl.slice(0, 2).forEach((l, i) => ctx.fillText(l, PAD + 20, boxY + 50 + i * 20));
    ctx.restore();
  }

  // Supporting pills row
  pts.slice(1).forEach((pt, i) => {
    const pd = ease(Math.max(0, (p - 0.35 - i * 0.1) * 5));
    if (pd <= 0) return;
    const pillW = (W - PAD * 2 - 16) / 3;
    const pillX = PAD + i * (pillW + 8);
    const pillY = contentY + 110;
    const accent = ACCENTS[(i + 1) % ACCENTS.length];

    ctx.save(); ctx.globalAlpha = pd;
    rr(ctx, pillX + lerp(20, 0, pd), pillY, pillW, 90, 10);
    ctx.fillStyle = P.card; ctx.fill();
    ctx.strokeStyle = accent + "40"; ctx.lineWidth = 1; ctx.stroke();

    // accent top bar
    rr(ctx, pillX + lerp(20, 0, pd), pillY, pillW, 4, 2);
    ctx.fillStyle = accent; ctx.fill();

    ctx.font = "bold 13px Inter, sans-serif"; ctx.fillStyle = accent;
    ctx.fillText(pt.heading.slice(0, 22), pillX + lerp(20, 0, pd) + 12, pillY + 26);
    ctx.font = "12px Inter, sans-serif"; ctx.fillStyle = P.dim;
    const dl2 = lines(ctx, pt.detail, pillW - 24);
    dl2.slice(0, 3).forEach((l, li) => ctx.fillText(l, pillX + lerp(20, 0, pd) + 12, pillY + 44 + li * 17));
    ctx.restore();
  });

  drawFooter(ctx, p, W, H, PAD);
}

// ═══════════════════════════════════════════════════════════════════════
// LAYOUT 2: BULLETS — standard knowledge cards stacked
// ═══════════════════════════════════════════════════════════════════════
function drawBullets(ctx: CanvasRenderingContext2D, section: DocumentSection, p: number, W: number, H: number) {
  const PAD = 52;
  drawBg(ctx, W, H, P.purple);
  drawStripe(ctx, p, H);
  const contentY = drawHeader(ctx, section, p, W, PAD, 32);

  const pts = section.slidePoints.slice(0, 5);
  const count = pts.length;
  const areaH = H - contentY - 36;
  const cardH = Math.min(74, Math.floor((areaH - (count - 1) * 8) / count));

  pts.forEach((pt, i) => {
    const pd = ease(Math.max(0, (p - 0.2 - i * 0.11) * 6));
    if (pd <= 0) return;
    const cy = contentY + i * (cardH + 8);
    const cx = PAD + lerp(28, 0, pd);
    const accent = ACCENTS[i % ACCENTS.length];

    ctx.save(); ctx.globalAlpha = pd;
    rr(ctx, cx, cy, W - PAD * 2, cardH, 9);
    ctx.fillStyle = P.card; ctx.fill();
    ctx.strokeStyle = P.border; ctx.lineWidth = 1; ctx.stroke();
    // accent left bar
    rr(ctx, cx, cy, 4, cardH, 2); ctx.fillStyle = accent; ctx.fill();

    const inner = cx + 18;
    if (cardH >= 56 && pt.detail) {
      ctx.font = "bold 13px Inter, sans-serif"; ctx.fillStyle = accent;
      ctx.fillText(pt.heading, inner, cy + 22);
      ctx.font = "13px Inter, sans-serif"; ctx.fillStyle = P.dim;
      const dl = lines(ctx, pt.detail, W - PAD * 2 - 28);
      const lh = 18; const maxL = Math.floor((cardH - 32) / lh);
      dl.slice(0, Math.max(maxL, 1)).forEach((l, li) => ctx.fillText(l, inner, cy + 40 + li * lh));
    } else {
      ctx.font = "bold 14px Inter, sans-serif"; ctx.fillStyle = P.white;
      ctx.fillText(pt.heading, inner, cy + cardH / 2 + 5);
    }
    ctx.restore();
  });

  drawFooter(ctx, p, W, H, PAD);
}

// ═══════════════════════════════════════════════════════════════════════
// LAYOUT 3: STEPS — numbered process flow with connectors
// ═══════════════════════════════════════════════════════════════════════
function drawSteps(ctx: CanvasRenderingContext2D, section: DocumentSection, p: number, W: number, H: number) {
  const PAD = 52;
  drawBg(ctx, W, H, P.blue);
  drawStripe(ctx, p, H, P.blue, P.purple);
  const contentY = drawHeader(ctx, section, p, W, PAD, 30);

  const pts = section.slidePoints.slice(0, 5);
  const count = pts.length;
  const areaH = H - contentY - 40;
  const stepH = Math.min(70, Math.floor((areaH - (count - 1) * 6) / count));
  const numR = 18;

  pts.forEach((pt, i) => {
    const pd = ease(Math.max(0, (p - 0.18 - i * 0.12) * 6));
    if (pd <= 0) return;
    const cy = contentY + i * (stepH + 6);
    const numX = PAD + numR;
    const numY = cy + stepH / 2;
    const accent = ACCENTS[i % ACCENTS.length];

    ctx.save(); ctx.globalAlpha = pd;

    // Connector line to next step
    if (i < count - 1) {
      ctx.strokeStyle = accent + "30"; ctx.lineWidth = 2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(numX, numY + numR); ctx.lineTo(numX, numY + stepH / 2 + 6 + numR);
      ctx.stroke(); ctx.setLineDash([]);
    }

    // Number circle
    ctx.beginPath(); ctx.arc(numX, numY, numR, 0, Math.PI * 2);
    const ng = ctx.createRadialGradient(numX, numY, 0, numX, numY, numR);
    ng.addColorStop(0, accent + "55"); ng.addColorStop(1, accent + "22");
    ctx.fillStyle = ng; ctx.fill();
    ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = "bold 13px Inter, sans-serif"; ctx.fillStyle = P.white; ctx.textAlign = "center";
    ctx.fillText(String(i + 1), numX, numY + 5);
    ctx.textAlign = "left";

    // Content card
    const cardX = PAD + numR * 2 + 12;
    const cardW = W - PAD - cardX;
    rr(ctx, cardX, cy, cardW, stepH, 9);
    ctx.fillStyle = P.card; ctx.fill();
    ctx.strokeStyle = accent + "30"; ctx.lineWidth = 1; ctx.stroke();

    ctx.font = "bold 13px Inter, sans-serif"; ctx.fillStyle = accent;
    ctx.fillText(pt.heading, cardX + 14, cy + 22);
    if (pt.detail && stepH >= 50) {
      ctx.font = "12px Inter, sans-serif"; ctx.fillStyle = P.dim;
      const dl = lines(ctx, pt.detail, cardW - 28);
      dl.slice(0, 2).forEach((l, li) => ctx.fillText(l, cardX + 14, cy + 38 + li * 17));
    }
    ctx.restore();
  });

  drawFooter(ctx, p, W, H, PAD);
}

// ═══════════════════════════════════════════════════════════════════════
// LAYOUT 4: TWO-COLUMN — comparison / pros & cons
// ═══════════════════════════════════════════════════════════════════════
function drawTwoColumn(ctx: CanvasRenderingContext2D, section: DocumentSection, p: number, W: number, H: number) {
  const PAD = 52;
  drawBg(ctx, W, H, P.pink);
  drawStripe(ctx, p, H, P.pink, P.purple);
  const contentY = drawHeader(ctx, section, p, W, PAD, 30);

  const pts = section.slidePoints.slice(0, 4);
  const colW = (W - PAD * 2 - 16) / 2;
  const areaH = H - contentY - 40;
  const cardH = Math.min(100, Math.floor((areaH - 8) / 2));

  // Column labels
  const leftLabel = pts[0]?.heading ? "Key Points" : "Left";
  const rightLabel = pts[1]?.heading ? "Details" : "Right";
  const labelP = ease(Math.max(0, (p - 0.15) * 6));
  ctx.save(); ctx.globalAlpha = labelP;
  ctx.font = "bold 11px Inter, sans-serif"; ctx.letterSpacing = "0.08em";

  // Left col header
  const lhx = PAD;
  rr(ctx, lhx, contentY, colW, 26, 6);
  ctx.fillStyle = P.purple + "30"; ctx.fill();
  ctx.fillStyle = P.purple; ctx.fillText("▌  CONCEPT", lhx + 10, contentY + 17);

  // Right col header
  const rhx = PAD + colW + 16;
  rr(ctx, rhx, contentY, colW, 26, 6);
  ctx.fillStyle = P.pink + "30"; ctx.fill();
  ctx.fillStyle = P.pink; ctx.fillText("▌  APPLICATION", rhx + 10, contentY + 17);
  ctx.restore();
  void leftLabel; void rightLabel;

  // Cards: left col = pts 0,2 / right col = pts 1,3
  [[0, 2], [1, 3]].forEach((idxs, col) => {
    const colX = PAD + col * (colW + 16);
    const colAccent = col === 0 ? P.purple : P.pink;
    idxs.forEach((ptIdx, row) => {
      const pt = pts[ptIdx];
      if (!pt) return;
      const pd = ease(Math.max(0, (p - 0.25 - ptIdx * 0.1) * 5));
      if (pd <= 0) return;
      const cy = contentY + 34 + row * (cardH + 8) + lerp(16, 0, pd);
      ctx.save(); ctx.globalAlpha = pd;
      rr(ctx, colX, cy, colW, cardH, 10);
      ctx.fillStyle = P.card; ctx.fill();
      ctx.strokeStyle = colAccent + "35"; ctx.lineWidth = 1; ctx.stroke();
      rr(ctx, colX, cy, 4, cardH, 2); ctx.fillStyle = colAccent; ctx.fill();

      ctx.font = "bold 13px Inter, sans-serif"; ctx.fillStyle = colAccent;
      ctx.fillText(pt.heading.slice(0, 26), colX + 14, cy + 22);
      ctx.font = "12px Inter, sans-serif"; ctx.fillStyle = P.dim;
      const dl = lines(ctx, pt.detail, colW - 22);
      const maxL = Math.floor((cardH - 30) / 17);
      dl.slice(0, Math.max(maxL, 1)).forEach((l, li) => ctx.fillText(l, colX + 14, cy + 38 + li * 17));
      ctx.restore();
    });
  });

  drawFooter(ctx, p, W, H, PAD);
}

// ═══════════════════════════════════════════════════════════════════════
// LAYOUT 5: STAT — big numbers / metrics
// ═══════════════════════════════════════════════════════════════════════
function drawStat(ctx: CanvasRenderingContext2D, section: DocumentSection, p: number, W: number, H: number) {
  const PAD = 52;
  drawBg(ctx, W, H, P.green);
  drawStripe(ctx, p, H, P.green, P.blue);
  const contentY = drawHeader(ctx, section, p, W, PAD, 30);

  const pts = section.slidePoints.slice(0, 4);
  const count = pts.length;
  const statW = (W - PAD * 2 - (count - 1) * 14) / count;
  const statH = H - contentY - 48;

  pts.forEach((pt, i) => {
    const pd = ease(Math.max(0, (p - 0.2 - i * 0.12) * 5));
    if (pd <= 0) return;
    const sx = PAD + i * (statW + 14);
    const sy = contentY + lerp(20, 0, pd);
    const accent = ACCENTS[i % ACCENTS.length];

    ctx.save(); ctx.globalAlpha = pd;

    // Card
    rr(ctx, sx, sy, statW, statH, 12);
    const cg = ctx.createLinearGradient(sx, sy, sx, sy + statH);
    cg.addColorStop(0, accent + "18"); cg.addColorStop(1, P.bg);
    ctx.fillStyle = cg; ctx.fill();
    ctx.strokeStyle = accent + "40"; ctx.lineWidth = 1; ctx.stroke();

    // Big stat/heading — extract number if present
    const numMatch = pt.heading.match(/[\d,.%$+\-x×]+/);
    const bigText = numMatch ? numMatch[0] : pt.heading.slice(0, 6);
    const restText = numMatch ? pt.heading.replace(numMatch[0], "").trim() : "";

    // Animated number reveal
    const numSize = bigText.length <= 5 ? 42 : 30;
    ctx.font = `bold ${numSize}px Inter, sans-serif`;
    ctx.fillStyle = accent;
    const textW2 = ctx.measureText(bigText).width;
    ctx.fillText(bigText, sx + (statW - textW2) / 2, sy + statH * 0.42);

    if (restText) {
      ctx.font = "bold 12px Inter, sans-serif"; ctx.fillStyle = P.dim;
      const rw = ctx.measureText(restText).width;
      ctx.fillText(restText, sx + (statW - rw) / 2, sy + statH * 0.42 + 18);
    }

    // Detail text below
    ctx.font = "12px Inter, sans-serif"; ctx.fillStyle = P.dim;
    const dl = lines(ctx, pt.detail, statW - 20);
    const startY = sy + statH * 0.58;
    dl.slice(0, 3).forEach((l, li) => {
      const lw = ctx.measureText(l).width;
      ctx.fillText(l, sx + (statW - lw) / 2, startY + li * 17);
    });

    // Bottom accent line
    rr(ctx, sx, sy + statH - 4, statW, 4, 2); ctx.fillStyle = accent; ctx.fill();
    ctx.restore();
  });

  drawFooter(ctx, p, W, H, PAD);
  void easeIn;
}

// ═══════════════════════════════════════════════════════════════════════
// Master draw dispatcher
// ═══════════════════════════════════════════════════════════════════════
function drawFrame(canvas: HTMLCanvasElement, section: DocumentSection, progress: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  const layout: SlideLayout = section.layout || "bullets";

  switch (layout) {
    case "hero":       drawHero(ctx, section, progress, W, H); break;
    case "steps":      drawSteps(ctx, section, progress, W, H); break;
    case "two-column": drawTwoColumn(ctx, section, progress, W, H); break;
    case "stat":       drawStat(ctx, section, progress, W, H); break;
    default:           drawBullets(ctx, section, progress, W, H); break;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// React component
// ═══════════════════════════════════════════════════════════════════════
export default function VideoCanvas({ section, isPlaying, elapsed, totalDuration }: VideoCanvasProps) {
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const rafRef           = useRef<number | null>(null);
  const elapsedAtTickRef = useRef(elapsed);
  const tickWallTimeRef  = useRef(performance.now());

  useEffect(() => {
    elapsedAtTickRef.current = elapsed;
    tickWallTimeRef.current  = performance.now();
  }, [elapsed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!isPlaying) {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      drawFrame(canvas, section, totalDuration > 0 ? Math.min(elapsed / totalDuration, 1) : 0);
      return;
    }

    const loop = (now: number) => {
      const frac = (now - tickWallTimeRef.current) / 1000;
      const vis  = elapsedAtTickRef.current + frac;
      drawFrame(canvas, section, totalDuration > 0 ? Math.min(vis / totalDuration, 1) : 0);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
  }, [isPlaying, section, elapsed, totalDuration]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) drawFrame(canvas, section, 0);
  }, [section]);

  return (
    <canvas
      ref={canvasRef}
      width={960}
      height={540}
      className="w-full h-full object-contain rounded-xl"
      style={{ background: P.bg }}
    />
  );
}
