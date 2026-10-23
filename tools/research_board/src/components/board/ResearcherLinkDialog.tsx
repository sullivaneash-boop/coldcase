"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EntityChip } from "./bits";
import { useBoard } from "./context";
import { useEntitySearch } from "./SearchDialog";

export function ResearcherLinkDialog({ fromId, onClose, onCreated }: {
  fromId: string | null;
  onClose: () => void;
  onCreated: (link: { id: string; fromId: string; toId: string; label: string; note: string; createdBy: string; createdAt: string; status: string }) => void;
}) {
  const { idx } = useBoard();
  const fuse = useEntitySearch(idx.bundle.entities);
  const [q, setQ] = useState("");
  const [toId, setToId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!fromId) return null;
  const results = q.trim().length >= 2 ? fuse.search(q.trim(), { limit: 8 }).map((r) => r.item).filter((e) => e.id !== fromId) : [];

  const save = async () => {
    setError(null);
    const res = await fetch("/api/links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fromId, toId, label, note }) });
    const body = await res.json();
    if (!res.ok) return setError(body.error ?? "Failed");
    onCreated(body);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border border-amber-700/50 bg-zinc-950 sm:max-w-lg">
        <DialogTitle className="text-amber-300">Add researcher link</DialogTitle>
        <DialogDescription className="text-[12px] text-zinc-400">
          A researcher connection is your own analytical note. It is drawn dashed in amber and labelled
          “Researcher connection — not evidence”. It is never treated as a sourced relationship, never
          used as corroboration, and never implies guilt.
        </DialogDescription>
        <div className="space-y-2 text-[12px]">
          <div><div className="mb-0.5 text-zinc-500">From</div><EntityChip id={fromId} /></div>
          <div>
            <div className="mb-0.5 text-zinc-500">To</div>
            {toId ? (
              <div className="flex items-center gap-2"><EntityChip id={toId} /><button type="button" className="text-[11px] text-zinc-400 underline" onClick={() => setToId(null)}>change</button></div>
            ) : (
              <>
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any record…" className="h-7 w-full rounded border border-zinc-700 bg-zinc-900 px-2 outline-none" />
                <div className="mt-1 flex flex-col gap-0.5">
                  {results.map((e) => (
                    <button key={e.id} type="button" onClick={() => setToId(e.id)} className="truncate rounded px-1.5 py-0.5 text-left text-zinc-300 hover:bg-zinc-800">{e.type.toLowerCase()} · {e.label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Short label (e.g. “compare accounts”)" className="h-7 w-full rounded border border-zinc-700 bg-zinc-900 px-2 outline-none" />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why are you linking these? (required)" rows={3} className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 outline-none" />
          {error && <p className="text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded px-3 py-1 text-zinc-400 hover:bg-zinc-800">Cancel</button>
            <button type="button" disabled={!toId || !note.trim()} onClick={save} className="rounded bg-amber-600/80 px-3 py-1 text-zinc-950 disabled:opacity-40">Save to researcher_links.csv</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
