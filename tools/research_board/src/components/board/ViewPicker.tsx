"use client";
import { useState } from "react";
import { Bookmark, SlidersHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefs } from "./prefs";
import { applyView, matchingView, VIEW_PRESETS, type BoardFilters } from "./useBoardView";

/** Board views: presets, your saved views, and "save current" — the main way to change what the board shows. */
export function ViewPicker({ f, onCustomize, customizing }: { f: BoardFilters; onCustomize?: () => void; customizing?: boolean }) {
  const prefs = usePrefs();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const active = matchingView(f, prefs.views);
  const chip = (on: boolean) =>
    cn("shrink-0 rounded-full border px-3 py-1 text-[12px] touchui:min-h-11 touchui:px-4 touchui:text-[14px]",
      on ? "border-zinc-200 bg-zinc-100 text-zinc-900" : "border-zinc-700 text-zinc-300 hover:border-zinc-500");
  return (
    <div className="flex flex-wrap items-center gap-1.5 touchui:flex-nowrap touchui:overflow-x-auto">
      {VIEW_PRESETS.map((v) => (
        <button key={v.id} type="button" title={v.description} className={chip(active === v.id)} onClick={() => applyView(f, v)}>{v.name}</button>
      ))}
      {prefs.views.map((v) => (
        <span key={v.id} className={cn(chip(active === v.id), "inline-flex items-center gap-1.5")}>
          <button type="button" onClick={() => applyView(f, v)} className="inline-flex items-center gap-1"><Bookmark className="size-3" />{v.name}</button>
          <button type="button" aria-label={`Delete view ${v.name}`} onClick={() => prefs.deleteView(v.id)} className="opacity-60 hover:opacity-100"><Trash2 className="size-3" /></button>
        </span>
      ))}
      {!active && !naming && (
        <button type="button" className={cn(chip(false), "border-dashed")} onClick={() => setNaming(true)}>+ Save this view</button>
      )}
      {naming && (
        <form className="inline-flex items-center gap-1" onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          prefs.saveView({ name: name.trim(), types: [...f.types], hiddenRels: [...f.hiddenRels], statuses: [...f.statuses], showPages: f.showPages });
          setName("");
          setNaming(false);
        }}>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="View name" className="h-7 w-36 rounded border border-zinc-600 bg-zinc-900 px-2 text-[12px] outline-none touchui:h-11 touchui:text-[16px]" />
          <button type="submit" className="h-7 rounded bg-zinc-200 px-2 text-[12px] text-zinc-900 touchui:h-11">Save</button>
          <button type="button" className="h-7 px-1 text-[12px] text-zinc-400 touchui:h-11" onClick={() => setNaming(false)}>Cancel</button>
        </form>
      )}
      {onCustomize && (
        <button type="button" onClick={onCustomize} className={cn(chip(!!customizing), "inline-flex items-center gap-1")}>
          <SlidersHorizontal className="size-3" /> Customize
        </button>
      )}
    </div>
  );
}
