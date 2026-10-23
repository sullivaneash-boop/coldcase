"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntityType } from "@/lib/types";
import { CLAIM_STATUS_META, TYPE_META } from "./constants";
import { useBoard } from "./context";

export function TypeIcon({ type, className }: { type: EntityType; className?: string }) {
  const Icon = TYPE_META[type].icon;
  return <Icon className={cn("size-3.5 shrink-0", className)} style={{ color: TYPE_META[type].color }} />;
}

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const s = status || "UNKNOWN";
  const meta = CLAIM_STATUS_META[s] ?? CLAIM_STATUS_META.UNKNOWN;
  return (
    <span title={meta.caveat} className={cn("inline-flex items-center rounded border px-1.5 py-px font-mono text-[10px] tracking-wide touchui:text-[11px]", meta.cls, className)}>
      {s}
    </span>
  );
}

export function Tag({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("wrap-anywhere inline-flex items-center rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-px font-mono text-[10px] text-zinc-300 touchui:py-0.5 touchui:text-[12px]", className)}>
      {children}
    </span>
  );
}

/** Clickable reference to any record. Unknown IDs render as plain monospace text. */
export function EntityChip({ id, note, className }: { id: string; note?: string; className?: string }) {
  const { idx, select, selectedId } = useBoard();
  const e = idx.byId.get(id);
  if (!e) return <span className="font-mono text-[11px] text-zinc-500">{id}</span>;
  return (
    <button
      type="button"
      onClick={() => select(id, { focus: true })}
      title={`${TYPE_META[e.type].label} · ${id}`}
      className={cn(
        "group inline-flex max-w-full items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-left text-[12px] text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800",
        "touchui:min-h-11 touchui:w-full touchui:px-2.5 touchui:text-[14px] touchui:active:bg-zinc-800",
        selectedId === id && "border-zinc-400",
        className,
      )}
    >
      <TypeIcon type={e.type} />
      <span className="truncate touchui:line-clamp-2 touchui:whitespace-normal">{e.label}</span>
      {e.type === "CLAIM" && <StatusBadge status={e.status} className="ml-1" />}
      {note && <span className="shrink-0 text-[10px] text-zinc-500">{note}</span>}
    </button>
  );
}

export function ChipList({ ids, empty = "None recorded.", notes }: { ids: string[]; empty?: string; notes?: Record<string, string> }) {
  if (!ids.length) return <p className="text-[12px] italic text-zinc-500">{empty}</p>;
  return (
    <div className="flex flex-col items-start gap-1 touchui:items-stretch">
      {ids.map((id) => <EntityChip key={id} id={id} note={notes?.[id]} />)}
    </div>
  );
}

/** Collapsible section. Long lists start collapsed so detail screens stay scannable on phones. */
export function Section({ title, count, children, hint, defaultOpen }: { title: string; count?: number; children: React.ReactNode; hint?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? (count === undefined || count <= 12));
  return (
    <section className="border-t border-zinc-800 px-3 py-2.5 touchui:px-4">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="mb-1.5 flex w-full items-baseline gap-2 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-400 touchui:mb-2 touchui:min-h-11 touchui:items-center touchui:text-[12px]">
        {title}
        {count !== undefined && <span className="font-mono text-zinc-500">{count}</span>}
        <ChevronDown className={cn("ml-auto size-3.5 shrink-0 transition-transform touchui:size-4", !open && "-rotate-90")} />
      </button>
      {open && (
        <>
          {hint && <p className="mb-1.5 text-[11px] text-zinc-500 touchui:text-[13px]">{hint}</p>}
          {children}
        </>
      )}
    </section>
  );
}

export function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 py-0.5 text-[12px] touchui:grid-cols-[96px_1fr] touchui:py-1 touchui:text-[14px]">
      <span className="text-zinc-500">{label}</span>
      <span className={cn("wrap-anywhere min-w-0 text-zinc-200", mono && "font-mono text-[11px] touchui:text-[12px]")}>{value}</span>
    </div>
  );
}

export const fileUrl = (p: string) => `/api/file?path=${encodeURIComponent(p)}`;
