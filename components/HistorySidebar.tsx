"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Play, Trash2, X, FolderOpen, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useHistoryStore } from "@/lib/history-store";
import { useAppStore } from "@/lib/store";
import { formatDuration } from "@/lib/utils";

interface HistorySidebarProps {
  open: boolean;
  onClose: () => void;
  onSelect?: () => void; // called after loading a doc (e.g. navigate to /studio)
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function fileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  const colors: Record<string, string> = {
    pdf: "text-red-400", docx: "text-blue-400", doc: "text-blue-400",
    pptx: "text-orange-400", ppt: "text-orange-400", txt: "text-white/40",
  };
  return colors[ext ?? ""] ?? "text-white/40";
}

export default function HistorySidebar({ open, onClose, onSelect }: HistorySidebarProps) {
  const { entries, removeEntry, hydrate } = useHistoryStore();
  const { setDocument } = useAppStore();
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage on first render
  useEffect(() => {
    if (!hydrated) { hydrate(); setHydrated(true); }
  }, [hydrate, hydrated]);

  const loadDoc = (entry: typeof entries[0]) => {
    setDocument(entry.document, entry.sessionId);
    onClose();
    onSelect?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 bottom-0 w-80 bg-slate-900 border-r border-white/10 flex flex-col z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-purple-400" />
                <span className="font-semibold text-white">My Documents</span>
              </div>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-white/50 hover:text-white" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* List */}
            <ScrollArea className="flex-1">
              {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                    <FolderOpen className="w-6 h-6 text-white/20" />
                  </div>
                  <p className="text-white/30 text-sm">No documents yet. Upload one to get started.</p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {entries.map((entry) => (
                    <div
                      key={entry.document.id}
                      className="group relative bg-white/4 hover:bg-white/8 border border-white/8 hover:border-purple-500/30 rounded-xl p-3.5 transition-all cursor-pointer"
                      onClick={() => loadDoc(entry)}
                    >
                      {/* File type icon + title */}
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          <FileText className={`w-5 h-5 ${fileIcon(entry.document.filename)}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white/90 truncate leading-tight">
                            {entry.document.title}
                          </p>
                          <p className="text-xs text-white/35 truncate mt-0.5">
                            {entry.document.filename}
                          </p>
                        </div>
                        {/* Delete button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); removeEntry(entry.document.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-red-400 text-white/30 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-3 mt-2.5 ml-8">
                        <span className="flex items-center gap-1 text-xs text-white/30">
                          <Clock className="w-3 h-3" />
                          {formatDuration(entry.document.totalDuration)}
                        </span>
                        <span className="text-xs text-white/20">·</span>
                        <span className="text-xs text-white/30">
                          {entry.document.sections.length} sections
                        </span>
                        <span className="text-xs text-white/20">·</span>
                        <span className="text-xs text-white/30">
                          {timeAgo(entry.savedAt)}
                        </span>
                      </div>

                      {/* Play overlay hint */}
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="bg-purple-600/80 rounded-full p-2">
                          <Play className="w-4 h-4 text-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Footer */}
            {entries.length > 0 && (
              <div className="p-4 border-t border-white/10 shrink-0">
                <p className="text-xs text-white/20 text-center">
                  {entries.length} document{entries.length !== 1 ? "s" : ""} saved locally
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
