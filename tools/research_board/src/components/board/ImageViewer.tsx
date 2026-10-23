"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, X } from "lucide-react";
import type { Asset } from "@/lib/types";
import { EntityChip, Tag, fileUrl } from "./bits";

/**
 * Large image viewer. Images are always object-contain: document and scan imagery is never
 * cropped. Remote-only images are not fetched; the viewer links to the original URL instead.
 */
export function ImageViewer({ assets, index, onIndex, onClose }: {
  assets: Asset[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const a = assets[index];
  const touchX = useRef<number | null>(null);
  const [showInfo, setShowInfo] = useState(true);
  const prev = () => index > 0 && onIndex(index - 1);
  const next = () => index < assets.length - 1 && onIndex(index + 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (!a) return null;
  const local = a.availability === "LOCAL" && a.localPath;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/95 pt-safe" role="dialog" aria-label="Image viewer">
      <div className="flex h-12 shrink-0 items-center gap-2 px-2">
        <button type="button" onClick={onClose} className="flex size-11 items-center justify-center rounded text-zinc-300 active:bg-zinc-800" aria-label="Close">
          <X className="size-5" />
        </button>
        <span className="text-[13px] text-zinc-400">{index + 1} / {assets.length}</span>
        <button type="button" onClick={() => setShowInfo(!showInfo)} className="ml-auto h-11 rounded px-3 text-[13px] text-zinc-300 active:bg-zinc-800">
          {showInfo ? "Hide details" : "Details"}
        </button>
      </div>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (dx > 60) prev();
          if (dx < -60) next();
          touchX.current = null;
        }}
      >
        {local ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(a.localPath!)} alt={a.altText || a.caption || ""} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="flex max-w-sm flex-col items-center gap-2 p-6 text-center text-[14px] text-zinc-400">
            <ImageOff className="size-8" />
            {a.availability === "REMOTE_ONLY" ? "This image is referenced remotely; its bytes are not archived." : a.availability === "EMBEDDED_IN_SOURCE" ? "Embedded inside an archived capture; open the source to view it." : `Availability: ${a.availability}`}
            {a.originalUrl && (
              <a href={a.originalUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 underline">
                Open original URL <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        )}
        {index > 0 && (
          <button type="button" onClick={prev} aria-label="Previous image" className="absolute left-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-900/80 text-zinc-200">
            <ChevronLeft className="size-5" />
          </button>
        )}
        {index < assets.length - 1 && (
          <button type="button" onClick={next} aria-label="Next image" className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-900/80 text-zinc-200">
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>
      {showInfo && (
        <div data-touch className="max-h-[40vh] shrink-0 overflow-y-auto border-t border-zinc-800 bg-zinc-950 px-4 py-3 pb-safe">
          <p className="wrap-anywhere text-[15px] text-zinc-100">{a.altText || a.caption || <span className="italic text-zinc-500">No caption or alt text in the source.</span>}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Tag>{a.status}</Tag>
            <Tag>{a.availability}</Tag>
            <Tag>{a.id}</Tag>
          </div>
          {a.identityBasis && <p className="mt-2 text-[13px] text-zinc-400">{a.identityBasis}</p>}
          {a.status === "UNASSIGNED" && <p className="mt-2 text-[13px] text-amber-300">Who or what is depicted is not established by source labeling.</p>}
          {a.notes && <p className="mt-1 text-[13px] text-zinc-500">{a.notes}</p>}
          {a.sourceId && <div className="mt-3"><div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">Source</div><EntityChip id={a.sourceId} /></div>}
          {a.relatedEntityIds.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">Labelled as</div>
              <div className="flex flex-col gap-1">{a.relatedEntityIds.map((id) => <EntityChip key={id} id={id} />)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
