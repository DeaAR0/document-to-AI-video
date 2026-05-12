"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  MessageSquare, Send, BarChart3, Home, Sparkles, List, X,
  Download, Loader2, FileText, FolderOpen,
} from "lucide-react";
import { generateHtmlReport } from "@/lib/report-generator";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/lib/store";
import { formatDuration } from "@/lib/utils";
import type { DocumentSection } from "@/lib/types";
import VideoCanvas from "@/components/VideoCanvas";
import HistorySidebar from "@/components/HistorySidebar";
import type { Citation } from "@/lib/claude";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

// Renders answer text with [1] [2] as clickable superscript citation markers
function CitedAnswer({ content, citations, onJump }: {
  content: string;
  citations: Citation[];
  onJump: (sectionIndex: number) => void;
}) {
  const parts = content.split(/(\[\d+\])/g);
  return (
    <span>
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match) {
          const num = parseInt(match[1]);
          const cit = citations.find((c) => c.index === num);
          if (cit) return (
            <button
              key={i}
              onClick={() => onJump(cit.sectionIndex)}
              title={`Go to: ${cit.sectionTitle}`}
              className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold rounded-full bg-purple-500/30 text-purple-300 hover:bg-purple-500/60 hover:text-white transition-colors mx-0.5 align-super leading-none"
            >
              {num}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export default function StudioPage() {
  const router = useRouter();
  const { document: doc, currentSection, isPlaying, setCurrentSection, setIsPlaying, recordEvent } = useAppStore();

  const [elapsed, setElapsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSections, setShowSections] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportDone, setExportDone] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Refs to avoid stale closures inside setInterval
  const currentSectionRef = useRef(currentSection);
  const docRef = useRef(doc);
  const pendingSeekRef = useRef<number | null>(null);
  useEffect(() => { currentSectionRef.current = currentSection; }, [currentSection]);
  useEffect(() => { docRef.current = doc; }, [doc]);

  const section = doc?.sections[currentSection] as DocumentSection | undefined;

  useEffect(() => {
    if (!doc) router.replace("/");
  }, [doc, router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // Single gate: speech onend is the ONLY thing that advances to the next section.
  // The progress timer just updates the UI bar — it never triggers section changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!section) return;

    if (isPlaying) {
      window.speechSynthesis.cancel();

      // Progress ticker — UI only
      let localElapsed = 0;
      timerRef.current = setInterval(() => {
        localElapsed += 1;
        setElapsed(localElapsed);
      }, 1000);

      // Build utterance
      const utter = new SpeechSynthesisUtterance(section.script);
      utter.rate = 0.95;
      utter.pitch = 1.05;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find((v) => v.name.includes("Google") || v.lang === "en-US");
      if (preferred) utter.voice = preferred;

      // THE gate — advance only when speech actually finishes
      utter.onend = () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        const sec = currentSectionRef.current;
        const d = docRef.current;
        setElapsed(0);
        setCompletedSections((s) => new Set([...s, sec]));
        setTimeout(() => {
          recordEvent("section_complete", sec, { sectionTitle: section.title });
          if (d && sec < d.sections.length - 1) {
            setCurrentSection(sec + 1);
          } else {
            setIsPlaying(false);
          }
        }, 0);
      };

      utteranceRef.current = utter;
      if (!isMuted) window.speechSynthesis.speak(utter);

      // If muted, fall back to timer-based advance (no speech to wait for)
      if (isMuted) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          localElapsed += 1;
          setElapsed(localElapsed);
          if (localElapsed >= section.duration) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            const sec = currentSectionRef.current;
            const d = docRef.current;
            setElapsed(0);
            setCompletedSections((s) => new Set([...s, sec]));
            setTimeout(() => {
              recordEvent("section_complete", sec, { sectionTitle: section.title });
              if (d && sec < d.sections.length - 1) {
                setCurrentSection(sec + 1);
              } else {
                setIsPlaying(false);
              }
            }, 0);
          }
        }, 1000);
      }
    } else {
      window.speechSynthesis?.cancel();
      if (utteranceRef.current) utteranceRef.current.onend = null;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }

    return () => {
      window.speechSynthesis?.cancel();
      if (utteranceRef.current) utteranceRef.current.onend = null;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [isPlaying, currentSection, section, isMuted, recordEvent, setCurrentSection, setIsPlaying]);

  useEffect(() => {
    setElapsed(0);
    setTimeout(() => {
      recordEvent("play", currentSectionRef.current, { sectionTitle: docRef.current?.sections[currentSectionRef.current]?.title });
    }, 0);
    // Apply any pending seek fraction after section change
    if (pendingSeekRef.current !== null) {
      const fraction = pendingSeekRef.current;
      pendingSeekRef.current = null;
      setTimeout(() => seekSection(fraction), 50);
    }
  }, [currentSection]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = () => {
    const next = !isPlaying;
    setIsPlaying(next);
    setTimeout(() => recordEvent(next ? "play" : "pause", currentSectionRef.current), 0);
  };

  const goToSection = (index: number) => {
    if (index !== currentSection) {
      // revisit if going back to an already-completed section
      if (completedSections.has(index)) {
        setTimeout(() => recordEvent("revisit", index, { sectionTitle: doc?.sections[index]?.title }), 0);
      } else {
        setTimeout(() => recordEvent("skip", currentSection), 0);
      }
    }
    setCurrentSection(index);
    setElapsed(0);
    setShowSections(false);
  };

  // Seek within current section (0–1 fraction)
  const seekSection = useCallback((fraction: number) => {
    if (!section) return;
    const targetElapsed = Math.floor(fraction * section.duration);
    setElapsed(targetElapsed);

    // Cancel current speech and restart from a proportional position in the script
    window.speechSynthesis?.cancel();
    if (utteranceRef.current) utteranceRef.current.onend = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    if (!isPlaying) return;

    // Slice script to start from roughly where user seeked
    const words = section.script.split(" ");
    const startWord = Math.floor(fraction * words.length);
    const partialScript = words.slice(startWord).join(" ");

    const utter = new SpeechSynthesisUtterance(partialScript);
    utter.rate = 0.95;
    utter.pitch = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) => v.name.includes("Google") || v.lang === "en-US");
    if (preferred) utter.voice = preferred;

    utter.onend = () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      const sec = currentSectionRef.current;
      const d = docRef.current;
      setElapsed(0);
      setCompletedSections((s) => new Set([...s, sec]));
      setTimeout(() => {
        recordEvent("section_complete", sec, { sectionTitle: section.title });
        if (d && sec < d.sections.length - 1) {
          setCurrentSection(sec + 1);
        } else {
          setIsPlaying(false);
        }
      }, 0);
    };

    utteranceRef.current = utter;
    if (!isMuted) window.speechSynthesis.speak(utter);

    // Restart progress ticker from targetElapsed
    let localElapsed = targetElapsed;
    timerRef.current = setInterval(() => {
      localElapsed += 1;
      setElapsed(localElapsed);
    }, 1000);
  }, [section, isPlaying, isMuted, recordEvent, setCurrentSection, setIsPlaying]);

  // Seek across entire document via the overall progress bar (0–1 fraction)
  const seekOverall = useCallback((fraction: number) => {
    if (!doc) return;
    const totalDur = doc.totalDuration;
    const targetSec = fraction * totalDur;
    let accumulated = 0;
    for (let i = 0; i < doc.sections.length; i++) {
      const dur = doc.sections[i].duration;
      if (accumulated + dur >= targetSec || i === doc.sections.length - 1) {
        const withinSection = targetSec - accumulated;
        const sectionFraction = dur > 0 ? Math.min(withinSection / dur, 1) : 0;
        if (i !== currentSection) {
          recordEvent("skip", currentSection);
          setCurrentSection(i);
          // seekSection will run after section re-renders; store fraction for next render
          pendingSeekRef.current = sectionFraction;
        } else {
          seekSection(sectionFraction);
        }
        break;
      }
      accumulated += dur;
    }
  }, [doc, currentSection, recordEvent, setCurrentSection, seekSection]);

  const skipNext = () => {
    if (!doc || currentSection >= doc.sections.length - 1) return;
    recordEvent("skip", currentSection);
    goToSection(currentSection + 1);
  };

  const skipBack = () => {
    if (currentSection > 0) goToSection(currentSection - 1);
  };

  // ── Export HTML report ───────────────────────────────────────────────
  const exportReport = useCallback(() => {
    if (!doc) return;
    const html = generateHtmlReport(doc);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.title.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}_report.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [doc]);

  // ── Export video via MediaRecorder ──────────────────────────────────
  const exportVideo = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !doc) return;

    setIsExporting(true);
    setExportProgress(0);
    setExportDone(false);
    chunksRef.current = [];

    // Pause current playback
    setIsPlaying(false);
    window.speechSynthesis?.cancel();

    // Capture canvas stream at 30fps
    const stream = canvas.captureStream(30);

    // Add audio track from Web Speech via AudioContext + oscillator (silent carrier)
    let audioCtx: AudioContext | null = null;
    try {
      audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      // Silent gain node — just to give MediaRecorder an audio track
      const gain = audioCtx.createGain();
      gain.gain.value = 0;
      gain.connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    } catch { /* audio track optional */ }

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      audioCtx?.close();
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.title.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}_docvid.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setIsExporting(false);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 4000);
    };

    recorder.start(100);

    // Render each section to canvas at speed (4s per section for export)
    const EXPORT_SECTION_DURATION = 4000; // ms
    const FPS = 30;
    const FRAME_MS = 1000 / FPS;

    for (let s = 0; s < doc.sections.length; s++) {
      setExportProgress(Math.round((s / doc.sections.length) * 100));
      const sec = doc.sections[s];
      const frames = Math.round(EXPORT_SECTION_DURATION / FRAME_MS);

      for (let f = 0; f < frames; f++) {
        const progress = f / frames;
        // Draw directly onto the canvas
        drawFrameForExport(canvas, sec, progress, s, doc.sections.length);
        await new Promise<void>((r) => setTimeout(r, FRAME_MS));
      }
    }

    setExportProgress(100);
    recorder.stop();
  }, [doc, setIsPlaying]);

  // Minimal direct-draw for export (mirrors VideoCanvas logic)
  const drawFrameForExport = (
    canvas: HTMLCanvasElement,
    sec: DocumentSection,
    progress: number,
    secIdx: number,
    totalSections: number
  ) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(t, 1), 3);

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0f0a1e");
    bg.addColorStop(1, "#1a1033");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Orbs
    const g1 = ctx.createRadialGradient(W * 0.15, H * 0.2, 0, W * 0.15, H * 0.2, 200);
    g1.addColorStop(0, "rgba(139,92,246,0.2)");
    g1.addColorStop(1, "rgba(139,92,246,0)");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);

    // Top bar
    const barGrad = ctx.createLinearGradient(0, 0, W * easeOut(progress * 8), 0);
    barGrad.addColorStop(0, "#8b5cf6");
    barGrad.addColorStop(1, "#ec4899");
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, W * Math.min(easeOut(progress * 8), 1), 4);

    // Section badge
    ctx.globalAlpha = easeOut(progress * 6);
    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = "#8b5cf6";
    ctx.fillText(`SECTION ${secIdx + 1} OF ${totalSections}`, 48, 55);
    ctx.globalAlpha = 1;

    // Title
    const titleProg = easeOut(Math.max(0, (progress - 0.08) * 5));
    ctx.globalAlpha = titleProg;
    ctx.font = "bold 36px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(sec.title.slice(0, 50), 48 + (1 - titleProg) * 40, 115);
    ctx.globalAlpha = 1;

    // Divider
    const divProg = easeOut(Math.max(0, (progress - 0.2) * 4));
    const dg = ctx.createLinearGradient(48, 0, 48 + (W - 96) * divProg, 0);
    dg.addColorStop(0, "#8b5cf6");
    dg.addColorStop(1, "rgba(139,92,246,0)");
    ctx.strokeStyle = dg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(48, 130);
    ctx.lineTo(48 + (W - 96) * divProg, 130);
    ctx.stroke();

    // Script text
    const scriptProg = easeOut(Math.max(0, (progress - 0.28) * 3));
    ctx.globalAlpha = scriptProg;
    ctx.font = "17px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    const words = sec.script.split(" ");
    let line = "";
    let y = 165;
    for (const word of words) {
      const test = line + word + " ";
      if (ctx.measureText(test).width > W - 96 && line) {
        ctx.fillText(line.trim(), 48, y);
        line = word + " ";
        y += 28;
        if (y > H - 120) break;
      } else line = test;
    }
    if (line.trim() && y <= H - 120) ctx.fillText(line.trim(), 48, y);
    ctx.globalAlpha = 1;

    // Key points
    sec.keyPoints.slice(0, 4).forEach((pt, i) => {
      const pp = easeOut(Math.max(0, (progress - 0.45 - i * 0.1) * 4));
      if (pp <= 0) return;
      const cardX = 48 + i * 210;
      const cardY = H - 130 + (1 - pp) * 20;
      ctx.globalAlpha = pp;
      ctx.fillStyle = "rgba(139,92,246,0.15)";
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 196, 68, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(139,92,246,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#8b5cf6";
      ctx.beginPath();
      ctx.arc(cardX + 14, cardY + 14, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText(pt.slice(0, 28), cardX + 10, cardY + 34);
      ctx.globalAlpha = 1;
    });

    // Progress bar
    const barY = H - 16;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.roundRect(48, barY, W - 96, 5, 3);
    ctx.fill();
    const pg = ctx.createLinearGradient(48, 0, 48 + (W - 96) * progress, 0);
    pg.addColorStop(0, "#8b5cf6");
    pg.addColorStop(1, "#ec4899");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.roundRect(48, barY, (W - 96) * progress, 5, 3);
    ctx.fill();
  };

  // Q&A
  const sendQuestion = async () => {
    if (!question.trim() || !doc || isAsking) return;
    const q = question.trim();
    setQuestion("");
    setIsAsking(true);
    recordEvent("question_asked", currentSection, { question: q });
    const docContext = doc.sections.map((s) => `${s.title}:\n${s.content}`).join("\n\n");
    const sections = doc.sections.map((s) => ({ title: s.title, index: s.index }));
    setChatHistory((h) => [...h, { role: "user", content: q }]);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, docContext, history: chatHistory.slice(-6), sections }),
      });
      const data = await res.json();
      setChatHistory((h) => [...h, {
        role: "assistant",
        content: data.answer || "Sorry, I couldn't answer that.",
        citations: data.citations || [],
      }]);
    } catch {
      setChatHistory((h) => [...h, { role: "assistant", content: "Network error. Please try again." }]);
    }
    setIsAsking(false);
  };

  if (!doc || !section) return null;

  const progressPct = section.duration > 0 ? (elapsed / section.duration) * 100 : 0;
  const overallPct = doc.sections.length > 0
    ? ((completedSections.size + progressPct / 100) / doc.sections.length) * 100
    : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white/60 hover:text-white" onClick={() => router.push("/")}>
            <Home className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white/60 hover:text-white" title="My Documents" onClick={() => setShowHistory(true)}>
            <FolderOpen className="w-4 h-4" />
          </Button>
          <Separator orientation="vertical" className="h-5 bg-white/10" />
          <div>
            <p className="font-semibold text-sm truncate max-w-xs">{doc.title}</p>
            <p className="text-white/40 text-xs">{doc.sections.length} sections · {formatDuration(doc.totalDuration)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-white/60 hover:text-white" onClick={() => setShowSections(!showSections)}>
            <List className="w-4 h-4 mr-1.5" /> Sections
          </Button>
          <Button variant="ghost" size="sm" className="text-white/60 hover:text-white" onClick={() => router.push("/analytics")}>
            <BarChart3 className="w-4 h-4 mr-1.5" /> Analytics
          </Button>
          {/* Export button */}
          <Button
            size="sm"
            variant="outline"
            className="border-white/20 text-white/70 hover:text-white hover:border-white/40 bg-transparent"
            onClick={exportVideo}
            disabled={isExporting}
          >
            {isExporting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {exportProgress}%</>
            ) : exportDone ? (
              <><Download className="w-4 h-4 text-green-400" /> Saved!</>
            ) : (
              <><Download className="w-4 h-4" /> Export MP4</>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/20 text-white/70 hover:text-white hover:border-white/40 bg-transparent"
            onClick={exportReport}
          >
            <FileText className="w-4 h-4" /> Report
          </Button>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-500" onClick={() => setShowChat(!showChat)}>
            <MessageSquare className="w-4 h-4 mr-1.5" /> Ask AI
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* ── Video canvas area ── */}
          <div className="flex-1 flex items-center justify-center bg-black p-4 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSection}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-4xl aspect-video relative"
              >
                <VideoCanvas
                  section={section}
                  isPlaying={isPlaying}
                  elapsed={elapsed}
                  totalDuration={section.duration}
                />
              </motion.div>
            </AnimatePresence>
          </div>
          {/* Hidden export canvas — outside video area so it never overlaps */}
          <canvas ref={canvasRef} width={960} height={540} style={{ position: "fixed", left: "-9999px", top: 0 }} />

          {/* History sidebar */}
          <HistorySidebar
            open={showHistory}
            onClose={() => setShowHistory(false)}
            onSelect={() => { setShowHistory(false); }}
          />

          {/* ── Player controls ── */}
          <div className="border-t border-white/10 bg-slate-900/80 backdrop-blur px-6 py-4 shrink-0">
            {/* Section scrubber */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-white/40 w-10 text-right shrink-0">{formatDuration(elapsed)}</span>
              <div
                className="flex-1 h-3 flex items-center cursor-pointer group"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  seekSection(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
                }}
              >
                <div className="relative w-full h-1.5 bg-white/10 rounded-full group-hover:h-2.5 transition-all">
                  <div
                    className="absolute left-0 top-0 h-full bg-purple-500 rounded-full"
                    style={{ width: `${progressPct}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: `calc(${progressPct}% - 6px)` }}
                  />
                </div>
              </div>
              <span className="text-xs text-white/40 w-10 shrink-0">{formatDuration(section.duration)}</span>
            </div>
            {/* Overall scrubber */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-white/30 shrink-0">Overall</span>
              <div
                className="flex-1 h-3 flex items-center cursor-pointer group"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  seekOverall(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
                }}
              >
                <div className="relative w-full h-1 bg-white/5 rounded-full group-hover:h-2 transition-all">
                  <div
                    className="absolute left-0 top-0 h-full bg-purple-500/60 rounded-full"
                    style={{ width: `${overallPct}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: `calc(${overallPct}% - 5px)` }}
                  />
                </div>
              </div>
              <span className="text-xs text-white/30 shrink-0">{Math.round(overallPct)}%</span>
            </div>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="ghost" size="icon" className="text-white/60 hover:text-white"
                onClick={() => { setIsMuted(!isMuted); if (!isMuted) window.speechSynthesis?.cancel(); }}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
              <Button variant="ghost" size="icon" className="text-white/70 hover:text-white" onClick={skipBack} disabled={currentSection === 0}>
                <SkipBack className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                className="w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-500/20"
                onClick={togglePlay}
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="text-white/70 hover:text-white" onClick={skipNext} disabled={currentSection === doc.sections.length - 1}>
                <SkipForward className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white" onClick={() => setShowChat(!showChat)}>
                <MessageSquare className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </main>

        {/* ── Sections sidebar ── */}
        <AnimatePresence>
          {showSections && (
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute right-0 top-0 bottom-0 w-72 bg-slate-900 border-l border-white/10 flex flex-col z-10"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <p className="font-semibold text-sm">All Sections</p>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-white/60" onClick={() => setShowSections(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2">
                  {doc.sections.map((sec, i) => (
                    <button
                      key={sec.id}
                      onClick={() => goToSection(i)}
                      className={`w-full text-left px-3 py-3 rounded-lg mb-1 transition-colors flex items-start gap-2.5 ${
                        i === currentSection ? "bg-purple-600/20 border border-purple-500/30" : "hover:bg-white/5"
                      }`}
                    >
                      <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${
                        completedSections.has(i) ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/50"
                      }`}>
                        {completedSections.has(i) ? "✓" : i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white/90 line-clamp-2">{sec.title}</p>
                        <p className="text-xs text-white/40 mt-0.5">{formatDuration(sec.duration)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Q&A chat panel ── */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-slate-900 border-l border-white/10 flex flex-col z-20"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-400" />
                  <p className="font-semibold text-sm">Document Q&A</p>
                </div>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-white/60" onClick={() => setShowChat(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 p-4">
                {chatHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-10">
                    <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-purple-400" />
                    </div>
                    <p className="text-white/50 text-sm">Ask anything about this document. I only answer from the source content.</p>
                    <div className="space-y-2 w-full">
                      {["What is the main objective?", "Summarize the key findings", "What are the recommendations?"].map((q) => (
                        <button key={q} onClick={() => setQuestion(q)}
                          className="w-full text-left text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white/60 transition-colors">
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-xl px-3 py-2.5 text-sm ${
                          msg.role === "user" ? "bg-purple-600 text-white" : "bg-white/10 text-white/85"
                        }`}>
                          {msg.role === "assistant" && msg.citations && msg.citations.length > 0
                            ? <CitedAnswer content={msg.content} citations={msg.citations} onJump={(idx) => goToSection(idx)} />
                            : msg.content
                          }
                          {/* Citation footnotes */}
                          {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                              {msg.citations.map((c) => (
                                <button
                                  key={c.index}
                                  onClick={() => goToSection(c.sectionIndex)}
                                  className="flex items-start gap-1.5 w-full text-left group"
                                >
                                  <span className="text-[10px] font-bold text-purple-400 mt-0.5 shrink-0 leading-none">[{c.index}]</span>
                                  <span className="text-[11px] text-white/40 group-hover:text-purple-300 transition-colors italic leading-snug">
                                    "{c.quote}" <span className="not-italic text-white/25">— {c.sectionTitle}</span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {isAsking && (
                      <div className="flex justify-start">
                        <div className="bg-white/10 rounded-xl px-3 py-2.5">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce [animation-delay:0ms]" />
                            <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce [animation-delay:150ms]" />
                            <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce [animation-delay:300ms]" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </ScrollArea>
              <div className="p-4 border-t border-white/10">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendQuestion()}
                    placeholder="Ask about this document…"
                    className="flex-1 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <Button size="icon" className="bg-purple-600 hover:bg-purple-500 shrink-0" onClick={sendQuestion} disabled={isAsking || !question.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-white/25 text-xs mt-2 text-center">Grounded in document content only</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
