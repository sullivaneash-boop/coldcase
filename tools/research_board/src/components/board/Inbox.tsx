"use client";
import { useMemo, useState } from "react";
import { Check, CircleHelp, Eye, GitMerge, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InboxDecision, InboxItem } from "@/lib/types";
import { DECISION_LABEL, INBOX_KIND_LABEL, TERMINAL_DECISIONS } from "./constants";
import { EntityChip, Tag, fileUrl } from "./bits";
import { useBoard } from "./context";
import { timeText } from "@/lib/time";

const ACTIONS: { d: InboxDecision; label: string; icon: typeof Check; cls: string }[] = [
  { d: "IN_REVIEW", label: "Review", icon: Eye, cls: "text-sky-300 hover:bg-sky-950/50" },
  { d: "ACCEPTED", label: "Accept", icon: Check, cls: "text-emerald-300 hover:bg-emerald-950/50" },
  { d: "MERGE_REQUESTED", label: "Merge", icon: GitMerge, cls: "text-violet-300 hover:bg-violet-950/50" },
  { d: "IGNORED", label: "Ignore", icon: X, cls: "text-zinc-400 hover:bg-zinc-800" },
  { d: "UNRESOLVED", label: "Mark unresolved", icon: CircleHelp, cls: "text-amber-300 hover:bg-amber-950/50" },
];
const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function ItemCard({ item, onDecide }: { item: InboxItem; onDecide: (item: InboxItem, d: InboxDecision, note: string) => Promise<void> }) {
  const { idx } = useBoard();
  const readOnly = idx.bundle.meta.readOnly;
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const asset = item.kind === "UNASSIGNED_IMAGE" ? idx.bundle.assets.find((a) => a.id === item.entityIds[0]) : null;
  const decided = item.status !== "OPEN";
  return (
    <div className={cn("rounded-md border bg-zinc-900/70 p-2.5 touchui:rounded-lg touchui:p-3.5", TERMINAL_DECISIONS.has(item.status) ? "border-zinc-800 opacity-60" : "border-zinc-700")}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Tag className={item.priority === "HIGH" ? "border-red-700 text-red-300" : item.priority === "LOW" ? "text-zinc-500" : ""}>{item.priority}</Tag>
        <Tag>{INBOX_KIND_LABEL[item.kind] ?? item.kind}</Tag>
        {item.originalIssueType && item.originalIssueType !== item.kind && <Tag className="text-zinc-500" title="Issue type in the originating file">{item.originalIssueType}</Tag>}
        <Tag className={cn(decided && "border-sky-700 text-sky-300")}>{DECISION_LABEL[item.status] ?? item.status}</Tag>
        <span className="ml-auto font-mono text-[10px] text-zinc-600 touchui:hidden">{item.id.slice(0, 22)}</span>
      </div>
      <div className="wrap-anywhere mt-1.5 text-[13px] font-medium text-zinc-100 touchui:text-[17px] touchui:leading-snug">{item.title}</div>
      {item.description && <p className="wrap-anywhere mt-0.5 text-[12px] leading-snug text-zinc-400 touchui:mt-1 touchui:text-[14px] touchui:leading-relaxed">{item.description}</p>}
      {asset && (
        <div className="mt-1.5 flex items-center gap-2">
          {asset.published && asset.localPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl(asset.localPath)} alt={asset.altText ?? ""} className="h-20 rounded border border-zinc-800 bg-black object-contain" />
          ) : asset.originalUrl ? (
            <a className="text-[11px] text-zinc-400 underline" href={asset.originalUrl} target="_blank" rel="noreferrer">open remote image (not archived)</a>
          ) : null}
        </div>
      )}
      {item.entityIds.filter((id) => idx.byId.get(id)?.type === "EVENT").map((evId) => {
        const times = idx.eventTimesByEvent.get(evId) ?? [];
        if (!times.length) return null;
        return (
          <div key={evId} className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {times.map((t, i) => (
              <div key={t.id} className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 touchui:text-[11px]">Assertion {String.fromCharCode(65 + i)}</div>
                <div className="font-mono text-[13px] text-zinc-100 touchui:text-[16px]">{timeText(t)} <span className="text-[11px] text-zinc-500">{t.startAt}</span></div>
                {t.originalTimeText && <div className="wrap-anywhere text-[12px] text-zinc-400 touchui:text-[13px]">“{t.originalTimeText}”</div>}
                {t.sourceId && <div className="wrap-anywhere text-[11px] text-zinc-500 touchui:text-[12px]">{idx.byId.get(t.sourceId)?.label}</div>}
              </div>
            ))}
          </div>
        );
      })}
      {(item.entityIds.length > 0 || item.sourceIds.length > 0) && (
        <div className="mt-1.5 flex flex-wrap gap-1 touchui:flex-col">
          {item.entityIds.filter((id) => idx.byId.has(id)).map((id) => <EntityChip key={id} id={id} />)}
          {item.sourceIds.map((id) => <EntityChip key={id} id={id} />)}
        </div>
      )}
      <div className="wrap-anywhere mt-1 text-[10px] text-zinc-600 touchui:text-[12px]">From {item.origin}{item.originRef && item.originRef !== item.id ? ` · ${item.originRef}` : ""}</div>
      {item.decisionNote && <div className="mt-1 text-[11px] text-sky-300/80">Note: {item.decisionNote} <span className="text-zinc-600">({item.decidedBy}, {item.decidedAt?.slice(0, 16)})</span></div>}
      {readOnly ? (
        <p className="mt-2 text-[11px] text-zinc-500 touchui:text-[13px]">Read-only deployment — record decisions in the local board.</p>
      ) : (
      <div className="mt-2 flex flex-wrap items-center gap-1 touchui:mt-3 touchui:grid touchui:grid-cols-2 touchui:gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Decision note (recommended)" className="h-6 min-w-40 flex-1 rounded border border-zinc-800 bg-zinc-950 px-1.5 text-[11px] text-zinc-200 outline-none focus:border-zinc-600 touchui:col-span-2 touchui:h-11 touchui:text-[16px]" />
          {ACTIONS.filter((a) => a.d !== "MERGE_REQUESTED" || item.kind === "POSSIBLE_DUPLICATE_PERSON").map((a) => (
            <button key={a.d} type="button" disabled={busy || item.status === a.d}
              onClick={async () => { setBusy(true); await onDecide(item, a.d, note); setNote(""); setBusy(false); }}
              className={cn("inline-flex h-6 items-center gap-1 rounded border border-zinc-800 px-1.5 text-[11px] disabled:opacity-40 touchui:h-11 touchui:justify-center touchui:text-[15px] touchui:last:col-span-2", a.cls)}
              title={a.d === "MERGE_REQUESTED" ? "Records a merge request only. No records are merged." : undefined}>
              <a.icon className="size-3" /> {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Inbox({ items, onDecide, compact }: { items: InboxItem[]; onDecide: (item: InboxItem, d: InboxDecision, note: string) => Promise<void>; compact?: boolean }) {
  const [kind, setKind] = useState<string>("ALL");
  const [show, setShow] = useState<"OPEN" | "ACTIVE" | "ALL">("ACTIVE");
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) if (!TERMINAL_DECISIONS.has(i.status)) m.set(i.kind, (m.get(i.kind) ?? 0) + 1);
    return m;
  }, [items]);
  const list = items
    .filter((i) => kind === "ALL" || i.kind === kind)
    .filter((i) => show === "ALL" || (show === "OPEN" ? i.status === "OPEN" : !TERMINAL_DECISIONS.has(i.status)))
    .sort((a, b) => (PRIORITY_RANK[a.priority ?? "MEDIUM"] ?? 1) - (PRIORITY_RANK[b.priority ?? "MEDIUM"] ?? 1) || a.kind.localeCompare(b.kind));
  const kinds = Object.keys(INBOX_KIND_LABEL);
  const [limit, setLimit] = useState(30);
  if (compact) {
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    return (
      <div className="pb-6">
        <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
          <div className="flex gap-2 overflow-x-auto px-4 py-2">
            {["ALL", ...kinds.filter((k) => counts.get(k))].map((k) => (
              <button key={k} type="button" onClick={() => { setKind(k); setLimit(30); }} className={cn("min-h-11 shrink-0 rounded-full border px-3.5 text-[14px]", kind === k ? "border-zinc-300 bg-zinc-100 text-zinc-900" : "border-zinc-700 text-zinc-300")}>
                {k === "ALL" ? "All" : INBOX_KIND_LABEL[k]} <span className="font-mono text-[12px] opacity-70">{k === "ALL" ? total : counts.get(k)}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 pb-2">
            {(["ACTIVE", "OPEN", "ALL"] as const).map((sh) => (
              <button key={sh} type="button" onClick={() => setShow(sh)} className={cn("min-h-11 shrink-0 rounded px-3 text-[13px]", show === sh ? "bg-zinc-800 text-zinc-100" : "text-zinc-400")}>
                {sh === "ACTIVE" ? "Needs decision" : sh === "OPEN" ? "Untouched" : "All incl. decided"}
              </button>
            ))}
          </div>
        </div>
        <p className="flex gap-1.5 px-4 pt-3 text-[13px] leading-snug text-zinc-500">
          <Info className="mt-0.5 size-4 shrink-0" />
          Decisions are logged to review_decisions.csv. They never edit registers, merge people or resolve contradictions.
        </p>
        <div className="flex flex-col gap-3 px-4 pt-3">
          {list.length === 0 && <p className="text-[14px] italic text-zinc-500">Nothing in this view.</p>}
          {list.slice(0, limit).map((i) => <ItemCard key={i.id} item={i} onDecide={onDecide} />)}
          {list.length > limit && (
            <button type="button" onClick={() => setLimit(limit + 30)} className="min-h-11 rounded border border-zinc-700 text-[15px] text-zinc-300">
              Show more ({list.length - limit} remaining)
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0">
      <div className="w-60 shrink-0 overflow-y-auto border-r border-zinc-800 p-2">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Awaiting judgment</div>
        {["ALL", ...kinds].map((k) => {
          const n = k === "ALL" ? [...counts.values()].reduce((a, b) => a + b, 0) : counts.get(k) ?? 0;
          return (
            <button key={k} type="button" onClick={() => setKind(k)} className={cn("flex w-full items-center justify-between rounded px-1.5 py-0.5 text-left text-[12px]", kind === k ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900", n === 0 && k !== "ALL" && "text-zinc-600")}>
              <span>{k === "ALL" ? "All kinds" : INBOX_KIND_LABEL[k]}</span><span className="font-mono text-[10px]">{n}</span>
            </button>
          );
        })}
        <div className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Show</div>
        {(["ACTIVE", "OPEN", "ALL"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setShow(s)} className={cn("block w-full rounded px-1.5 py-0.5 text-left text-[12px]", show === s ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900")}>
            {s === "ACTIVE" ? "Not yet decided / in review / unresolved" : s === "OPEN" ? "Untouched only" : "Everything incl. decided"}
          </button>
        ))}
        <p className="mt-3 flex gap-1 text-[11px] leading-snug text-zinc-500">
          <Info className="mt-0.5 size-3 shrink-0" />
          Decisions append to 00_ADMIN/data_registers/review_decisions.csv. They never edit case registers, merge people or resolve contradictions — applying a decision is a separate human step.
        </p>
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto p-3">
        {list.length === 0 ? <p className="text-[12px] italic text-zinc-500">Nothing in this view.</p> : (
          <div className="mx-auto flex max-w-4xl flex-col gap-2">{list.map((i) => <ItemCard key={i.id} item={i} onDecide={onDecide} />)}</div>
        )}
      </div>
    </div>
  );
}
