"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ExternalLink, FileWarning, ImageOff, Locate } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Asset } from "@/lib/types";
import { ChipList, EntityChip, Field, Section, Tag, fileUrl } from "./bits";
import { useBoard, type SourceViewRequest } from "./context";
import { AssetGallery } from "./Inspector";
import { inSources, outTargets, uniq } from "./graph";

type Rendition = { key: string; label: string; path: string; kind: "markdown" | "text" | "image" | "pdf"; role: string };
type Payload = { renditions: Rendition[]; chosen: string | null; content: string | null; truncated: boolean };

const norm = (s: string) => s.replace(/[“”"‘’']/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/** Finds the first block whose text contains the anchor (quote-insensitive) and highlights it. */
function highlightAnchor(root: HTMLElement, anchor: string): boolean {
  const needle = norm(anchor).slice(0, 60);
  if (needle.length < 6) return false;
  const blocks = root.querySelectorAll<HTMLElement>("p, li, blockquote, td, h1, h2, h3, h4, pre");
  for (const b of blocks) {
    if (norm(b.textContent ?? "").includes(needle)) {
      b.classList.add("source-anchor");
      b.scrollIntoView({ block: "center" });
      return true;
    }
  }
  return false;
}

function useSourcePayload(req: SourceViewRequest) {
  const [data, setData] = useState<Payload | null>(null);
  const [rendition, setRendition] = useState<string | null>(null);
  useEffect(() => {
    setRendition(null);
    setData(null);
  }, [req.sourceId]);
  useEffect(() => {
    const q = rendition ? `?rendition=${encodeURIComponent(rendition)}` : "";
    let live = true;
    fetch(`/api/source/${req.sourceId}${q}`).then((r) => r.json()).then((d) => live && setData(d)).catch(() => live && setData(null));
    return () => { live = false; };
  }, [req.sourceId, rendition]);
  return { data, setRendition };
}

/** Related records for a source: claims, statements, entities, underlying sources, images. */
function SourceRelated({ sourceId }: { sourceId: string }) {
  const { idx } = useBoard();
  const claims = uniq((idx.claimSourcesBySource.get(sourceId) ?? []).map((c) => c.claimId));
  const mentions = outTargets(idx, sourceId, "MENTIONS");
  const byType = (t: string) => mentions.filter((m) => idx.byId.get(m)?.type === t);
  const events = inSources(idx, sourceId, "EVENT_REPORTED_IN");
  const evidence = inSources(idx, sourceId, "EVIDENCE_REPORTED_IN");
  const statements = inSources(idx, sourceId, "STATEMENT_RECORDED_IN");
  const chain = idx.chainBySource.get(sourceId) ?? [];
  const cites = outTargets(idx, sourceId, "CITES_SOURCE");
  const citedBy = inSources(idx, sourceId, "CITES_SOURCE");
  const pages = outTargets(idx, sourceId, "APPEARS_ON_PAGE");
  const assets = idx.assetsBySource.get(sourceId) ?? [];
  return (
    <>
      <Section title="Extracted claims" count={claims.length}><ChipList ids={claims} /></Section>
      <Section title="Witness statements" count={statements.length}><ChipList ids={statements} /></Section>
      <Section title="People" count={byType("PERSON").length}><ChipList ids={byType("PERSON")} /></Section>
      <Section title="Locations" count={byType("LOCATION").length}><ChipList ids={byType("LOCATION")} /></Section>
      {byType("ORGANIZATION").length > 0 && <Section title="Organizations" count={byType("ORGANIZATION").length}><ChipList ids={byType("ORGANIZATION")} /></Section>}
      <Section title="Events" count={events.length}><ChipList ids={events} /></Section>
      <Section title="Evidence" count={evidence.length}><ChipList ids={evidence} /></Section>
      <Section title="Underlying sources referenced" count={chain.length + cites.length} hint="Recorded per source (source_chain.csv / CITES_SOURCE). Not acquired ≠ held.">
        <div className="flex flex-col gap-1">
          {cites.map((c) => <EntityChip key={c} id={c} note="cites" />)}
          {chain.filter((c) => !c.heldSourceId || !cites.includes(c.heldSourceId)).map((c) => c.heldSourceId ? <EntityChip key={c.id} id={c.heldSourceId} note="held" /> : (
            <div key={c.id} className="wrap-anywhere rounded border border-dashed border-zinc-700 px-1.5 py-1 text-[11px] text-zinc-300 touchui:px-2.5 touchui:py-2 touchui:text-[14px]">
              {c.underlyingSource}
              <div className="text-[10px] text-zinc-500 touchui:text-[12px]">{c.sourceType} · {c.holdingStatus}</div>
            </div>
          ))}
          {!chain.length && !cites.length && <p className="text-[12px] italic text-zinc-500">None recorded.</p>}
        </div>
      </Section>
      {citedBy.length > 0 && <Section title="Repeated / cited by" count={citedBy.length} hint="Later sources that derive from this one — not independent corroboration."><ChipList ids={citedBy} /></Section>}
      {pages.length > 0 && <Section title="Page scans" count={pages.length}><ChipList ids={pages} /></Section>}
      <Section title="Images / assets" count={assets.length}><AssetGallery assets={assets} /></Section>
    </>
  );
}

function SourceMeta({ sourceId }: { sourceId: string }) {
  const { idx } = useBoard();
  const src = idx.byId.get(sourceId)!;
  const r = src.row;
  const art = r._article;
  return (
    <>
      <Field label="Type" value={r.source_type} />
      <Field label="Published" value={r.publication_date && `${r.publication_date} (${r.publication_date_precision || "?"})`} />
      <Field label="Underlying" value={r.underlying_event_start && `${r.underlying_event_start} → ${r.underlying_event_end || "?"}`} />
      <Field label="Reliability" value={r.reliability_class ? `class ${r.reliability_class} — describes the source, not any claim` : "class pending review"} />
      <Field label="Prim./second." value={r.primary_or_secondary} />
      <Field label="Knowledge" value={r.knowledge_basis} />
      <Field label="Original URL" value={r.original_url && <a href={r.original_url} target="_blank" rel="noreferrer" className="underline">{r.original_url}</a>} />
      <Field label="Accessed" value={r.date_accessed} />
      <Field label="Acquired" value={[r.acquired_at, r.acquired_by].filter(Boolean).join(" · ")} />
      <Field label="Rights" value={r.rights_notes} />
      <Field label="Notes" value={r.notes} />
      {art && <Field label="Article" value={`p. ${art.page} · ${art.genre} · ${art.completeness} · OCR ${art.ocr_quality}`} />}
    </>
  );
}

/** The reading surface itself. `layout="page"` is the single-column mobile article reader. */
export function SourceReader({ req, layout }: { req: SourceViewRequest; layout: "dialog" | "page" }) {
  const { idx, openImage } = useBoard();
  const { data, setRendition } = useSourcePayload(req);
  const [anchorFound, setAnchorFound] = useState<boolean | null>(null);
  const [metaOpen, setMetaOpen] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const src = idx.byId.get(req.sourceId);

  useEffect(() => {
    setAnchorFound(null);
    if (!req.anchor || !data?.content || !body.current) return;
    const t = setTimeout(() => setAnchorFound(highlightAnchor(body.current!, req.anchor!)), 80);
    return () => clearTimeout(t);
  }, [data, req.anchor]);

  if (!src) return <p className="p-4 text-zinc-500">Unknown source {req.sourceId}</p>;
  const r = src.row;
  const art = r._article;
  const chosen = data?.renditions.find((x) => x.key === data.chosen);
  const mdDir = chosen?.path.split("/").slice(0, -1).join("/") ?? "";
  const sourceAssets = idx.assetsBySource.get(src.id) ?? [];
  const page = layout === "page";

  const viewLocal = (path: string, alt: string) => {
    const i = sourceAssets.findIndex((a) => a.localPath === path);
    if (i >= 0) return openImage(sourceAssets, i);
    const temp: Asset = { id: path, type: "IMAGE", localPath: path, originalUrl: null, caption: null, altText: alt, sourceId: src.id, relatedEntityIds: [], status: "NOT_INDEXED", availability: "LOCAL", identityBasis: null, discoveredIn: null, notes: null };
    openImage([temp], 0);
  };

  const article = (
    <>
      <div className={cn("flex gap-1 border-b border-zinc-800 px-3 py-1.5", page ? "overflow-x-auto px-4 py-2" : "flex-wrap")}>
        {data?.renditions.map((x) =>
          x.kind === "markdown" || x.kind === "text" ? (
            <button key={x.key} type="button" onClick={() => setRendition(x.key)} className={cn("shrink-0 rounded px-2 py-0.5 text-[11px] touchui:min-h-11 touchui:px-3 touchui:text-[13px]", data.chosen === x.key ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800")}>{x.label}</button>
          ) : (
            <a key={x.key} href={fileUrl(x.path)} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-800 touchui:min-h-11 touchui:px-3 touchui:text-[13px]">
              {x.label} <ExternalLink className="size-3" />
            </a>
          ),
        )}
        {data && data.renditions.length === 0 && <span className="text-[11px] text-zinc-500">No local renditions archived for this source.</span>}
      </div>
      {req.locator && (
        <div className="flex items-start gap-1.5 border-b border-zinc-800 bg-sky-950/30 px-3 py-1.5 text-[11px] text-sky-200 touchui:px-4 touchui:py-2.5 touchui:text-[13px]">
          <Locate className="mt-px size-3 shrink-0" />
          <div className="wrap-anywhere min-w-0">
            <div><b>Locator:</b> {req.locator}</div>
            {req.anchor && <div className="text-sky-300/80">{anchorFound === false ? "Passage not found automatically in this rendition — use the locator." : anchorFound ? "Matching passage highlighted below." : "Looking for passage…"}</div>}
            {req.fromClaimId && <div className="mt-1"><EntityChip id={req.fromClaimId} note="opened from claim" /></div>}
          </div>
        </div>
      )}
      <div ref={body} className={cn(page ? "px-5 py-4" : "min-h-0 flex-1 overflow-y-auto px-6 py-4")}>
        {!data && <p className="text-[12px] text-zinc-500">Loading…</p>}
        {chosen && chosen.role !== "ORIGINAL" && (
          <p className="wrap-anywhere mb-3 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-400 touchui:text-[12px]">
            Rendition: <b>{chosen.label}</b><span className="touchui:hidden"> — <span className="font-mono">{chosen.path}</span></span>. Derivatives are reading aids; the preserved original is authoritative.
          </p>
        )}
        {data?.truncated && <p className="mb-2 text-[11px] text-amber-300"><FileWarning className="inline size-3" /> Very large file — display truncated.</p>}
        {data?.content && chosen?.kind === "markdown" && (
          <article className="source-md mx-auto">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              urlTransform={(u) => u}
              components={{
                a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>,
                img: ({ src: s, alt }) => {
                  const url = typeof s === "string" ? s : "";
                  if (/^https?:|^\/\//i.test(url) || url.startsWith("/")) {
                    const full = url.startsWith("/") && !url.startsWith("//") && r.original_url ? new URL(url, r.original_url).toString() : url;
                    return (
                      <span className="my-2 inline-flex flex-wrap items-center gap-1.5 rounded border border-dashed border-zinc-700 px-2 py-1 text-[12px] text-zinc-500">
                        <ImageOff className="size-3.5" /> Remote image not archived{alt ? `: “${alt}”` : ""} — <a href={full} target="_blank" rel="noreferrer" className="underline">open original</a>
                      </span>
                    );
                  }
                  if (url.startsWith("data:image/")) {
                    // eslint-disable-next-line @next/next/no-img-element
                    return <img src={url} alt={alt ?? ""} className="max-h-96 max-w-full object-contain" />;
                  }
                  const path = mdDir ? `${mdDir}/${url}` : url;
                  return (
                    <button type="button" onClick={() => viewLocal(path, alt ?? "")} className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fileUrl(path)} alt={alt ?? ""} loading="lazy" className="max-h-96 max-w-full object-contain" />
                    </button>
                  );
                },
              }}
            >
              {data.content}
            </ReactMarkdown>
          </article>
        )}
        {data?.content && chosen?.kind === "text" && <pre className="wrap-anywhere whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-zinc-300 touchui:text-[14px]">{data.content}</pre>}
        {data && !data.content && data.renditions.some((x) => x.kind === "image") && (
          <div className="flex flex-col gap-3">
            {data.renditions.filter((x) => x.kind === "image").map((x) => (
              <figure key={x.key}>
                <button type="button" onClick={() => viewLocal(x.path, x.label)} className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl(x.path)} alt={x.label} className="max-h-[70vh] max-w-full bg-black object-contain" />
                </button>
                <figcaption className="wrap-anywhere mt-1 text-[11px] text-zinc-500">{x.label} · {x.path}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </>
  );

  const heading = (
    <>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400 touchui:text-[13px]">
        {r.reliability_class ? <Tag>class {r.reliability_class}</Tag> : <Tag className="text-amber-300">class pending</Tag>}
        {r.primary_or_secondary && <Tag>{r.primary_or_secondary}</Tag>}
        <span className="wrap-anywhere">{[r.publisher || art?.publication, r.publication_date, r.author || art?.author].filter(Boolean).join(" · ")}</span>
        {r.original_url && (
          <a href={r.original_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline touchui:min-h-8">original URL <ExternalLink className="size-3" /></a>
        )}
      </div>
    </>
  );

  if (page) {
    return (
      <div>
        <header className="px-5 pb-3 pt-4">
          <div className="text-[12px] uppercase tracking-wider text-yellow-300">Source</div>
          <h1 className="wrap-anywhere mt-1 text-[22px] font-semibold leading-tight text-zinc-50">{src.label}</h1>
          <div className="mt-2">{heading}</div>
          <button type="button" onClick={() => setMetaOpen(!metaOpen)} className="mt-2 flex min-h-11 w-full items-center gap-2 text-left text-[13px] text-zinc-400">
            Source metadata & provenance <ChevronDown className={cn("ml-auto size-4 transition-transform", !metaOpen && "-rotate-90")} />
          </button>
          {metaOpen && <div className="pb-2"><Field label="ID" value={src.id} mono /><SourceMeta sourceId={src.id} /></div>}
        </header>
        {article}
        <div className="mt-4 border-t-4 border-zinc-900">
          <SourceRelated sourceId={src.id} />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-zinc-800 px-4 py-2.5 pr-12">
        <DialogTitle className="text-[15px] text-zinc-50">{src.label}</DialogTitle>
        <DialogDescription render={<div />} className="mt-0.5 text-[11px] text-zinc-400">
          <span className="mr-1.5 font-mono">{src.id}</span>
          {heading}
        </DialogDescription>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">{article}</div>
        <aside className="w-[340px] shrink-0 overflow-y-auto border-l border-zinc-800">
          <div className="px-3 py-2"><SourceMeta sourceId={src.id} /></div>
          <SourceRelated sourceId={src.id} />
        </aside>
      </div>
    </>
  );
}

/** Desktop: the reader inside a large dialog. */
export function SourceViewer({ req, onClose }: { req: SourceViewRequest | null; onClose: () => void }) {
  if (!req) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[90vh] flex-col gap-0 overflow-hidden border border-zinc-800 bg-zinc-950 p-0 sm:max-w-[min(1400px,96vw)]">
        <SourceReader req={req} layout="dialog" />
      </DialogContent>
    </Dialog>
  );
}
