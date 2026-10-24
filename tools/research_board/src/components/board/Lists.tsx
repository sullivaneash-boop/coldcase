"use client";
// Readable list pages shared by desktop and phone: sources and conflicting accounts.
import { useState } from "react";
import { ChevronRight, FileText, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, label } from "@/lib/labels";
import { Tag } from "./bits";
import { useBoard } from "./context";

export function SourcesList({ onOpen }: { onOpen: (id: string) => void }) {
  const { idx } = useBoard();
  const sources = idx.bundle.entities.filter((e) => e.type === "SOURCE");
  const groups = [...new Set(sources.map((s) => s.subtype ?? "UNKNOWN"))].filter((g) => g !== "NEWSPAPER_PAGE");
  const [group, setGroup] = useState("ALL");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"date" | "added" | "claims">("date");
  const [limit, setLimit] = useState(40);
  const claimCount = (id: string) => new Set((idx.claimSourcesBySource.get(id) ?? []).map((c) => c.claimId)).size;
  const needle = q.trim().toLowerCase();
  const list = sources
    // Page scans are containers for articles; they are listed only when asked for.
    .filter((s) => (group === "ALL" ? s.subtype !== "NEWSPAPER_PAGE" : s.subtype === group))
    .filter((s) => !needle || `${s.label} ${s.row.publisher ?? ""} ${s.row._article?.publication ?? ""} ${s.row.author ?? ""}`.toLowerCase().includes(needle))
    .sort((a, b) =>
      sort === "claims" ? claimCount(b.id) - claimCount(a.id)
        : sort === "added" ? (b.row.created_at ?? "").localeCompare(a.row.created_at ?? "")
        : (a.row.publication_date || "9999").localeCompare(b.row.publication_date || "9999") || a.label.localeCompare(b.label));
  const pageScans = sources.filter((s) => s.subtype === "NEWSPAPER_PAGE").length;
  const chip = (on: boolean) => cn("shrink-0 rounded-full border px-3 py-1 text-[12px] touchui:min-h-11 touchui:px-3.5 touchui:text-[14px]", on ? "border-zinc-300 bg-zinc-100 text-zinc-900" : "border-zinc-700 text-zinc-300 hover:border-zinc-500");

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-2 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3">
          <Search className="size-4 text-zinc-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter sources by title, publisher or author" className="h-9 min-w-0 flex-1 bg-transparent text-[13px] outline-none touchui:h-11 touchui:text-[16px]" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {["ALL", ...groups].map((g) => (
            <button key={g} type="button" onClick={() => { setGroup(g); setLimit(40); }} className={chip(group === g)}>
              {g === "ALL" ? "All" : label("sourceKind", g).label}{" "}
              <span className="font-mono opacity-60">{g === "ALL" ? sources.length - pageScans : sources.filter((s) => s.subtype === g).length}</span>
            </button>
          ))}
          {pageScans > 0 && <button type="button" onClick={() => setGroup("NEWSPAPER_PAGE")} className={chip(group === "NEWSPAPER_PAGE")}>Page scans <span className="font-mono opacity-60">{pageScans}</span></button>}
        </div>
        <div className="flex items-center gap-2 text-[12px] text-zinc-500 touchui:text-[13px]">
          Sort by
          {(["date", "added", "claims"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSort(s)} className={cn("rounded px-2 py-0.5 touchui:min-h-10", sort === s ? "bg-zinc-800 text-zinc-100" : "hover:text-zinc-300")}>
              {s === "date" ? "publication date" : s === "added" ? "recently added" : "most claims"}
            </button>
          ))}
          <span className="ml-auto">{list.length} shown</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <ul className="mx-auto max-w-4xl">
          {list.slice(0, limit).map((s) => {
            const claims = claimCount(s.id);
            const rel = label("reliability", s.row.reliability_class);
            return (
              <li key={s.id}>
                <button type="button" onClick={() => onOpen(s.id)} className="flex w-full items-start gap-3 border-b border-zinc-900 px-4 py-3 text-left hover:bg-zinc-900/60 touchui:min-h-16">
                  <FileText className="mt-1 size-4 shrink-0 text-yellow-300" />
                  <div className="min-w-0 flex-1">
                    <div className="wrap-anywhere text-[14px] font-medium leading-snug text-zinc-100 touchui:text-[15px]">{s.label}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-zinc-500">
                      <span>{[label("sourceKind", s.subtype).label, s.row.publisher || s.row._article?.publication, formatDate(s.row.publication_date)].filter(Boolean).join(" · ")}</span>
                      <Tag title={rel.help}>{s.row.reliability_class ? rel.label : "Not yet rated"}</Tag>
                      {claims > 0 && <span>{claims} claim{claims === 1 ? "" : "s"}</span>}
                    </div>
                  </div>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-zinc-600" />
                </button>
              </li>
            );
          })}
        </ul>
        {list.length === 0 && <p className="p-6 text-center text-[13px] text-zinc-500">No sources match.</p>}
        {list.length > limit && (
          <div className="mx-auto max-w-4xl px-4 pt-3"><button type="button" onClick={() => setLimit(limit + 40)} className="min-h-10 w-full rounded border border-zinc-700 text-[14px] text-zinc-300">Show more ({list.length - limit})</button></div>
        )}
      </div>
    </div>
  );
}

export function ContradictionsList() {
  const { idx, select } = useBoard();
  const cons = idx.bundle.entities.filter((e) => e.type === "CONTRADICTION");
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-3 p-4">
      <p className="text-[13px] text-zinc-400 touchui:text-[14px]">Where sources disagree. Every version is kept with its source; none is picked as the winner.</p>
      {cons.length === 0 && <p className="text-[14px] italic text-zinc-500">No conflicting accounts recorded.</p>}
      {cons.map((c) => {
        const versions = idx.versionsByContradiction.get(c.id) ?? [];
        const st = label("contradiction", c.status);
        return (
          <button key={c.id} type="button" onClick={() => select(c.id, { focus: true })} className="rounded-xl border border-red-900/60 bg-zinc-900/70 p-4 text-left hover:bg-zinc-900 active:bg-zinc-800">
            <div className="flex items-center gap-2"><Tag className="border-red-700 text-red-300" title={st.help}>{st.label}</Tag><span className="text-[12px] text-zinc-500">{versions.length} versions</span></div>
            <div className="wrap-anywhere mt-1.5 text-[15px] font-medium leading-snug text-zinc-50 touchui:text-[16px]">{c.label}</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {versions.slice(0, 4).map((v, i) => (
                <div key={v.id} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-[13px]">
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500">Version {String.fromCharCode(65 + i)}{v.assertedStartAt && ` · ${formatDate(v.assertedStartAt)}`}</div>
                  <div className="wrap-anywhere mt-0.5 text-zinc-200">“{v.versionText}”</div>
                  {v.sourceId && <div className="mt-1 truncate text-[11px] text-zinc-500">{idx.byId.get(v.sourceId)?.label}</div>}
                </div>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
