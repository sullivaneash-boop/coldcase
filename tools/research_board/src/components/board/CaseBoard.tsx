"use client";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position, useReactFlow, useNodesInitialized, ReactFlowProvider,
  type Node, type Edge, type NodeProps, type NodeChange, applyNodeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";
import type { CaseEdge, Entity, EntityType } from "@/lib/types";
import { CATEGORY_META, REL_LABEL, TYPE_META, TYPE_ORDER } from "./constants";
import { StatusBadge } from "./bits";

const NODE_W = 210;
const NODE_H = 58;
const COL_GAP = 26;
const ROW_GAP = 12;
const MAX_ROWS = 20;

type EntityNodeData = { entity: Entity; dim: boolean; focus: boolean };
type GroupNodeData = { label: string; count: number; type: EntityType };

const EntityNode = memo(function EntityNode({ data, selected }: NodeProps<Node<EntityNodeData>>) {
  const e = data.entity;
  const meta = TYPE_META[e.type];
  const Icon = meta.icon;
  const isClaim = e.type === "CLAIM";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border bg-zinc-900/95 text-left shadow-sm transition-opacity",
        selected ? "border-zinc-200 ring-2 ring-zinc-200/60" : "border-zinc-700",
        data.focus && !selected && "ring-2 ring-amber-400/70",
        data.dim && "opacity-25",
      )}
      style={{ width: NODE_W, height: NODE_H }}
    >
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: meta.color }} />
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-zinc-500" />
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-zinc-500" />
      <div className="flex h-full flex-col justify-between py-1 pl-2.5 pr-1.5">
        <div className="flex items-center gap-1">
          <Icon className="size-3 shrink-0" style={{ color: meta.color }} />
          <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">
            {e.subtype === "NEWSPAPER_PAGE" ? "Page scan" : meta.label}
          </span>
          {isClaim && <StatusBadge status={e.status} className="ml-auto !py-0 !text-[9px]" />}
          {e.type === "SOURCE" && (
            <span className="ml-auto font-mono text-[9px] text-zinc-500">{e.status ? `class ${e.status}` : "class —"}</span>
          )}
          {e.type === "CONTRADICTION" && <span className="ml-auto font-mono text-[9px] text-red-300">{e.status}</span>}
        </div>
        <div
          className={cn("line-clamp-2 text-[11px] leading-[13px] text-zinc-100", isClaim && e.status === "ALLEGED" && "italic")}
          title={e.label}
        >
          {e.label}
        </div>
      </div>
    </div>
  );
});

const GroupNode = memo(function GroupNode({ data }: NodeProps<Node<GroupNodeData>>) {
  const meta = TYPE_META[data.type];
  return (
    <div className="pointer-events-none select-none text-[11px] font-semibold uppercase tracking-widest" style={{ color: meta.color }}>
      {data.label} <span className="font-mono text-zinc-500">{data.count}</span>
    </div>
  );
});

const nodeTypes = { entity: EntityNode, group: GroupNode };

/** Typed columns (wrapping) so each record type stays in a predictable region. */
function gridLayout(entities: Entity[]) {
  const pos = new Map<string, { x: number; y: number }>();
  const groups: Node<GroupNodeData>[] = [];
  let x = 0;
  for (const type of TYPE_ORDER) {
    const list = entities
      .filter((e) => e.type === type)
      .sort((a, b) => (a.sortKey ?? "").localeCompare(b.sortKey ?? "") || a.label.localeCompare(b.label));
    if (!list.length) continue;
    groups.push({ id: `group-${type}`, type: "group", position: { x, y: -36 }, data: { label: TYPE_META[type].plural, count: list.length, type }, selectable: false, draggable: false });
    const cols = Math.ceil(list.length / MAX_ROWS);
    const rows = Math.ceil(list.length / cols);
    list.forEach((e, i) => {
      const c = Math.floor(i / rows);
      const r = i % rows;
      pos.set(e.id, { x: x + c * (NODE_W + COL_GAP), y: r * (NODE_H + ROW_GAP) });
    });
    x += cols * (NODE_W + COL_GAP) + 70;
  }
  return { pos, groups };
}

/** Focus layout: the focused record in the middle, its neighbors on rings grouped by type. */
function focusLayout(focus: Entity, others: Entity[], aspect: number) {
  const pos = new Map<string, { x: number; y: number }>();
  pos.set(focus.id, { x: 0, y: 0 });
  const sorted = [...others].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.label.localeCompare(b.label));
  let placed = 0;
  let ring = 0;
  while (placed < sorted.length) {
    const radius = 300 + ring * 170;
    const capacity = Math.max(6, Math.floor(((2 * Math.PI * radius) / (NODE_W * 0.95)) * Math.min(1, aspect)));
    const slice = sorted.slice(placed, placed + capacity);
    slice.forEach((e, i) => {
      const a = (i / slice.length) * 2 * Math.PI - Math.PI / 2 + ring * 0.2;
      pos.set(e.id, { x: Math.cos(a) * radius * aspect, y: Math.sin(a) * radius });
    });
    placed += slice.length;
    ring++;
  }
  return pos;
}

/** Phone focus layout: the focused record in the middle, neighbors in two columns above and below. */
function focusLayoutCompact(focus: Entity, others: Entity[]) {
  const pos = new Map<string, { x: number; y: number }>();
  const sorted = [...others].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.label.localeCompare(b.label));
  const above = sorted.slice(0, Math.ceil(sorted.length / 2));
  const below = sorted.slice(above.length);
  const colX = [-NODE_W - 8, 8];
  const rowH = NODE_H + 22;
  const aboveRows = Math.ceil(above.length / 2);
  above.forEach((e, i) => pos.set(e.id, { x: colX[i % 2], y: -(aboveRows - Math.floor(i / 2)) * rowH - 20 }));
  pos.set(focus.id, { x: -NODE_W / 2, y: 0 });
  below.forEach((e, i) => pos.set(e.id, { x: colX[i % 2], y: (Math.floor(i / 2) + 1) * rowH + 20 }));
  return pos;
}

export interface CaseBoardProps {
  entities: Entity[];
  edges: CaseEdge[];
  selectedId: string | null;
  focusId: string | null;
  highlight: Set<string> | null;
  fitSignal: number;
  onSelect: (id: string | null) => void;
  /** Phone layout: no minimap or zoom buttons (pinch zoom instead); portrait-friendly focus rings. */
  compact?: boolean;
}

function Board({ entities, edges, selectedId, focusId, highlight, fitSignal, onSelect, compact }: CaseBoardProps) {
  const rf = useReactFlow();
  const focusEntity = focusId ? entities.find((e) => e.id === focusId) ?? null : null;
  const layoutKey = focusEntity ? `focus:${focusId}` : "grid";
  // Positions the researcher dragged, per layout (session only).
  const dragged = useRef(new Map<string, Map<string, { x: number; y: number }>>());

  const base = useMemo(() => {
    if (focusEntity) {
      const others = entities.filter((e) => e.id !== focusEntity.id);
      return { pos: compact ? focusLayoutCompact(focusEntity, others) : focusLayout(focusEntity, others, 1.35), groups: [] as Node[] };
    }
    return gridLayout(entities);
  }, [entities, focusEntity, compact]);

  const build = (): Node[] => {
    const overrides = dragged.current.get(layoutKey);
    return [
      ...base.groups,
      ...entities.map((e) => ({
        id: e.id,
        type: "entity",
        position: overrides?.get(e.id) ?? base.pos.get(e.id) ?? { x: 0, y: 0 },
        selected: e.id === selectedId,
        data: { entity: e, dim: !!highlight && !highlight.has(e.id), focus: e.id === focusId },
      })),
    ];
  };
  const [nodes, setNodes] = useState<Node[]>(build);
  useEffect(() => setNodes(build()), [base, selectedId, highlight]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fit only once React Flow has measured the nodes (they measure 0×0 while the board is hidden).
  const nodesReady = useNodesInitialized();
  useEffect(() => {
    if (!nodesReady) return;
    const t = setTimeout(() => rf.fitView({ padding: compact ? 0.04 : 0.12, duration: 300, maxZoom: compact ? 1.4 : 1.1 }), 50);
    return () => clearTimeout(t);
  }, [nodesReady, layoutKey, fitSignal, rf, compact, base]);

  // In the compact (phone) focus layout edge labels would sit on top of nodes; the detail view lists them.
  const showLabels = !compact && (!!focusEntity || entities.length < 40);
  const rfEdges: Edge[] = useMemo(() => edges.map((e) => {
    const cat = CATEGORY_META[e.category];
    const active = !highlight || (highlight.has(e.from) && highlight.has(e.to));
    const isResearcher = e.category === "RESEARCHER";
    const color = e.rel === "CONTRADICTED_BY" ? "#f87171" : e.rel === "SUPPORTED_BY" ? "#4d7c63" : cat.stroke;
    const label = isResearcher ? "Researcher connection — not evidence" : e.category === "VIA_CLAIM" ? `via ${e.notes}` : REL_LABEL[e.rel] ?? e.rel.toLowerCase().replace(/_/g, " ");
    return {
      id: e.id,
      source: e.from,
      target: e.to,
      label: showLabels || isResearcher || (selectedId && (e.from === selectedId || e.to === selectedId)) ? label : undefined,
      labelStyle: { fill: isResearcher ? "#fbbf24" : "#a1a1aa", fontSize: 9 },
      labelBgStyle: { fill: "#09090b", fillOpacity: 0.85 },
      labelBgPadding: [3, 1] as [number, number],
      style: { stroke: color, strokeWidth: cat.width, strokeDasharray: cat.dash, opacity: active ? 0.9 : 0.08 },
      animated: false,
      zIndex: isResearcher ? 5 : 0,
    } satisfies Edge;
  }), [edges, highlight, showLabels, selectedId]);

  const onNodesChange = (changes: NodeChange[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns));
    for (const c of changes) {
      if (c.type === "position" && c.position && !c.dragging) {
        if (!dragged.current.has(layoutKey)) dragged.current.set(layoutKey, new Map());
        dragged.current.get(layoutKey)!.set(c.id, c.position);
      }
    }
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={(_, n) => n.type === "entity" && onSelect(n.id)}
      onPaneClick={() => onSelect(null)}
      minZoom={0.05}
      zoomOnDoubleClick={!compact}
      panOnScroll={false}
      maxZoom={2.5}
      proOptions={{ hideAttribution: true }}
      colorMode="dark"
      nodesConnectable={false}
      elevateEdgesOnSelect
      onlyRenderVisibleElements
    >
      <Background color="#27272a" gap={24} />
      {!compact && <Controls showInteractive={false} position="bottom-left" />}
      {!compact && <MiniMap
        pannable
        zoomable
        position="bottom-right"
        className="!bg-zinc-900"
        maskColor="rgba(9,9,11,0.7)"
        nodeColor={(n) => (n.type === "entity" ? TYPE_META[(n.data as EntityNodeData).entity.type].color : "transparent")}
      />}
    </ReactFlow>
  );
}

export function CaseBoard(props: CaseBoardProps) {
  // Re-fit when the board becomes visible (e.g. switching tabs): a hidden board measures 0×0.
  const ref = useRef<HTMLDivElement>(null);
  const [visibleSignal, setVisibleSignal] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    let wasHidden = true;
    const ro = new ResizeObserver(([entry]) => {
      const hidden = entry.contentRect.width === 0 || entry.contentRect.height === 0;
      if (wasHidden && !hidden) setVisibleSignal((n) => n + 1);
      wasHidden = hidden;
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="h-full w-full">
      <ReactFlowProvider>
        <Board {...props} fitSignal={props.fitSignal + visibleSignal * 1000} />
      </ReactFlowProvider>
    </div>
  );
}
