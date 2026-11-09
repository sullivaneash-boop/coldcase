export type Citation = { sourceId: string; locator: string };
export type GuideItem = { id: string; title: string; text: string; status: string; refs: Citation[]; time?: string; date?: string; limit?: string; held?: string; question?: string; recordId?: string; analysisBasis?: string };
export type Scenario = { id: string; title: string; fit: string; support: string; against: string; assumptions: string; test: string; refs: Citation[] };
export type Guide = {
  version: number; dataVersion: string; updatedAt: string; author: string; reviewStatus: string; title: string; intro: string; introRefs: Citation[];
  portrait: { sourceId: string; file: string; caption: string };
  meet: GuideItem[]; timeline: GuideItem[]; evidence: GuideItem[]; places: GuideItem[];
  conflicts: { id: string; title: string; question: string; left: GuideItem; right: GuideItem; assessment: string; test: string }[];
  hypotheses: Scenario[];
  briefing: { title: string; assessment: string; refs: Citation[]; findings: GuideItem[]; priorities: { title: string; why: string; request: string; refs: Citation[] }[]; limits: string };
  sources: { id: string; title: string; publisher: string; date: string; url: string; limitation: string }[];
};
