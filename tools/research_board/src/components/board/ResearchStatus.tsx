"use client";
import { useState } from "react";
import { Activity, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TERMINAL_DECISIONS } from "./constants";
import { EntityChip } from "./bits";
import { useBoard } from "./context";

function ago(iso: string | null | undefined) {
  if (!iso) return "unknown";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

/**
 * Research activity derived from the archive at sync time: latest run log, newest source,
 * latest finding (from the run log's FINDINGS section) and open review items. Nothing is hard-coded.
 */
export function ResearchStatus({ variant }: { variant: "bar" | "card" }) {
  const { idx } = useBoard();
  const r = idx.bundle.meta.research;
  const awaiting = idx.bundle.inbox.filter((i) => !TERMINAL_DECISIONS.has(i.status)).length;
  const [open, setOpen] = useState(variant === "card");
  const lastUpdate = r.lastRun?.at ?? r.registersChangedAt;

  const details = (
    <div className={cn("grid gap-2", variant === "bar" ? "grid-cols-[150px_1fr] text-[11px]" : "text-[14px]")}>
      <span className="text-zinc-500">Last research update</span>
      <span className="text-zinc-200">
        {ago(lastUpdate)}{r.lastRun && <span className="text-zinc-500"> · {r.lastRun.id}</span>}
        {r.registersChangedAt && <span className="block text-zinc-500">registers last changed {ago(r.registersChangedAt)}</span>}
      </span>
      <span className="text-zinc-500">Latest source added</span>
      <span>{r.latestSource ? <EntityChip id={r.latestSource.id} note={ago(r.latestSource.at)} /> : <span className="italic text-zinc-500">none recorded</span>}</span>
      <span className="text-zinc-500">Latest finding</span>
      <span className="text-zinc-300">
        {r.latestFinding ? (
          <>
            <span className="wrap-anywhere">{r.latestFinding.text}</span>
            <span className="mt-0.5 block text-[11px] text-zinc-500 touchui:text-[12px]">{r.latestFinding.origin}</span>
            {r.latestFinding.recordIds.length > 0 && <span className="mt-1 flex flex-col items-start gap-1">{r.latestFinding.recordIds.slice(0, 4).map((id) => <EntityChip key={id} id={id} />)}</span>}
          </>
        ) : <span className="italic text-zinc-500">No finding recorded yet.</span>}
      </span>
      <span className="text-zinc-500">Awaiting review</span>
      <span className="text-zinc-200">{awaiting} item{awaiting === 1 ? "" : "s"}</span>
    </div>
  );

  if (variant === "card") {
    return (
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3.5">
        <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-zinc-400"><Activity className="size-4" /> Research status</h2>
        {details}
      </section>
    );
  }
  return (
    <div className="border-b border-zinc-800 bg-zinc-950 px-3 text-[11px] text-zinc-400">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 py-1 text-left">
        <Activity className="size-3 text-emerald-400" />
        <span>Last research update <b className="font-medium text-zinc-200">{ago(lastUpdate)}</b></span>
        {r.latestSource && <span className="truncate">· Latest source <b className="font-medium text-zinc-200">{r.latestSource.title}</b></span>}
        <span className="shrink-0">· {awaiting} awaiting review</span>
        <ChevronDown className={cn("ml-auto size-3 shrink-0 transition-transform", !open && "-rotate-90")} />
      </button>
      {open && <div className="pb-2">{details}</div>}
    </div>
  );
}
