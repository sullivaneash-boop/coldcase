import { CaseApp } from "@/components/board/CaseApp";

// Static shell. Case data is generated from the archive by `npm run case:sync` / `npm run build`
// into public/data and fetched by the client, so the page itself contains no case facts.
export default function Page() {
  return <CaseApp />;
}
