"use client";
import { create } from "zustand";
import type { ProcessedDocument, AnalyticsEvent } from "./types";

interface AppState {
  document: ProcessedDocument | null;
  sessionId: string | null;
  currentSection: number;
  isPlaying: boolean;
  events: AnalyticsEvent[];

  setDocument: (doc: ProcessedDocument, sessionId: string) => void;
  setCurrentSection: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;
  recordEvent: (type: AnalyticsEvent["type"], sectionIndex?: number, payload?: Record<string, unknown>) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  document: null,
  sessionId: null,
  currentSection: 0,
  isPlaying: false,
  events: [],

  setDocument: (doc, sessionId) => {
    set({ document: doc, sessionId, currentSection: 0, events: [] });
    // Auto-save to history (dynamic import avoids circular dep)
    import("./history-store").then(({ useHistoryStore }) => {
      useHistoryStore.getState().addEntry(doc, sessionId);
    }).catch(() => {});
  },
  setCurrentSection: (index) => set({ currentSection: index }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  recordEvent: (type, sectionIndex, payload) => {
    const { sessionId, document } = get();
    if (!sessionId || !document) return;
    const event: AnalyticsEvent = {
      sessionId,
      docId: document.id,
      type,
      sectionIndex,
      timestamp: Date.now(),
      payload,
    };
    set((s) => ({ events: [...s.events, event] }));
    // Fire-and-forget to analytics endpoint
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }).catch(() => {});
  },

  reset: () => set({ document: null, sessionId: null, currentSection: 0, isPlaying: false, events: [] }),
}));
