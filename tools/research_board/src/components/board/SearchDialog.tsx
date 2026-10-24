"use client";
import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { Entity } from "@/lib/types";
import { TYPE_META, TYPE_ORDER } from "./constants";
import { StatusBadge, TypeIcon } from "./bits";
import { describe } from "@/lib/labels";

// Searchable text is derived from register fields client-side (not shipped twice in the payload).
const TEXT_FIELDS = ["claim", "aliases", "neutral_description", "original_time_text", "description", "statement_text", "title", "author", "publisher", "subject", "address", "notes"];
const entityText = (e: Entity) =>
  [e.subtitle, ...TEXT_FIELDS.map((f) => e.row[f]), e.row._article?.headline, e.row._article?.summary].filter(Boolean).join(" \n ");

export function useEntitySearch(entities: Entity[]) {
  return useMemo(() => new Fuse(entities, {
    keys: [
      { name: "label", weight: 0.55 },
      { name: "id", weight: 0.15 },
      { name: "text", weight: 0.3, getFn: (e) => entityText(e as Entity) },
    ],
    threshold: 0.34,
    ignoreLocation: true,
    minMatchCharLength: 2,
  }), [entities]);
}

export function SearchDialog({ open, onOpenChange, entities, onPick, title = "Search the case index" }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entities: Entity[];
  onPick: (id: string) => void;
  title?: string;
}) {
  const fuse = useEntitySearch(entities);
  const [q, setQ] = useState("");
  const results = q.trim().length >= 2 ? fuse.search(q.trim(), { limit: 60 }).map((r) => r.item) : [];
  const grouped = TYPE_ORDER.map((t) => [t, results.filter((r) => r.type === t)] as const).filter(([, l]) => l.length);
  return (
    <CommandDialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setQ(""); }} title={title} description="People, claims, events, evidence, locations, sources and witness statements" className="sm:max-w-2xl">
      <Command shouldFilter={false} className="bg-zinc-950">
        <CommandInput value={q} onValueChange={setQ} placeholder="Search people, claims, events, evidence, places, sources, statements…" />
        <CommandList className="max-h-[60vh]">
          {q.trim().length >= 2 && <CommandEmpty>No indexed records match.</CommandEmpty>}
          {grouped.map(([type, list]) => (
            <CommandGroup key={type} heading={`${TYPE_META[type].plural} (${list.length})`}>
              {list.map((e) => (
                <CommandItem key={e.id} value={e.id} onSelect={() => { onPick(e.id); onOpenChange(false); setQ(""); }} className="items-start gap-2">
                  <TypeIcon type={e.type} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-[12px] text-zinc-100">{e.label}</div>
                    <div className="truncate text-[11px] text-zinc-500">{TYPE_META[e.type].label} · {describe(e)}</div>
                  </div>
                  {e.type === "CLAIM" && <StatusBadge status={e.status} />}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
