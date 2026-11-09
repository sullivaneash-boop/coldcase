"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { CaseBundle } from "@/lib/types";
import { Workspace } from "./Workspace";

type State = { kind: "loading" } | { kind: "ready"; bundle: CaseBundle } | { kind: "missing" } | { kind: "error"; message: string };

/** Loads the generated, read-only case bundle and hands it to the workspace. */
export function CaseApp() {
  const [state, setState] = useState<State>({ kind: "loading" });
  useEffect(() => {
    fetch("/data/case-bundle.json", { cache: "no-cache" })
      .then(async (r) => {
        if (r.status === 404) return setState({ kind: "missing" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const bundle = (await r.json()) as CaseBundle;
        document.title = `${bundle.meta.config.title} — research board`;
        setState({ kind: "ready", bundle });
      })
      .catch((e: Error) => setState({ kind: "error", message: e.message }));
  }, []);

  if (state.kind === "ready") return <><div className="flex min-h-10 items-center justify-between gap-4 border-b border-zinc-700 bg-[#19271e] px-4 py-2 text-xs text-stone-200"><Link prefetch={false} href="/" className="underline underline-offset-4">← Guided case & independent briefing</Link><span className="hidden sm:inline">Public source edition · source reports and AI analysis are distinct</span><Link href="/#briefing" className="underline underline-offset-4">Investigator’s briefing</Link></div><div className="workspace-frame"><Workspace initial={state.bundle} /></div></>;
  return (
    <main className="flex h-[100dvh] items-center justify-center bg-zinc-950 p-6 text-zinc-300">
      {state.kind === "loading" ? (
        <p className="text-sm text-zinc-500">Loading case index…</p>
      ) : (
        <div className="max-w-md space-y-2 text-sm">
          <h1 className="text-lg font-semibold text-zinc-100">{state.kind === "missing" ? "Case data not generated" : "Case data could not be loaded"}</h1>
          {state.kind === "error" && <p className="text-red-300">{state.message}</p>}
          <p>The board reads data generated from the archive. Generate it with:</p>
          <pre className="rounded bg-zinc-900 p-2 font-mono text-xs">cd tools/research_board &amp;&amp; npm run case:sync</pre>
        </div>
      )}
    </main>
  );
}
