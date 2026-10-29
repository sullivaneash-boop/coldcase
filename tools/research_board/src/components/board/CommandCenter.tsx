"use client";
import { useMemo, useState } from "react";
import { Brain, Check, Flag, MessageSquarePlus, ThumbsDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ANALYSIS_GRADES, type AnalysisDecision, type CaseReview, type ReviewItem, type ReviewNote } from "@/lib/types";
import { EntityChip } from "./bits";
import { useBoard } from "./context";
import { ResearchStatus } from "./ResearchStatus";

// ---------------------------------------------------------------- labels and colours
export const GRADE_META: Record<string, { label: string; cls: string }> = {
  CONFIRMED: { label: "Confirmed", cls: "border-emerald-600 bg-emerald-950/60 text-emerald-200" },
  STRONGLY_SUPPORTED: { label: "Strongly supported", cls: "border-emerald-800 bg-emerald-950/30 text-emerald-300" },
  PROBABLE: { label: "Probable", cls: "border-sky-800 bg-sky-950/40 text-sky-200" },
  POSSIBLE: { label: "Possible", cls: "border-zinc-600 bg-zinc-800/60 text-zinc-200" },
  ALLEGED: { label: "Alleged", cls: "border-amber-700 bg-amber-950/40 text-amber-200" },
  DISPUTED: { label: "Disputed", cls: "border-orange-700 bg-orange-950/40 text-orange-200" },
  RUMOR: { label: "Rumor", cls: "border-rose-800 bg-rose-950/40 text-rose-200" },
  UNKNOWN: { label: "Unknown", cls: "border-zinc-700 bg-zinc-900 text-zinc-400" },
};

const DECISION_META: Record<string, { label: string; cls: string }> = {
  AGREE: { label: "Agreed", cls: "text-emerald-300" },
  DISAGREE: { label: "Disagreed", cls: "text-rose-300" },
  NEEDS_REVIEW: { label: "Marked for review", cls: "text-amber-300" },
  REGRADE: { label: "Regraded", cls: "text-sky-300" },
  NOTE: { label: "Note", cls: "text-zinc-300" },
};

const SECTIONS = [
  ["overview", "Case overview"], ["observations", "Key observations"], ["timeline", "Master timeline"], ["evidence", "Key evidence"],
  ["people", "People"], ["locations", "Locations"], ["contradictions", "Contradictions & gaps"], ["hypotheses", "Hypothesis matrix"],
  ["priorities", "Investigative priorities"], ["questions", "Open questions"], ["bias", "Bias & narrative audit"], ["provenance", "Source provenance"],
  ["critique", "Project self-critique"], ["activity", "Recent activity"], ["review", "Needs your judgment"],
] as const;

export function GradeBadge({ grade, override }: { grade?: string | null; override?: string | null }) {
  const g = override ?? grade;
  if (!g) return null;
  const m = GRADE_META[g] ?? GRADE_META.UNKNOWN;
  return (
    <span title={override ? `You regraded this (Claude: ${GRADE_META[grade ?? ""]?.label ?? grade ?? "none"})` : "Claude's grade of source support — not a truth score"}
      className={cn("inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-px text-[10px] font-medium touchui:text-[12px]", m.cls)}>
      {override && <User className="size-3" />}{m.label}
    </span>
  );
}

function LayerTag({ kind }: { kind: "analysis" | "hypothesis" | "human" }) {
  const m = {
    analysis: { label: "Claude analysis", icon: Brain, cls: "border-violet-800 text-violet-300" },
    hypothesis: { label: "Hypothesis", icon: Brain, cls: "border-fuchsia-800 text-fuchsia-300" },
    human: { label: "Your note", icon: User, cls: "border-emerald-800 text-emerald-300" },
  }[kind];
  return <span className={cn("inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-px text-[10px] uppercase tracking-wide touchui:text-[11px]", m.cls)}><m.icon className="size-3" />{m.label}</span>;
}

// ---------------------------------------------------------------- human controls
type NotesApi = { notesFor: (id: string) => ReviewNote[]; add: (n: ReviewNote) => void; readOnly: boolean };

function latestGrade(notes: ReviewNote[]) {
  return [...notes].reverse().find((n) => n.decision === "REGRADE")?.grade ?? null;
}

function HumanControls({ item, api }: { item: ReviewItem; api: NotesApi }) {
  const notes = api.notesFor(item.id);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [grade, setGrade] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (decision: AnalysisDecision) => {
    setBusy(true);
    try {
      const res = await fetch("/api/review", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: item.id, decision, grade: decision === "REGRADE" ? grade : undefined, note: text }),
      });
      const r = await res.json();
      if (!res.ok) return alert(r.error ?? "Failed to record");
      api.add(r.note);
      setText("");
      setGrade("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };
  const btn = "inline-flex items-center gap-1 rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-zinc-500 disabled:opacity-40 touchui:min-h-10 touchui:px-3 touchui:text-[13px]";
  return (
    <div className="mt-2 space-y-1.5">
      {notes.length > 0 && (
        <ul className="space-y-1 rounded border border-emerald-900/50 bg-emerald-950/10 p-2">
          {notes.map((n) => (
            <li key={n.id} className="text-[12px] text-zinc-300 touchui:text-[14px]">
              <LayerTag kind="human" /> <span className={cn("font-medium", DECISION_META[n.decision]?.cls)}>{DECISION_META[n.decision]?.label ?? n.decision}</span>
              {n.grade && <> → <GradeBadge grade={n.grade} /></>}
              {n.note && <span className="text-zinc-300"> — {n.note}</span>}
              <span className="ml-1 text-[10px] text-zinc-600">{n.decidedBy} · {n.decidedAt?.slice(0, 16).replace("T", " ")}</span>
            </li>
          ))}
        </ul>
      )}
      {api.readOnly ? null : !open ? (
        <div className="flex flex-wrap gap-1">
          <button type="button" className={btn} disabled={busy} onClick={() => send("AGREE")}><Check className="size-3" />Agree</button>
          <button type="button" className={btn} disabled={busy} onClick={() => setOpen(true)}><ThumbsDown className="size-3" />Disagree / regrade</button>
          <button type="button" className={btn} disabled={busy} onClick={() => send("NEEDS_REVIEW")}><Flag className="size-3" />Mark for review</button>
          <button type="button" className={btn} disabled={busy} onClick={() => setOpen(true)}><MessageSquarePlus className="size-3" />Note</button>
        </div>
      ) : (
        <div className="space-y-1.5 rounded border border-zinc-700 p-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Your reasoning or note (saved to review_decisions.csv)"
            className="w-full rounded border border-zinc-700 bg-zinc-900 p-1.5 text-[12px] text-zinc-100 outline-none touchui:text-[16px]" />
          <div className="flex flex-wrap items-center gap-1">
            <select value={grade} onChange={(e) => setGrade(e.target.value)} className="h-7 rounded border border-zinc-700 bg-zinc-900 px-1 text-[11px] text-zinc-200 touchui:h-10 touchui:text-[14px]">
              <option value="">Change grade…</option>
              {ANALYSIS_GRADES.map((g) => <option key={g} value={g}>{GRADE_META[g].label}</option>)}
            </select>
            <button type="button" className={btn} disabled={busy || !grade} onClick={() => send("REGRADE")}>Save grade</button>
            <button type="button" className={btn} disabled={busy} onClick={() => send("DISAGREE")}>Disagree</button>
            <button type="button" className={btn} disabled={busy || !text.trim()} onClick={() => send("NOTE")}>Save note</button>
            <button type="button" className="px-1 text-[11px] text-zinc-500 touchui:min-h-10" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- building blocks
function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={`cc-${id}`} className="scroll-mt-4 space-y-2">
      <h2 className="text-[16px] font-semibold text-zinc-100 touchui:text-[18px]">{title}</h2>
      {intro && <p className="max-w-3xl text-[12px] text-zinc-500 touchui:text-[14px]">{intro}</p>}
      {children}
    </section>
  );
}

function Refs({ ids }: { ids?: string[] }) {
  if (!ids?.length) return null;
  return <div className="mt-1.5 flex flex-wrap gap-1">{ids.map((id) => <EntityChip key={id} id={id} className="max-w-[18rem]" />)}</div>;
}

function Card({ item, api, kind = "analysis", title, children }: { item: ReviewItem; api: NotesApi; kind?: "analysis" | "hypothesis"; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <header className="flex flex-wrap items-start gap-2">
        <span className="font-mono text-[10px] text-zinc-600 touchui:text-[12px]">{item.id}</span>
        <h3 className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-zinc-100 touchui:text-[15px]">{title}</h3>
        <LayerTag kind={kind} />
        <GradeBadge grade={item.grade} override={latestGrade(api.notesFor(item.id))} />
      </header>
      <div className="mt-1 text-[12px] leading-relaxed text-zinc-300 touchui:text-[14px]">{children}</div>
      <Refs ids={item.recordIds} />
      <HumanControls item={item} api={api} />
    </article>
  );
}

const s = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
function Field({ label, value }: { label: string; value: unknown }) {
  const t = s(value);
  if (!t) return null;
  return <p><span className="text-zinc-500">{label}: </span>{t}</p>;
}
function Bullets({ label, items, cls }: { label: string; items: string[]; cls?: string }) {
  if (!items.length) return null;
  return (
    <div className="min-w-0">
      <div className={cn("text-[10px] font-semibold uppercase tracking-wider touchui:text-[12px]", cls ?? "text-zinc-500")}>{label}</div>
      <ul className="mt-0.5 list-disc space-y-0.5 pl-4">{items.map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
  );
}

// ---------------------------------------------------------------- the page
export function CommandCenter() {
  const { idx } = useBoard();
  const review = idx.bundle.review;
  const [added, setAdded] = useState<ReviewNote[]>([]);
  const notes = useMemo(() => [...idx.bundle.reviewNotes, ...added], [idx.bundle.reviewNotes, added]);
  const byItem = useMemo(() => {
    const m = new Map<string, ReviewNote[]>();
    for (const n of notes) m.set(n.itemId, [...(m.get(n.itemId) ?? []), n]);
    return m;
  }, [notes]);
  const api: NotesApi = { notesFor: (id) => byItem.get(id) ?? [], add: (n) => setAdded((a) => [...a, n]), readOnly: idx.bundle.meta.readOnly };

  if (!review) {
    return <div className="p-6 text-[13px] text-zinc-500">No independent review found. Add <code>11_ANALYSIS/independent_review/case_review.json</code> and run <code>npm run case:sync</code>.</div>;
  }
  return <CommandCenterBody review={review} api={api} notes={notes} />;
}

function CommandCenterBody({ review: r, api, notes }: { review: CaseReview; api: NotesApi; notes: ReviewNote[] }) {
  const flagged = useMemo(() => {
    const latest = new Map<string, ReviewNote>();
    for (const n of notes) latest.set(n.itemId, n);
    return [...latest.values()].filter((n) => n.decision === "NEEDS_REVIEW" || n.decision === "DISAGREE");
  }, [notes]);
  const allItems = useMemo(() => new Map(
    (["observations", "timeline", "evidence", "people", "locations", "contradictions", "hypotheses", "priorities", "openQuestions", "biasAudit", "provenance", "humanReview"] as const)
      .flatMap((k) => r[k].map((i) => [i.id, i] as const))), [r]);
  const gradeCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const t of r.timeline) c.set(t.grade ?? "UNKNOWN", (c.get(t.grade ?? "UNKNOWN") ?? 0) + 1);
    return ANALYSIS_GRADES.filter((g) => c.has(g)).map((g) => [g, c.get(g)!] as const);
  }, [r]);
  const lineage = (ids: unknown) => list(ids).map((l) => r.lineages.find((x) => x.id === l)?.label ?? l);
  const jump = (id: string) => document.getElementById(`cc-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const tiers = ["P0", "P1", "P2", "P3"];
  const tierIntro: Record<string, string> = {
    P0: "Case-changing: could identify or exclude an offender or establish a critical event.",
    P1: "High value: could resolve an important contradiction or timeline gap.",
    P2: "Supporting: improves understanding or provenance.",
    P3: "Speculative: kept, not worth major effort now.",
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-6 p-4 sm:p-6">
      <nav className="sticky top-4 hidden h-fit w-48 shrink-0 space-y-0.5 lg:block" aria-label="Command center sections">
        {SECTIONS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => jump(id)} className="block w-full rounded px-2 py-1 text-left text-[12px] text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100">
            {label}{id === "review" && flagged.length + r.humanReview.length > 0 && <span className="ml-1 rounded-full bg-amber-900/60 px-1.5 font-mono text-[10px] text-amber-200">{r.humanReview.length + flagged.length}</span>}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1 space-y-8">
        <div className="rounded-lg border border-violet-900/60 bg-violet-950/10 p-3 text-[12px] text-zinc-400 touchui:text-[14px]">
          <div className="flex flex-wrap items-center gap-2"><LayerTag kind="analysis" /><b className="text-zinc-200">{r.meta.title}</b> <span>v{r.meta.version} · updated {r.meta.updatedAt} · {r.meta.author}</span></div>
          <p className="mt-1">{r.meta.disclaimer}</p>
          <p className="mt-1 text-zinc-500 [&_code]:break-all">How to tell layers apart: <b className="text-zinc-300">Sources</b> are the archived originals; <b className="text-zinc-300">records</b> (chips) are the structured registers; <span className="text-violet-300">Claude analysis</span> and <span className="text-fuchsia-300">hypotheses</span> live in <code>{r.file}</code>; <span className="text-emerald-300">your notes</span> are appended to <code>review_decisions.csv</code>. Notebook: <code>{r.meta.notebook}</code>.</p>
          <div className="mt-2 flex flex-wrap gap-1">{r.gradeScale.map((g) => <span key={g.grade} title={g.meaning}><GradeBadge grade={g.grade} /></span>)}</div>
        </div>

        <Section id="overview" title="Case overview">
          <p className="max-w-4xl text-[15px] font-medium leading-relaxed text-zinc-100 touchui:text-[17px]">{r.overview.headline}</p>
          <div className="max-w-4xl space-y-2 text-[13px] leading-relaxed text-zinc-300 touchui:text-[15px]">{r.overview.paragraphs.map((p) => <p key={p.slice(0, 40)}>{p}</p>)}</div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-zinc-500">Timeline support: {gradeCounts.map(([g, n]) => <span key={g} className="inline-flex items-center gap-1"><GradeBadge grade={g} /><span className="font-mono">{n}</span></span>)}</div>
        </Section>

        <Section id="observations" title="Ten most important observations" intro="Ranked by how much each changes the model of the case.">
          <div className="grid gap-2 xl:grid-cols-2">
            {r.observations.map((o) => <Card key={o.id} item={o} api={api} title={<>{String(o.rank)}. {s(o.title)}</>}>{s(o.detail)}</Card>)}
          </div>
        </Section>

        <Section id="timeline" title="Master timeline" intro="Best-supported chronology. A grade reflects provenance and independence; renditions of one lineage count once. Clock times are as reported, EDT assumed.">
          <ol className="space-y-2 border-l border-zinc-800 pl-4">
            {r.timeline.map((t) => (
              <li key={t.id} className="relative">
                <span className="absolute -left-[21px] top-3 size-2.5 rounded-full border border-zinc-600 bg-zinc-900" />
                <Card item={t} api={api} title={<><span className="mr-2 font-mono text-[12px] text-zinc-400">{s(t.when)}</span>{s(t.title)}</>}>
                  <div className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
                    <Field label="Basis" value={t.basis} />
                    <Field label="Contemporaneous?" value={t.contemporaneous} />
                    <Field label="Precision" value={t.precision} />
                    <Field label="Corroboration" value={t.corroboration} />
                  </div>
                  {list(t.lineages).length > 0 && <p className="text-zinc-500">Lineage: {lineage(t.lineages).join(" · ")}</p>}
                  {s(t.conflicts) && <p className="text-orange-300">Conflicts: {s(t.conflicts)}</p>}
                  {s(t.note) && <p className="text-zinc-400">{s(t.note)}</p>}
                </Card>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="evidence" title="Key evidence" intro="What exists or is reported, who holds it, and what modern methods could do with it. The archive holds no physical evidence.">
          <div className="grid gap-2 xl:grid-cols-2">
            {r.evidence.map((e) => (
              <Card key={e.id} item={e} api={api} title={s(e.item)}>
                <Field label="Status" value={e.status} />
                <Field label="What we know" value={e.whatWeKnow} />
                <Field label="Custodian" value={e.custodian} />
                <Field label="Forensic opportunity" value={e.forensicOpportunity} />
              </Card>
            ))}
          </div>
        </Section>

        <Section id="people" title="People" intro="Grouped by role in the record. Order and placement imply nothing about involvement.">
          <div className="grid gap-2 xl:grid-cols-2">
            {r.people.map((p) => (
              <Card key={p.id} item={p} api={api} title={<>{s(p.name)} <span className="font-normal text-zinc-500">— {s(p.role)}</span></>}>
                <Field label="Why they matter" value={p.whyTheyMatter} />
                {s(p.caution) && <p className="text-amber-300/90">Caution: {s(p.caution)}</p>}
              </Card>
            ))}
          </div>
        </Section>

        <Section id="locations" title="Locations">
          <div className="grid gap-2 xl:grid-cols-2">
            {r.locations.map((l) => <Card key={l.id} item={l} api={api} title={<>{s(l.name)} <span className="font-normal text-zinc-500">— {s(l.role)}</span></>}>{s(l.notes)}</Card>)}
          </div>
        </Section>

        <Section id="contradictions" title="Contradictions & gaps" intro="Every version is preserved. Assessments say which is better supported and why; none erase a version.">
          <div className="space-y-2">
            {r.contradictions.map((c) => (
              <Card key={c.id} item={c} api={api} title={s(c.title)}>
                <Bullets label="Versions" items={list(c.versions)} />
                <Field label="Assessment" value={c.assessment} />
                <Field label="What would resolve it" value={c.whatResolves} />
              </Card>
            ))}
          </div>
        </Section>

        <Section id="hypotheses" title="Competing hypothesis matrix" intro="Explanations, not accusations. Each is stated with what supports it, what contradicts it, and what would disprove it. No person is identified as a perpetrator.">
          <div className="space-y-2">
            {r.hypotheses.map((h) => (
              <Card key={h.id} item={h} api={api} kind="hypothesis" title={<>{s(h.title)} <span className="ml-1 rounded bg-zinc-800 px-1.5 py-px text-[10px] font-normal text-zinc-300">weight: {s(h.currentWeight)}</span></>}>
                <p>{s(h.summary)}</p>
                <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <Bullets label="Supports" items={list(h.supports)} cls="text-emerald-400" />
                  <Bullets label="Contradicts" items={list(h.contradicts)} cls="text-rose-400" />
                  <Bullets label="Neutral" items={list(h.neutral)} />
                  <Bullets label="Unknown" items={list(h.unknown)} cls="text-zinc-400" />
                  <Bullets label="Needed to test" items={list(h.neededToTest)} cls="text-sky-400" />
                </div>
                <div className="mt-2 grid gap-x-4 sm:grid-cols-2">
                  <Field label="If wrong, expect" value={h.ifWrongExpect} />
                  <Field label="If right, expect" value={h.ifRightExpect} />
                  <Field label="Would materially move it" value={h.whatWouldMoveIt} />
                </div>
              </Card>
            ))}
          </div>
        </Section>

        <Section id="priorities" title="Investigative priorities" intro="Ranked by the chance of producing new information that changes the model, favouring things that can actually be obtained or tested.">
          {tiers.map((t) => {
            const items = r.priorities.filter((p) => p.tier === t);
            if (!items.length) return null;
            return (
              <div key={t} className="space-y-2">
                <h3 className="text-[13px] font-semibold text-zinc-200">{t} <span className="font-normal text-zinc-500">— {tierIntro[t]}</span></h3>
                {items.map((p) => (
                  <Card key={p.id} item={p} api={api} title={<><span className="mr-1.5 rounded bg-zinc-800 px-1.5 font-mono text-[11px] text-zinc-200">{t}</span>{s(p.question)}</>}>
                    <Field label="Why it matters" value={p.whyItMatters} />
                    <Field label="What would answer it" value={p.whatWouldAnswer} />
                    <Field label="Likely source / custodian" value={p.custodian} />
                    <Field label="Result that would change our model" value={p.resultThatChangesModel} />
                    <Field label="Status" value={p.status} />
                  </Card>
                ))}
              </div>
            );
          })}
        </Section>

        <Section id="questions" title="Open questions" intro="What the record still cannot answer.">
          <div className="space-y-2">{r.openQuestions.map((q) => <Card key={q.id} item={q} api={api} title={s(q.question)} />)}</div>
        </Section>

        <Section id="bias" title="Bias & narrative audit" intro="A bias possibility is not evidence of deception. 'Evidence of distortion' marks documented drift between versions of a source, never intent.">
          <div className="grid gap-2 xl:grid-cols-2">
            {r.biasAudit.map((b) => (
              <Card key={b.id} item={b} api={api} title={<>{s(b.category)} <span className={cn("ml-1 rounded px-1.5 py-px text-[10px] font-normal", b.type === "EVIDENCE_OF_DISTORTION" ? "bg-orange-950 text-orange-200" : "bg-zinc-800 text-zinc-300")}>{b.type === "EVIDENCE_OF_DISTORTION" ? "Evidence of distortion" : "Bias possibility"}</span></>}>
                {s(b.observation)}
              </Card>
            ))}
          </div>
        </Section>

        <Section id="provenance" title="Source provenance" intro="Where important claims originated, and how many independent lineages actually support them.">
          <div className="mb-2 space-y-0.5 text-[12px] text-zinc-400">{r.lineages.map((l) => <div key={l.id}><span className="font-mono text-zinc-300">{l.id}</span> {l.label}</div>)}</div>
          <div className="grid gap-2 xl:grid-cols-2">
            {r.provenance.map((p) => (
              <Card key={p.id} item={p} api={api} title={<>{s(p.claim)} <span className="ml-1 rounded bg-zinc-800 px-1.5 py-px font-mono text-[10px] text-zinc-300">{String(p.independentLineages)} independent</span></>}>
                <Field label="Earliest source" value={p.earliestSource} />
                <Field label="Lineage" value={p.lineage} />
                <Field label="Dependent renditions" value={p.dependentRenditions} />
                <p className="text-zinc-400">{s(p.note)}</p>
              </Card>
            ))}
          </div>
        </Section>

        <Section id="critique" title="What PROJECT LEVI overstated, understated or organized poorly">
          <div className="grid gap-3 md:grid-cols-3 text-[12px] text-zinc-300 touchui:text-[14px]">
            <Bullets label="Overstated" items={r.projectCritique.overstated ?? []} cls="text-amber-400" />
            <Bullets label="Understated" items={r.projectCritique.understated ?? []} cls="text-sky-400" />
            <Bullets label="Organized poorly" items={r.projectCritique.organizedPoorly ?? []} cls="text-rose-400" />
          </div>
        </Section>

        <Section id="activity" title="Recent activity">
          <ResearchStatus variant="card" />
          <ul className="space-y-1 text-[12px] text-zinc-300">
            {r.changes.map((c) => <li key={c.date + c.summary}><span className="font-mono text-zinc-500">{c.date}</span> <LayerTag kind="analysis" /> {c.summary}</li>)}
            {[...notes].reverse().slice(0, 8).map((n) => (
              <li key={n.id}><span className="font-mono text-zinc-500">{n.decidedAt?.slice(0, 10)}</span> <LayerTag kind="human" /> {DECISION_META[n.decision]?.label ?? n.decision} on <span className="font-mono">{n.itemId}</span>{n.note ? ` — ${n.note}` : ""}</li>
            ))}
          </ul>
        </Section>

        <Section id="review" title="Needs your judgment" intro="Decisions only you should make, followed by any items you flagged or disagreed with.">
          <div className="space-y-2">
            {r.humanReview.map((h) => <Card key={h.id} item={h} api={api} title={s(h.question)} />)}
            {flagged.map((n) => {
              const it = allItems.get(n.itemId);
              if (!it || r.humanReview.some((h) => h.id === it.id)) return null;
              return <Card key={`f-${n.id}`} item={it} api={api} title={<>Flagged: {s(it.title) || s(it.question) || s(it.item) || s(it.name) || s(it.claim) || it.id}</>} />;
            })}
          </div>
        </Section>
        <div className="h-16" />
      </div>
    </div>
  );
}
