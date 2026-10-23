import { loadBundle } from "@/lib/bundle";
import { Workspace } from "@/components/board/Workspace";

export const dynamic = "force-dynamic";

export default function Page() {
  const bundle = loadBundle();
  if (!bundle) {
    return (
      <main className="flex h-screen items-center justify-center bg-zinc-950 p-8 text-zinc-300">
        <div className="max-w-lg space-y-2 text-sm">
          <h1 className="text-lg font-semibold text-zinc-100">Case index not built</h1>
          <p>The board reads a local SQLite index rebuilt from the archive registers. Build it with:</p>
          <pre className="rounded bg-zinc-900 p-2 font-mono text-xs">cd tools/research_board &amp;&amp; npm run case</pre>
          <p className="text-zinc-500">The archive stays canonical; the index can be deleted and rebuilt at any time.</p>
        </div>
      </main>
    );
  }
  return <Workspace initial={bundle} />;
}
