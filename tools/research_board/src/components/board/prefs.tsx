"use client";
// Personal, per-device preferences: pinned records, private notes, saved board views and layout.
// Stored in this browser only (localStorage). Never part of the archive, never evidence.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { EntityType } from "@/lib/types";

export interface SavedView {
  id: string;
  name: string;
  types: EntityType[];
  hiddenRels: string[];
  statuses: string[];
  showPages: boolean;
}

export interface Prefs {
  pinned: string[];
  notes: Record<string, string>;
  views: SavedView[];
  showTimelineStrip: boolean;
  showFilters: boolean;
}

const DEFAULT: Prefs = { pinned: [], notes: {}, views: [], showTimelineStrip: true, showFilters: true };
const KEY = "rb-prefs-v1";

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export interface PrefsApi extends Prefs {
  togglePin: (id: string) => void;
  setNote: (id: string, text: string) => void;
  saveView: (v: Omit<SavedView, "id">) => void;
  deleteView: (id: string) => void;
  setLayout: (p: Partial<Pick<Prefs, "showTimelineStrip" | "showFilters">>) => void;
}

const PrefsContext = createContext<PrefsApi | null>(null);

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  useEffect(() => setPrefs(load()), []);
  const update = useCallback((fn: (p: Prefs) => Prefs) => {
    setPrefs((p) => {
      const next = fn(p);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable: keep in memory */ }
      return next;
    });
  }, []);
  const api: PrefsApi = {
    ...prefs,
    togglePin: (id) => update((p) => ({ ...p, pinned: p.pinned.includes(id) ? p.pinned.filter((x) => x !== id) : [id, ...p.pinned] })),
    setNote: (id, text) => update((p) => {
      const notes = { ...p.notes };
      if (text.trim()) notes[id] = text;
      else delete notes[id];
      return { ...p, notes };
    }),
    saveView: (v) => update((p) => ({ ...p, views: [...p.views.filter((x) => x.name !== v.name), { ...v, id: `view-${Date.now()}` }] })),
    deleteView: (id) => update((p) => ({ ...p, views: p.views.filter((v) => v.id !== id) })),
    setLayout: (l) => update((p) => ({ ...p, ...l })),
  };
  return <PrefsContext.Provider value={api}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs outside PrefsProvider");
  return ctx;
}
