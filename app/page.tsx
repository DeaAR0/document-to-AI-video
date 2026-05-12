"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Upload, FileText, Zap, BarChart3, MessageSquare, Play, ArrowRight, Sparkles, FolderOpen, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import HistorySidebar from "@/components/HistorySidebar";

export default function HomePage() {
  const router = useRouter();
  const setDocument = useAppStore((s) => s.setDocument);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [slidesUrl, setSlidesUrl] = useState("");
  const [isUrlProcessing, setIsUrlProcessing] = useState(false);

  const processUrl = useCallback(async () => {
    const url = slidesUrl.trim();
    if (!url) return;

    // Accept full Google Slides URL and convert to plain-text export
    // e.g. https://docs.google.com/presentation/d/SLIDE_ID/edit
    const match = url.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      setError("Paste a valid Google Slides URL (must be a public presentation).");
      return;
    }
    const slideId = match[1];
    const exportUrl = `https://docs.google.com/presentation/d/${slideId}/export/txt`;

    setIsUrlProcessing(true);
    setError(null);
    setStep("Fetching Google Slides content…");

    try {
      const formData = new FormData();
      formData.append("url", exportUrl);
      setTimeout(() => setStep("Generating AI narration scripts…"), 1500);
      setTimeout(() => setStep("Building section walkthroughs…"), 4000);

      const res = await fetch("/api/process", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Processing failed");
      setDocument(data.document, data.sessionId);
      router.push("/studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load slides. Make sure the presentation is set to public.");
      setIsUrlProcessing(false);
      setStep("");
    }
  }, [slidesUrl, router, setDocument]);

  const processFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setError(null);
      setStep("Parsing document structure…");

      const formData = new FormData();
      formData.append("file", file);

      try {
        setTimeout(() => setStep("Generating AI narration scripts…"), 1500);
        setTimeout(() => setStep("Building section walkthroughs…"), 4000);

        const res = await fetch("/api/process", { method: "POST", body: formData });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Processing failed");

        setDocument(data.document, data.sessionId);
        router.push("/studio");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setIsProcessing(false);
        setStep("");
      }
    },
    [router, setDocument]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const features = [
    { icon: FileText, title: "Multi-format Support", desc: "PDF, DOCX, PPTX, TXT — drag or click" },
    { icon: Play, title: "AI Video Walkthrough", desc: "Section-by-section guided narration" },
    { icon: MessageSquare, title: "Embedded Q&A", desc: "Document-grounded AI assistant" },
    { icon: BarChart3, title: "Engagement Analytics", desc: "Watch time, skips, questions" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => setShowHistory(true)}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            My Documents
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            <span className="font-bold text-lg tracking-tight">DocVid</span>
            <Badge variant="secondary" className="ml-1 bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
              Beta
            </Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          className="text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => router.push("/analytics")}
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          Analytics
        </Button>
      </nav>

      <HistorySidebar
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onSelect={() => router.push("/studio")}
      />

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-20 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-6"
        >
          <Zap className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-sm text-purple-300">Powered by Gemini AI</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-6xl font-bold tracking-tight max-w-3xl leading-tight"
        >
          Turn any document into a{" "}
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            guided video experience
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-5 text-lg text-white/60 max-w-xl"
        >
          Upload a PDF, Word doc, or PowerPoint. Get an AI-narrated walkthrough, an embedded assistant, and engagement analytics — in seconds.
        </motion.p>
      </section>

      {/* Upload Zone */}
      <section className="flex justify-center px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="w-full max-w-2xl"
        >
          {isProcessing ? (
            <Card className="border-purple-500/30 bg-white/5 backdrop-blur">
              <CardContent className="p-12 flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
                <p className="text-white font-medium text-lg">{step}</p>
                <p className="text-white/40 text-sm">This takes about 10–20 seconds</p>
              </CardContent>
            </Card>
          ) : (
            <label
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`block cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-all ${
                isDragging
                  ? "border-purple-400 bg-purple-500/10"
                  : "border-white/20 bg-white/5 hover:border-purple-400/60 hover:bg-white/8"
              }`}
            >
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.doc,.pptx,.ppt,.txt"
                onChange={handleFileInput}
              />
              <Upload className="w-12 h-12 mx-auto mb-4 text-purple-400" />
              <p className="text-white font-semibold text-xl mb-2">Drop your document here</p>
              <p className="text-white/50 text-sm mb-6">PDF, DOCX, PPTX, TXT supported</p>
              <Button className="bg-purple-600 hover:bg-purple-500 text-white">
                <Upload className="w-4 h-4" />
                Choose File
                <ArrowRight className="w-4 h-4" />
              </Button>
            </label>
          )}

          {/* Google Slides URL input */}
          {!isProcessing && !isUrlProcessing && (
            <div className="mt-4">
              <div className="flex items-center gap-2 text-white/30 text-xs mb-2 px-1">
                <div className="flex-1 h-px bg-white/10" />
                <span>or paste a Google Slides link</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/15 rounded-lg px-3 py-2.5">
                  <Link className="w-4 h-4 text-white/30 shrink-0" />
                  <input
                    type="url"
                    value={slidesUrl}
                    onChange={(e) => setSlidesUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && processUrl()}
                    placeholder="https://docs.google.com/presentation/d/..."
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
                  />
                </div>
                <Button
                  onClick={processUrl}
                  disabled={!slidesUrl.trim()}
                  className="bg-purple-600 hover:bg-purple-500 shrink-0"
                >
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-white/20 text-xs mt-1.5 px-1">Presentation must be set to &quot;Anyone with the link can view&quot;</p>
            </div>
          )}

          {(isUrlProcessing) && (
            <Card className="border-purple-500/30 bg-white/5 backdrop-blur mt-4">
              <CardContent className="p-8 flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
                <p className="text-white font-medium">{step}</p>
              </CardContent>
            </Card>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm text-center"
            >
              {error}
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* Features */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
            >
              <Card className="bg-white/5 border-white/10 hover:border-purple-500/30 transition-colors">
                <CardContent className="p-5">
                  <f.icon className="w-7 h-7 text-purple-400 mb-3" />
                  <p className="font-semibold text-white text-sm mb-1">{f.title}</p>
                  <p className="text-white/50 text-xs">{f.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
