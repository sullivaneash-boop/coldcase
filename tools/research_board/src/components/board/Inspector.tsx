"use client";
import { useState } from "react";
import { BookOpen, Crosshair, Copy, ImageOff, Link2, AlertTriangle, ShieldAlert, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Asset, Entity } from "@/lib/types";
import { CLAIM_STATUS_META, REL_LABEL, TYPE_META } from "./constants";
import { ChipList, EntityChip, Field, Section, StatusBadge, Tag, TypeIcon, fileUrl } from "./bits";
import { useBoard } from "./context";
import { ProvenanceView } from "./Provenance";
import { ids, inSources, outTargets, timeGroups, uniq } from "./graph";

export function AssetGallery({ assets, empty = "No images recorded." }: { assets: Asset[]; empty?: string }) {
  const { openImage } = useBoard();
  if (!assets.length) return <p className="text-[12px] italic text-zinc-500">{empty}</p>;
  return (
    <div className="grid grid-cols-2 gap-2">
      {assets.map((a, i) => (
        <figure key={a.id} className="min-w-0 overflow-hidden rounded border border-zinc-800 bg-zinc-950">
          <button type="button" onClick={() => openImage(assets, i)} className="block w-full" aria-label={`View image ${i + 1} of ${assets.length}`}>
            {a.published && a.localPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl(a.localPath)} alt={a.altText || a.caption || ""} loading="lazy" className="h-28 w-full bg-black object-contain touchui:h-36" />
            ) : (
              <div className="flex h-28 flex-col items-center justify-center gap-1 bg-zinc-900 p-2 text-center text-[10px] text-zinc-500 touchui:h-36 touchui:text-[12px]">
                <ImageOff className="size-4" />
                {a.availability === "REMOTE_ONLY" ? "Remote image — bytes not archived" : a.availability === "EMBEDDED_IN_SOURCE" ? "Embedded in archived capture" : a.availability === "MISSING" ? "File missing from archive" : "Not included in this deployment"}
              </div>
            )}
          </button>
          <figcaption className="space-y-0.5 p-1.5">
            <div className="wrap-anywhere line-clamp-2 text-[11px] text-zinc-300 touchui:text-[13px]">{a.altText || a.caption || <span className="italic text-zinc-500">no caption/alt text</span>}</div>
            <div className="flex flex-wrap gap-1">
              <Tag className={a.status === "UNASSIGNED" ? "border-amber-700 text-amber-300" : ""}>{a.status}</Tag>
            </div>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Every relationship touching this record, grouped by type, with its basis. */
function AllRelationships({ e }: { e: Entity }) {
  const { idx } = useBoard();
  const edges = [...(idx.out.get(e.id) ?? []), ...(idx.inc.get(e.id) ?? [])];
  const groups = new Map<string, { id: string; category: string; dir: string }[]>();
  for (const x of edges) {
    const other = x.from === e.id ? x.to : x.from;
    const key = `${x.from === e.id ? "→" : "←"} ${REL_LABEL[x.rel] ?? x.rel.toLowerCase().replace(/_/g, " ")}`;
    if (!groups.has(key)) groups.set(key, []);
    if (!groups.get(key)!.some((g) => g.id === other)) groups.get(key)!.push({ id: other, category: x.category, dir: key });
  }
  return (
    <Section title="All relationships" count={edges.length} defaultOpen={false} hint="Sourced and register links only. Researcher and lead links are labelled. No link implies guilt.">
      <div className="flex flex-col gap-2">
        {[...groups.entries()].map(([k, list]) => (
          <div key={k}>
            <div className={cn("mb-1 text-[11px] text-zinc-500 touchui:text-[13px]", list[0].category === "RESEARCHER" && "text-amber-400", list[0].category === "LEAD" && "text-orange-300")}>
              {k} {list[0].category === "RESEARCHER" ? "· researcher connection — not evidence" : list[0].category === "LEAD" ? "· lead, not established" : ""} <span className="font-mono">({list.length})</span>
            </div>
            <ChipList ids={list.map((l) => l.id)} />
          </div>
        ))}
      </div>
    </Section>
  );
}

function ResearcherLinks({ id }: { id: string }) {
  const { idx } = useBoard();
  const links = idx.allEdges.filter((e) => e.category === "RESEARCHER" && (e.from === id || e.to === id));
  if (!links.length) return null;
  return (
    <Section title="Researcher links" count={links.length} hint="Researcher connection — not evidence. Analyst notes only; never a sourced relationship.">
      <div className="flex flex-col gap-1.5">
        {links.map((l) => (
          <div key={l.id} className="rounded border border-dashed border-amber-600/60 bg-amber-950/20 p-1.5">
            <EntityChip id={l.from === id ? l.to : l.from} />
            <div className="mt-1 text-[11px] text-amber-200/80">{l.notes}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function SourcedRelations({ e }: { e: Entity }) {
  const { idx } = useBoard();
  const lead = [...(idx.out.get(e.id) ?? []), ...(idx.inc.get(e.id) ?? [])].filter((x) => x.category === "LEAD");
  if (!lead.length) return null;
  return (
    <Section title="Research leads (not established)" count={lead.length}>
      {lead.map((l) => (
        <div key={l.id} className="mb-1.5 rounded border border-dashed border-orange-600/60 p-1.5">
          <div className="mb-1 text-[11px] text-orange-300">{REL_LABEL[l.rel] ?? l.rel}</div>
          <EntityChip id={l.from === e.id ? l.to : l.from} />
          {l.notes && <div className="mt-1 text-[11px] text-zinc-400">{l.notes}</div>}
        </div>
      ))}
    </Section>
  );
}

function RawRow({ e }: { e: Entity }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(e.row).filter(([k, v]) => k !== "_article" && v);
  return (
    <Section title={`Register row · ${e.register}.csv`}>
      <button type="button" className="text-[11px] text-zinc-400 underline touchui:min-h-11 touchui:text-[14px]" onClick={() => setOpen(!open)}>
        {open ? "Hide" : "Show"} all {entries.length} populated fields
      </button>
      {open && <div className="mt-1.5">{entries.map(([k, v]) => <Field key={k} label={k} value={String(v)} mono={k.endsWith("_id") || k.endsWith("_ids")} />)}</div>}
    </Section>
  );
}

function ClaimBody({ e }: { e: Entity }) {
  const { idx } = useBoard();
  const r = e.row;
  const meta = CLAIM_STATUS_META[e.status ?? "UNKNOWN"] ?? CLAIM_STATUS_META.UNKNOWN;
  const links = idx.claimSourcesByClaim.get(e.id) ?? [];
  const cons = inSources(idx, e.id, "CONTRADICTION_INVOLVES_CLAIM");
  const [tab, setTab] = useState<"provenance" | "links">("provenance");
  return (
    <>
      <div className="px-3 pb-2 touchui:px-4">
        <blockquote className={cn("border-l-2 border-zinc-500 pl-2 text-[13px] leading-snug text-zinc-100 touchui:text-[17px] touchui:leading-relaxed", e.status === "ALLEGED" && "italic")}>{r.claim}</blockquote>
        <div className={cn("mt-2 flex items-start gap-1.5 rounded border px-2 py-1 text-[11px] touchui:py-2 touchui:text-[14px]", meta.cls)}>
          <ShieldAlert className="mt-px size-3 shrink-0" />
          <span><b>{e.status}</b> — {meta.caveat}</span>
        </div>
        <div className="mt-2">
          <Field label="Confidence" value={<>{r.confidence || "UNKNOWN"} <span className="text-zinc-500">(human assessment, not probability)</span></>} />
          <Field label="Rationale" value={r.assessment_rationale} />
          <Field label="Reviewed" value={r.reviewed_by ? `${r.reviewed_by} · ${r.reviewed_at}` : <span className="text-amber-300">Not yet human-reviewed</span>} />
          <Field label="Notes" value={r.notes} />
        </div>
      </div>
      <div className="flex gap-1 border-t border-zinc-800 px-3 pt-2">
        {(["provenance", "links"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn("rounded px-2 py-0.5 text-[11px] touchui:min-h-11 touchui:flex-1 touchui:text-[14px]", tab === t ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800")}>
            {t === "provenance" ? "Source chain / provenance" : "Related records"}
          </button>
        ))}
      </div>
      {tab === "provenance" ? (
        <div className="px-3 py-2.5 touchui:px-4"><ProvenanceView claimId={e.id} /></div>
      ) : (
        <>
          <Section title="Supporting sources" count={links.filter((l) => l.relationship === "SUPPORTS").length}>
            <ChipList ids={uniq(links.filter((l) => l.relationship === "SUPPORTS").map((l) => l.sourceId))} />
          </Section>
          <Section title="Contradicting sources" count={links.filter((l) => l.relationship === "CONTRADICTS").length}>
            <ChipList ids={uniq(links.filter((l) => l.relationship === "CONTRADICTS").map((l) => l.sourceId))} empty="No contradicting source links recorded." />
          </Section>
          <Section title="People" count={ids(r.people_ids).length}><ChipList ids={ids(r.people_ids)} /></Section>
          <Section title="Events" count={ids(r.event_ids).length}><ChipList ids={ids(r.event_ids)} /></Section>
          <Section title="Locations" count={ids(r.location_ids).length}><ChipList ids={ids(r.location_ids)} /></Section>
          <Section title="Evidence" count={ids(r.evidence_ids).length}><ChipList ids={ids(r.evidence_ids)} /></Section>
          <Section title="Contradictions" count={cons.length}><ChipList ids={cons} /></Section>
        </>
      )}
    </>
  );
}

function PersonBody({ e }: { e: Entity }) {
  const { idx } = useBoard();
  const id = e.id;
  const statements = outTargets(idx, id, "MADE_STATEMENT");
  const recorded = inSources(idx, id, "RECORDED_BY");
  const claims = inSources(idx, id, "CLAIM_CONCERNS_PERSON");
  const spoke = uniq(idx.bundle.claimSources.filter((c) => c.speakerPersonId === id).map((c) => c.claimId));
  const mentionedBy = inSources(idx, id, "MENTIONS");
  const directEvents = inSources(idx, id, "EVENT_INVOLVES_PERSON");
  const viaStatements = uniq(statements.flatMap((s) => outTargets(idx, s, "STATEMENT_ABOUT_EVENT")));
  const viaClaims = uniq(claims.flatMap((c) => outTargets(idx, c, "CLAIM_CONCERNS_EVENT")));
  const events = uniq([...directEvents, ...viaStatements, ...viaClaims]);
  const eventNotes: Record<string, string> = {};
  for (const ev of events) eventNotes[ev] = directEvents.includes(ev) ? "listed on event" : viaStatements.includes(ev) ? "via their statement" : "via claim";
  const evidence = uniq([...inSources(idx, id, "EVIDENCE_RELATED_PERSON"), ...claims.flatMap((c) => outTargets(idx, c, "CLAIM_CONCERNS_EVIDENCE"))]);
  const statementCons = uniq(idx.bundle.contradictionVersions.filter((v) => v.statementId && statements.includes(v.statementId)).map((v) => v.contradictionId));
  const claimCons = uniq(claims.flatMap((c) => inSources(idx, c, "CONTRADICTION_INVOLVES_CLAIM")));
  const roles = [
    statements.length && `Gave ${statements.length} recorded statement version(s)`,
    recorded.length && `Recorded/reported ${recorded.length} statement(s) (e.g. byline)`,
    spoke.length && `Named speaker for ${spoke.length} attributed claim(s)`,
    claims.length && `Subject of ${claims.length} claim(s)`,
    mentionedBy.length && `Mentioned in ${mentionedBy.length} source(s)`,
  ].filter(Boolean) as string[];
  return (
    <>
      <div className="px-3 pb-2 touchui:px-4">
        <Field label="Aliases" value={ids(e.row.aliases).join(" · ")} />
        <Field label="Identity" value={<Tag>{e.row.identity_status || "UNKNOWN"}</Tag>} />
        <Field label="Restriction" value={e.row.access_restriction} />
        <Field label="Notes" value={e.row.notes} />
      </div>
      <Section title="Role in case (derived)" hint="The archive has no role register. These lines are counted from register links; they describe documentation, never culpability.">
        {roles.length ? <ul className="list-disc pl-4 text-[12px] text-zinc-300">{roles.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="text-[12px] italic text-zinc-500">No register links.</p>}
      </Section>
      <Section title="Related events" count={events.length}><ChipList ids={events} notes={eventNotes} /></Section>
      <Section title="Witness statements made" count={statements.length}><ChipList ids={statements} /></Section>
      {recorded.length > 0 && <Section title="Statements recorded/reported" count={recorded.length}><ChipList ids={recorded} /></Section>}
      <Section title="Claims concerning them" count={claims.length}><ChipList ids={claims} /></Section>
      {spoke.length > 0 && <Section title="Claims attributed to them as speaker" count={spoke.length}><ChipList ids={spoke} /></Section>}
      <Section title="Sources mentioning them" count={mentionedBy.length}><ChipList ids={mentionedBy} /></Section>
      <Section title="Evidence relationships" count={evidence.length}><ChipList ids={evidence} empty="No evidence records link this person." /></Section>
      <Section title="Contradictions involving their statements" count={statementCons.length + claimCons.length}>
        <ChipList ids={uniq([...statementCons, ...claimCons])} notes={Object.fromEntries(claimCons.filter((c) => !statementCons.includes(c)).map((c) => [c, "via claims concerning them"]))} empty="None recorded." />
      </Section>
      <Section title="Images" count={(idx.assetsByEntity.get(id) ?? []).length} hint="Only images whose source label names this person. No facial recognition.">
        <AssetGallery assets={idx.assetsByEntity.get(id) ?? []} />
      </Section>
      <SourcedRelations e={e} />
    </>
  );
}

function EvidenceBody({ e }: { e: Entity }) {
  const { idx } = useBoard();
  const r = e.row;
  const claims = inSources(idx, e.id, "CLAIM_CONCERNS_EVIDENCE");
  const cons = uniq(claims.flatMap((c) => inSources(idx, c, "CONTRADICTION_INVOLVES_CLAIM")));
  const sources = ids(r.source_ids);
  return (
    <>
      <div className="px-3 pb-2 touchui:px-4">
        <p className="text-[13px] text-zinc-100 touchui:text-[16px] touchui:leading-relaxed">{r.description}</p>
        <div className="mt-2">
          <Field label="Type" value={r.evidence_type} />
          <Field label="Custody" value={<><Tag>{r.custody_status || "UNKNOWN"}</Tag> <span className="text-zinc-500">catalog entry, not possession</span></>} />
          <Field label="Reported chain" value={r.reported_chain_of_custody} />
          <Field label="Notes" value={r.notes} />
        </div>
      </div>
      <Section title="Related events" count={ids(r.event_ids).length}><ChipList ids={ids(r.event_ids)} /></Section>
      <Section title="Locations" count={ids(r.location_ids).length}><ChipList ids={ids(r.location_ids)} /></Section>
      <Section title="Claims" count={claims.length}><ChipList ids={claims} /></Section>
      <Section title="Sources" count={sources.length}><ChipList ids={sources} /></Section>
      <Section title="Contradictions" count={cons.length}><ChipList ids={cons} /></Section>
      <Section title="Images" count={(idx.assetsByEntity.get(e.id) ?? []).length}><AssetGallery assets={idx.assetsByEntity.get(e.id) ?? []} /></Section>
    </>
  );
}

function EventBody({ e }: { e: Entity }) {
  const { idx, openSource } = useBoard();
  const r = e.row;
  const times = idx.eventTimesByEvent.get(e.id) ?? [];
  const groups = timeGroups(times);
  const claims = inSources(idx, e.id, "CLAIM_CONCERNS_EVENT");
  const statements = inSources(idx, e.id, "STATEMENT_ABOUT_EVENT");
  const cons = inSources(idx, e.id, "CONTRADICTION_CONCERNS_EVENT");
  const evidence = inSources(idx, e.id, "EVIDENCE_RELATED_EVENT");
  return (
    <>
      <div className="px-3 pb-2 touchui:px-4">
        <p className="text-[13px] text-zinc-100 touchui:text-[16px] touchui:leading-relaxed">{r.neutral_description}</p>
        <div className="mt-2">
          <Field label="Summary time" value={<><Tag>{r.time_status || "UNKNOWN"}</Tag> {r.start_at || "no date"}{r.local_start_time && ` ${r.local_start_time}`}{r.end_at && ` → ${r.end_at}`}{r.local_end_time && ` ${r.local_end_time}`}</>} />
          <Field label="Original wording" value={r.original_time_text && `“${r.original_time_text}”`} />
          <Field label="Precision" value={`date ${r.date_precision || "—"} · clock ${r.time_precision || "—"} · tz ${r.timezone || "not stated"}`} />
          <Field label="Confidence" value={r.confidence} />
          <Field label="Notes" value={r.notes} />
        </div>
      </div>
      <Section title="Time assertions" count={times.length} hint={groups.length > 1 ? undefined : "Each row is one attributed assertion; none is preferred automatically."}>
        {groups.length > 1 && (
          <div className="mb-2 flex items-center gap-1.5 rounded border border-red-700/60 bg-red-950/30 px-2 py-1 text-[11px] text-red-200">
            <AlertTriangle className="size-3" /> {groups.length} conflicting values — no version selected.
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {times.map((t) => (
            <div key={t.id} className="rounded border border-zinc-800 p-1.5 text-[11px] touchui:p-2.5 touchui:text-[14px]">
              <div className="flex flex-wrap items-center gap-1">
                <Tag>{t.timeStatus || "UNKNOWN"}</Tag>
                <span className="font-mono text-zinc-200">{t.startAt || "?"}{t.localStartTime && ` ${t.localStartTime}`}{(t.endAt || t.localEndTime) && " → "}{t.endAt && t.endAt !== t.startAt ? t.endAt : ""}{t.localEndTime && ` ${t.localEndTime}`}</span>
                {t.synthetic ? <Tag>event summary</Tag> : null}
              </div>
              {t.originalTimeText && <div className="mt-0.5 text-zinc-300">“{t.originalTimeText}”</div>}
              {t.sourceId && (
                <button type="button" className="mt-0.5 text-left text-zinc-400 underline touchui:min-h-11" onClick={() => openSource({ sourceId: t.sourceId!, locator: t.locator, anchor: t.originalTimeText })}>
                  {idx.byId.get(t.sourceId)?.label ?? t.sourceId}
                </button>
              )}
              {t.locator && <div className="font-mono text-[10px] text-zinc-500">{t.locator}</div>}
            </div>
          ))}
        </div>
      </Section>
      <Section title="People" count={ids(r.people_ids).length}><ChipList ids={ids(r.people_ids)} empty="No people listed on the event record (see claims and statements)." /></Section>
      <Section title="Locations" count={ids(r.location_ids).length}><ChipList ids={ids(r.location_ids)} /></Section>
      <Section title="Witness statements" count={statements.length}><ChipList ids={statements} /></Section>
      <Section title="Claims" count={claims.length}><ChipList ids={claims} /></Section>
      {evidence.length > 0 && <Section title="Evidence" count={evidence.length}><ChipList ids={evidence} /></Section>}
      <Section title="Contradictions" count={cons.length}><ChipList ids={cons} /></Section>
      <Section title="Sources" count={ids(r.source_ids).length}><ChipList ids={ids(r.source_ids)} /></Section>
    </>
  );
}

function SourceBody({ e }: { e: Entity }) {
  const { idx, openSource } = useBoard();
  const r = e.row;
  const art = r._article;
  const claims = uniq((idx.claimSourcesBySource.get(e.id) ?? []).map((c) => c.claimId));
  const mentions = outTargets(idx, e.id, "MENTIONS");
  const cites = outTargets(idx, e.id, "CITES_SOURCE");
  const citedBy = inSources(idx, e.id, "CITES_SOURCE");
  const pages = outTargets(idx, e.id, "APPEARS_ON_PAGE");
  const onPage = inSources(idx, e.id, "APPEARS_ON_PAGE");
  const chain = idx.chainBySource.get(e.id) ?? [];
  const heldBy = idx.bundle.sourceChain.filter((c) => c.heldSourceId === e.id).map((c) => c.sourceId);
  const statements = inSources(idx, e.id, "STATEMENT_RECORDED_IN");
  const events = inSources(idx, e.id, "EVENT_REPORTED_IN");
  const evidence = inSources(idx, e.id, "EVIDENCE_REPORTED_IN");
  return (
    <>
      <div className="px-3 pb-2 touchui:px-4">
        <button type="button" onClick={() => openSource({ sourceId: e.id })} className="mb-2 inline-flex items-center gap-1.5 rounded bg-yellow-500/15 px-2 py-1 text-[12px] text-yellow-200 hover:bg-yellow-500/25 touchui:min-h-11 touchui:w-full touchui:justify-center touchui:text-[15px]">
          <BookOpen className="size-3.5" /> Open source viewer
        </button>
        <Field label="Type" value={`${r.source_type}${e.subtype && e.subtype !== r.source_type ? ` · ${e.subtype.toLowerCase().replace(/_/g, " ")}` : ""}`} />
        <Field label="Publisher" value={r.publisher || art?.publication} />
        <Field label="Author" value={r.author || art?.author} />
        <Field label="Published" value={r.publication_date && `${r.publication_date} (${r.publication_date_precision || "precision n/a"})`} />
        <Field label="Covers" value={r.underlying_event_start && `${r.underlying_event_start} → ${r.underlying_event_end || "?"}`} />
        <Field label="Reliability" value={r.reliability_class ? <><Tag>class {r.reliability_class}</Tag> <span className="text-zinc-500">describes the source, not any claim</span></> : <span className="text-amber-300">class pending review</span>} />
        <Field label="Primary/sec." value={r.primary_or_secondary} />
        <Field label="Knowledge" value={r.knowledge_basis} />
        <Field label="URL" value={r.original_url && <a href={r.original_url} target="_blank" rel="noreferrer" className="break-all underline">{r.original_url}</a>} />
        <Field label="Archived" value={r.local_file} mono />
        <Field label="Notes" value={r.notes} />
        {art?.summary && <Field label="Summary" value={<span className="text-zinc-400">{art.summary} <i>(analysis, not source text)</i></span>} />}
      </div>
      <Section title="Extracted claims" count={claims.length}><ChipList ids={claims} /></Section>
      <Section title="Witness statements" count={statements.length}><ChipList ids={statements} /></Section>
      <Section title="Events" count={events.length}><ChipList ids={events} /></Section>
      <Section title="Evidence" count={evidence.length}><ChipList ids={evidence} /></Section>
      <Section title="People / places / orgs mentioned" count={mentions.length}><ChipList ids={mentions} /></Section>
      <Section title="Underlying sources referenced" count={chain.length + cites.length} hint="From source_chain.csv and CITES_SOURCE relationships. Not acquired ≠ held.">
        <div className="flex flex-col gap-1">
          {cites.map((c) => <EntityChip key={c} id={c} note="cites" />)}
          {chain.filter((c) => !c.heldSourceId || !cites.includes(c.heldSourceId)).map((c) => (
            c.heldSourceId ? <EntityChip key={c.id} id={c.heldSourceId} note="underlying (held)" /> : (
              <div key={c.id} className="rounded border border-dashed border-zinc-700 px-1.5 py-1 text-[11px]">
                <div className="text-zinc-300">{c.underlyingSource}</div>
                <div className="text-[10px] text-zinc-500">{c.sourceType} · {c.holdingStatus}{c.url && <> · <a className="underline" href={c.url} target="_blank" rel="noreferrer">link</a></>}</div>
              </div>
            )
          ))}
          {!chain.length && !cites.length && <p className="text-[12px] italic text-zinc-500">None recorded.</p>}
        </div>
      </Section>
      {(citedBy.length > 0 || heldBy.length > 0) && <Section title="Repeated / cited by" count={uniq([...citedBy, ...heldBy]).length} hint="These later sources derive from this one; they are not independent corroboration."><ChipList ids={uniq([...citedBy, ...heldBy])} /></Section>}
      {pages.length > 0 && <Section title="Printed on page scans" count={pages.length}><ChipList ids={pages} /></Section>}
      {onPage.length > 0 && <Section title="Articles on this page" count={onPage.length}><ChipList ids={onPage} /></Section>}
      <Section title="Images / assets" count={(idx.assetsBySource.get(e.id) ?? []).length}><AssetGallery assets={idx.assetsBySource.get(e.id) ?? []} /></Section>
    </>
  );
}

function StatementBody({ e }: { e: Entity }) {
  const { idx, openSource } = useBoard();
  const r = e.row;
  const series = idx.bundle.entities.filter((x) => x.type === "WITNESS_STATEMENT" && x.row.statement_series_id === r.statement_series_id && x.id !== e.id).map((x) => x.id);
  return (
    <>
      <div className="px-3 pb-2 touchui:px-4">
        <div className="mb-1 flex flex-wrap gap-1"><Tag>{r.representation_type || "UNKNOWN"}</Tag><Tag>{r.knowledge_basis || "UNKNOWN"}</Tag><Tag>v{r.version_number}</Tag></div>
        {r.statement_text && (
          <blockquote className="whitespace-pre-wrap border-l-2 border-cyan-600 pl-2 text-[12px] leading-snug text-zinc-100 touchui:text-[16px] touchui:leading-relaxed">
            {r.statement_text}
          </blockquote>
        )}
        <p className="mt-1 text-[10px] text-zinc-500">{r.representation_type === "VERBATIM" ? "Recorded as verbatim text." : "Synopsis/paraphrase — consult the source for exact wording."}</p>
        <div className="mt-2">
          <Field label="Witness" value={r.witness_person_id && <EntityChip id={r.witness_person_id} />} />
          <Field label="Recorded by" value={(r.recorded_by_person_id || r.recorded_by_organization_id) && <div className="flex flex-col items-start gap-1">{r.recorded_by_person_id && <EntityChip id={r.recorded_by_person_id} />}{r.recorded_by_organization_id && <EntityChip id={r.recorded_by_organization_id} />}</div>} />
          <Field label="Statement date" value={`${r.statement_date || "unknown"} (${r.statement_date_precision || "?"}) — publication date for newspaper accounts`} />
          <Field label="Limitations" value={r.limitations} />
          <Field label="Locator" value={r.source_locator} mono />
        </div>
        {r.source_id && (
          <button type="button" onClick={() => openSource({ sourceId: r.source_id, locator: r.source_locator })} className="mt-1 inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-700 touchui:min-h-11 touchui:text-[14px]">
            <BookOpen className="size-3" /> Open source
          </button>
        )}
        {r.transcript_file && <a className="ml-2 text-[11px] text-zinc-400 underline" href={fileUrl(r.transcript_file)} target="_blank" rel="noreferrer">synopsis file</a>}
      </div>
      <Section title="About events" count={ids(r.underlying_event_ids).length}><ChipList ids={ids(r.underlying_event_ids)} /></Section>
      <Section title="Other versions in this account series" count={series.length}><ChipList ids={series} empty="No other versions recorded." /></Section>
      <Section title="Source"><ChipList ids={ids(r.source_id)} /></Section>
    </>
  );
}

function ContradictionBody({ e }: { e: Entity }) {
  const { idx, openSource } = useBoard();
  const r = e.row;
  const versions = idx.versionsByContradiction.get(e.id) ?? [];
  return (
    <>
      <div className="px-3 pb-2 touchui:px-4">
        <p className="text-[13px] text-zinc-100 touchui:text-[16px] touchui:leading-relaxed">{r.description}</p>
        <div className="mt-2 rounded border border-red-800/60 bg-red-950/20 px-2 py-1 text-[11px] text-red-200">
          Status <b>{r.status}</b>. All alternatives are retained; no version is preferred automatically.
        </div>
        <Field label="Resolution" value={r.resolution_notes} />
        <Field label="Notes" value={r.notes} />
      </div>
      <Section title="Competing versions" count={versions.length}>
        <div className="flex flex-col gap-1.5">
          {versions.map((v, i) => (
            <div key={v.id} className="rounded border border-zinc-800 p-1.5 text-[12px] touchui:p-2.5 touchui:text-[15px]">
              <div className="mb-0.5 text-[10px] uppercase tracking-wider text-zinc-500">Version {String.fromCharCode(65 + i)} {v.assertedStartAt && <span className="font-mono normal-case text-zinc-300">· {v.assertedStartAt}</span>}</div>
              <div className="text-zinc-100">“{v.versionText}”</div>
              {v.sourceId && <button type="button" className="mt-0.5 text-left text-[11px] text-zinc-400 underline touchui:min-h-11 touchui:text-[14px]" onClick={() => openSource({ sourceId: v.sourceId!, locator: v.locator, anchor: v.versionText })}>{idx.byId.get(v.sourceId)?.label ?? v.sourceId}</button>}
              {v.locator && <div className="font-mono text-[10px] text-zinc-500">{v.locator}</div>}
              {v.claimId && <div className="mt-1"><EntityChip id={v.claimId} /></div>}
            </div>
          ))}
        </div>
      </Section>
      <Section title="Claims" count={ids(r.claim_ids).length}><ChipList ids={ids(r.claim_ids)} /></Section>
      <Section title="Events" count={ids(r.event_ids).length}><ChipList ids={ids(r.event_ids)} /></Section>
    </>
  );
}

function GenericBody({ e }: { e: Entity }) {
  const { idx } = useBoard();
  const mentionedBy = inSources(idx, e.id, "MENTIONS");
  const relIn = (rel: string) => inSources(idx, e.id, rel);
  return (
    <>
      <div className="px-3 pb-2 touchui:px-4">
        <Field label="Type" value={e.row.location_type || e.row.organization_type} />
        <Field label="Address" value={e.row.address} />
        <Field label="Coordinates" value={e.row.latitude && `${e.row.latitude}, ${e.row.longitude} (${e.row.coordinate_reference_system})`} />
        <Field label="Jurisdiction" value={e.row.jurisdiction_description} />
        <Field label="Notes" value={e.row.notes} />
      </div>
      {e.type === "LOCATION" && (
        <>
          <Section title="Events reported here" count={relIn("EVENT_REPORTED_AT").length}><ChipList ids={relIn("EVENT_REPORTED_AT")} /></Section>
          <Section title="Evidence reported here" count={relIn("EVIDENCE_REPORTED_AT").length}><ChipList ids={relIn("EVIDENCE_REPORTED_AT")} /></Section>
          <Section title="Claims" count={relIn("CLAIM_CONCERNS_LOCATION").length}><ChipList ids={relIn("CLAIM_CONCERNS_LOCATION")} /></Section>
        </>
      )}
      {e.type === "ORGANIZATION" && (
        <Section title="Statements recorded" count={relIn("RECORDED_BY").length}><ChipList ids={relIn("RECORDED_BY")} /></Section>
      )}
      <Section title="Sources mentioning" count={mentionedBy.length}><ChipList ids={mentionedBy} /></Section>
    </>
  );
}

export function Inspector() {
  const { idx, selectedId, select, addResearcherLink, focusRelationships, isMobile } = useBoard();
  const e = selectedId ? idx.byId.get(selectedId) : null;
  if (!e) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-[12px] text-zinc-500">
        <Crosshair className="size-5" />
        Select a node, timeline event or search result to inspect it.
        <span className="text-[11px]">Every linked record is clickable.</span>
      </div>
    );
  }
  const meta = TYPE_META[e.type];
  const Body = { CLAIM: ClaimBody, PERSON: PersonBody, EVIDENCE: EvidenceBody, EVENT: EventBody, SOURCE: SourceBody, WITNESS_STATEMENT: StatementBody, CONTRADICTION: ContradictionBody, LOCATION: GenericBody, ORGANIZATION: GenericBody }[e.type];
  const subtitleTags = [e.type !== "CLAIM" && e.status, e.confidence && `${e.confidence} confidence`].filter(Boolean) as string[];
  return (
    <div className="pb-6">
      <div className={cn("border-b border-zinc-800 bg-zinc-950/95 px-3 py-2 backdrop-blur", !isMobile && "sticky top-0 z-10", isMobile && "px-4 py-3")}>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider touchui:text-[12px]" style={{ color: meta.color }}>
          <TypeIcon type={e.type} /> {e.subtype === "NEWSPAPER_PAGE" ? "Newspaper page scan" : meta.label}
          {e.type === "CLAIM" && <StatusBadge status={e.status} />}
        </div>
        <h2 className={cn("wrap-anywhere mt-0.5 text-[14px] font-semibold leading-snug text-zinc-50 touchui:text-[20px] touchui:leading-tight", e.type === "CLAIM" && !isMobile && "line-clamp-3")}>{e.label}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <button type="button" title="Copy ID" onClick={() => navigator.clipboard?.writeText(e.id)} className="wrap-anywhere inline-flex items-center gap-1 text-left font-mono text-[10px] text-zinc-500 hover:text-zinc-300 touchui:min-h-11 touchui:text-[12px]">
            {e.id} <Copy className="size-2.5 shrink-0" />
          </button>
          {subtitleTags.map((t) => <Tag key={t}>{t}</Tag>)}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1 touchui:mt-3 touchui:grid touchui:grid-cols-2 touchui:gap-2">
          <button type="button" onClick={() => (isMobile ? focusRelationships(e.id) : select(e.id, { focus: true }))} className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-700 touchui:min-h-11 touchui:justify-center touchui:text-[14px]">
            {isMobile ? <Share2 className="size-4" /> : <Crosshair className="size-3" />} {isMobile ? "Focus relationships" : "Focus on board"}
          </button>
          {!idx.bundle.meta.readOnly && <button type="button" onClick={() => addResearcherLink(e.id)} className="inline-flex items-center gap-1 rounded border border-dashed border-amber-600/60 px-2 py-0.5 text-[11px] text-amber-300 hover:bg-amber-950/40 touchui:min-h-11 touchui:justify-center touchui:text-[14px]">
            <Link2 className="size-3 touchui:size-4" /> Researcher link
          </button>}
        </div>
      </div>
      <div className="pt-2"><Body e={e} /></div>
      <ResearcherLinks id={e.id} />
      {e.type !== "PERSON" && <SourcedRelations e={e} />}
      <AllRelationships e={e} />
      <RawRow e={e} />
    </div>
  );
}
