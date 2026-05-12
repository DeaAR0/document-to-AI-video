"use client";
import { create } from "zustand";
import type { ProcessedDocument } from "./types";

export interface HistoryEntry {
  document: ProcessedDocument;
  sessionId: string;
  savedAt: string;
}

interface HistoryState {
  entries: HistoryEntry[];
  addEntry: (doc: ProcessedDocument, sessionId: string) => void;
  removeEntry: (docId: string) => void;
  clear: () => void;
  hydrate: () => void;
}

const STORAGE_KEY = "docvid_history";

function loadFromStorage(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(entries: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    // Keep max 20 entries, most recent first
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 20)));
  } catch { /* storage full — ignore */ }
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],

  hydrate: () => {
    set({ entries: loadFromStorage() });
  },

  addEntry: (doc, sessionId) => {
    const entry: HistoryEntry = { document: doc, sessionId, savedAt: new Date().toISOString() };
    // Replace if same docId already exists, otherwise prepend
    const existing = get().entries.filter((e) => e.document.id !== doc.id);
    const next = [entry, ...existing].slice(0, 20);
    set({ entries: next });
    saveToStorage(next);
  },

  removeEntry: (docId) => {
    const next = get().entries.filter((e) => e.document.id !== docId);
    set({ entries: next });
    saveToStorage(next);
  },

  clear: () => {
    set({ entries: [] });
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  },
}));
