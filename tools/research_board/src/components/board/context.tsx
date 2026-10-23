"use client";
import { createContext, useContext } from "react";
import type { Asset } from "@/lib/types";
import type { CaseIndex } from "./graph";

export interface SourceViewRequest {
  sourceId: string;
  anchor?: string | null;
  locator?: string | null;
  fromClaimId?: string;
}

export interface BoardApi {
  idx: CaseIndex;
  selectedId: string | null;
  /** Select a record; `focus` also centers the board on it and its immediate relationships. */
  select: (id: string | null, opts?: { focus?: boolean }) => void;
  openSource: (req: SourceViewRequest) => void;
  addResearcherLink: (fromId: string) => void;
  /** Large image viewer with previous/next across the given set. */
  openImage: (assets: Asset[], index: number) => void;
  /** Show the record plus only its immediate relationships on the board. */
  focusRelationships: (id: string) => void;
  isMobile: boolean;
}

export const BoardContext = createContext<BoardApi | null>(null);

export function useBoard() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoard outside BoardContext");
  return ctx;
}
