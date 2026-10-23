"use client";
import { ArrowDown, BookOpen, FileArchive, AlertTriangle, CircleHelp, Link2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClaimSource } from "@/lib/types";
import { EntityChip, Tag } from "./bits";
import { useBoard } from "./context";
import { anchorFromLocator, outTargets, sourceOrigins, type Origin } from "./graph";

const human = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/_/g, " ");

function Down({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-1.5 py-0.5 pl-3 text-[10px] text-zinc-500 touchui:py-1.5 touchui:text-[12px]">
      <ArrowDown className="size-3" />
      {label}
    </div>
  );
}

function Box({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "warn" | "muted" }) {
  return (
    <div className={cn(
      "rounded border px-2 py-1.5 text-[12px] touchui:px-3 touchui:py-2.5 touchui:text-[14px]",
      tone === "default" && "border-zinc-700 bg-zinc-900",
      tone === "warn" && "border-amber-600/50 bg-amber-950/30",
      tone === "muted" && "border-dashed border-zinc-700 bg-zinc-950",
    )}>{children}</div>
  );
}

function OriginBox({ o, sharedBy }: { o: Origin; sharedBy?: number }) {
  if (o.kind === "HELD_SOURCE" && o.entityId) {
    return (
      <Box>
        <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500"><Link2 className="size-3" />Underlying source — held in archive</div>
        <EntityChip id={o.entityId} />
        {sharedBy && sharedBy > 1 && <SharedNote n={sharedBy} />}
      </Box>
    );
  }
  return (
    <Box tone="muted">
      <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500"><CircleHelp className="size-3" />Underlying source — NOT acquired</div>
      <div className="text-zinc-300">{o.label}</div>
      {o.detail && <div className="mt-0.5 break-all font-mono text-[10px] text-zinc-500">{o.detail}</div>}
      {o.wantedId && <div className="mt-0.5 font-mono text-[10px] text-zinc-600">{o.wantedId}</div>}
      {sharedBy && sharedBy > 1 && <SharedNote n={sharedBy} />}
    </Box>
  );
}

function SharedNote({ n }: { n: number }) {
  return (
    <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-300">
      <AlertTriangle className="size-3" /> Shared by {n} supporting links — not independent corroboration
    </div>
  );
}

const isMedia = (o: Origin) => /LINKED_IMAGE|SCAN|^Linked item:/i.test(`${o.detail ?? ""} ${o.label}`) || o.sourceType === "LINKED_IMAGE_OR_SCAN";

function Chain({ cs, sharedCount }: { cs: ClaimSource; sharedCount: Map<string, number> }) {
  const { idx, openSource } = useBoard();
  const src = idx.byId.get(cs.sourceId);
  const origins = sourceOrigins(idx, cs.sourceId);
  const citedIds = new Set(outTargets(idx, cs.sourceId, "CITES_SOURCE"));
  const cited = origins.filter((o) => o.entityId && citedIds.has(o.entityId));
  const referenced = origins.filter((o) => !cited.includes(o));
  const pages = outTargets(idx, cs.sourceId, "APPEARS_ON_PAGE");
  const carriers = [cs.sourceId, ...pages].flatMap((id) => (idx.filesBySource.get(id) ?? []).filter((f) => f.fileRole === "ORIGINAL"));
  const anchor = anchorFromLocator(cs.locator, cs.excerpt);
  const art = src?.row._article;
  return (
    <div className="min-w-0 flex-1">
      <Down label={`${human(cs.relationship)} · ${cs.locator ? "locator recorded" : "no locator"}`} />
      <Box tone={cs.relationship === "CONTRADICTS" ? "warn" : "default"}>
        <div className="mb-1 flex flex-wrap items-center gap-1">
          <Tag>{cs.relationship}</Tag>
          {src?.row.reliability_class ? <Tag title="Source reliability class (A–G). Describes the source, not the claim.">class {src.row.reliability_class}</Tag> : <Tag>class pending</Tag>}
          {src?.row.primary_or_secondary && <Tag>{src.row.primary_or_secondary}</Tag>}
        </div>
        <EntityChip id={cs.sourceId} />
        <div className="mt-1 text-[11px] text-zinc-400">
          {[art?.publication || src?.row.publisher, src?.row.publication_date, art?.author && `by ${art.author}`].filter(Boolean).join(" · ")}
        </div>
        {cs.locator && <div className="wrap-anywhere mt-1 font-mono text-[10px] leading-snug text-zinc-500 touchui:text-[12px]">{cs.locator}</div>}
        {cs.excerpt && <blockquote className="mt-1 border-l-2 border-zinc-600 pl-2 text-[12px] text-zinc-300">“{cs.excerpt}”</blockquote>}
        <button
          type="button"
          onClick={() => openSource({ sourceId: cs.sourceId, anchor, locator: cs.locator, fromClaimId: cs.claimId })}
          className="mt-1.5 inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-700 touchui:min-h-11 touchui:w-full touchui:justify-center touchui:text-[15px]"
        >
          <BookOpen className="size-3" /> Open source{anchor ? " at passage" : ""}
        </button>
      </Box>

      <Down label="attributed to" />
      <Box tone={cs.speakerPersonId ? "default" : "muted"}>
        <div className="mb-1 flex flex-wrap items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
          <UserRound className="size-3" /> Account origin
          {cs.assertionType && <Tag>{human(cs.assertionType)}</Tag>}
          {cs.knowledgeBasis && <Tag title="FIRSTHAND / HEARSAY / MIXED / UNKNOWN">{cs.knowledgeBasis}</Tag>}
        </div>
        {cs.speakerPersonId ? <EntityChip id={cs.speakerPersonId} /> : (
          <div className="text-[12px] text-zinc-400">
            {cs.assertionType === "NEWSPAPER_ASSERTION" ? "The publication’s own assertion (no named speaker recorded)." : "No named speaker recorded in claim_sources.csv."}
          </div>
        )}
      </Box>

      {cited.map((o) => (
        <div key={o.key}>
          <Down label="source cites (CITES_SOURCE)" />
          <OriginBox o={o} sharedBy={sharedCount.get(o.key)} />
        </div>
      ))}

      {referenced.length > 0 && (
        <>
          <Down label="source-level references" />
          <Box tone="muted">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Underlying material this source references</div>
            <p className="mb-1.5 text-[11px] text-zinc-500">
              Recorded per source in source_chain.csv — <b>not mapped to this specific claim</b>. Check the passage to see which, if any, it relies on.
            </p>
            <div className="flex flex-col gap-1">
              {referenced.filter((o) => !isMedia(o)).map((o) => (
                <div key={o.key} className="text-[11px]">
                  {o.entityId ? <EntityChip id={o.entityId} note="held" /> : (
                    <span className="text-zinc-300">{o.label} <span className="text-zinc-600">· not acquired</span></span>
                  )}
                  {(sharedCount.get(o.key) ?? 0) > 1 && <SharedNote n={sharedCount.get(o.key)!} />}
                </div>
              ))}
              {referenced.some(isMedia) && (
                <div className="text-[10px] text-zinc-600">+ {referenced.filter(isMedia).length} linked image/scan reference(s)</div>
              )}
            </div>
          </Box>
        </>
      )}

      {carriers.length > 0 && (
        <>
          <Down label="preserved as" />
          <Box tone="muted">
            <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500"><FileArchive className="size-3" />Archived original file(s)</div>
            {carriers.map((f) => (
              <div key={f.id} className="break-all font-mono text-[10px] text-zinc-400">
                {f.localFile} {f.sha256 && <span className="text-zinc-600">sha256 {f.sha256.slice(0, 10)}…</span>} {!f.exists && <span className="text-red-400">missing</span>}
              </div>
            ))}
            {pages.length > 0 && <div className="mt-1 text-[10px] text-zinc-500">Page containment is not independent corroboration.</div>}
          </Box>
        </>
      )}
    </div>
  );
}

export function ProvenanceView({ claimId }: { claimId: string }) {
  const { idx } = useBoard();
  const claim = idx.byId.get(claimId);
  const links = idx.claimSourcesByClaim.get(claimId) ?? [];
  const supporting = links.filter((l) => l.relationship === "SUPPORTS");
  const contrary = links.filter((l) => l.relationship === "CONTRADICTS");
  const context = links.filter((l) => l.relationship !== "SUPPORTS" && l.relationship !== "CONTRADICTS");

  // Count how many supporting links share each origin (source, speaker or underlying source).
  const sharedCount = new Map<string, number>();
  const bump = (k: string) => sharedCount.set(k, (sharedCount.get(k) ?? 0) + 1);
  const rootsPerLink = supporting.map((l) => {
    const roots = new Set<string>([l.sourceId, ...sourceOrigins(idx, l.sourceId).filter((o) => !isMedia(o)).map((o) => o.key)]);
    if (l.speakerPersonId) roots.add(`speaker:${l.speakerPersonId}`);
    roots.forEach(bump);
    return roots;
  });
  const distinctSources = new Set(supporting.map((l) => l.sourceId)).size;
  const sharedRoots = [...sharedCount.entries()].filter(([, n]) => n > 1);
  // Links that share no root with any other supporting link.
  const independentLooking = rootsPerLink.filter((roots) => [...roots].every((r) => (sharedCount.get(r) ?? 0) <= 1)).length;

  return (
    <div className="space-y-3">
      <div className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">Claim {claimId}</div>
        <div className="text-[12px] text-zinc-100">{claim?.label}</div>
      </div>

      <div className={cn("rounded border px-2 py-1.5 text-[12px] touchui:p-3 touchui:text-[14px]", sharedRoots.length ? "border-amber-600/50 bg-amber-950/30 text-amber-100" : "border-zinc-700 bg-zinc-900 text-zinc-300")}>
        <div className="mb-0.5 font-semibold">Source dependency</div>
        {supporting.length === 0 && <p>No supporting source links recorded.</p>}
        {supporting.length === 1 && <p>Single supporting attribution — no corroborating source is recorded in the archive.</p>}
        {supporting.length > 1 && (
          <p>
            {supporting.length} supporting links across {distinctSources} source record(s).{" "}
            {sharedRoots.length
              ? `${sharedRoots.length} shared origin(s) detected (source or underlying-source level); at most ${independentLooking} link(s) have no recorded shared origin.`
              : "No shared origin is recorded between them."}
          </p>
        )}
        <p className="mt-1 text-[11px] text-zinc-400 touchui:text-[13px]">
          Independence is never assumed: absence of a recorded shared origin is not proof of independent origin. Batch source chains mark independence as “shared or not established” until a human reviews it.
        </p>
      </div>

      {[["Supporting", supporting], ["Contradicting", contrary], ["Context only", context]].map(([title, list]) =>
        (list as ClaimSource[]).length ? (
          <div key={title as string}>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{title as string}</div>
            <div className="flex flex-col gap-4">
              {(list as ClaimSource[]).map((cs) => <Chain key={cs.id} cs={cs} sharedCount={sharedCount} />)}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}
