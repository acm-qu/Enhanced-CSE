'use client';

import { memo, useMemo } from 'react';

import {
  type Edge,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { SmartStepEdge } from '@tisoap/react-flow-smart-edge';

export type StudyPlanEdgeType = 'prereq' | 'coreq';
export type StudyPlanCourseKind = 'core' | 'elective' | 'package' | 'general';

export interface StudyPlanBoardEdge {
  source: string;
  target: string;
  type: StudyPlanEdgeType;
  sourceSemesterIndex: number;
  targetSemesterIndex: number;
}

export interface StudyPlanBoardCourse {
  code: string;
  title: string;
  creditHours: number;
  kind: StudyPlanCourseKind;
  prereqCount: number;
  coreqCount: number;
}

export interface StudyPlanBoardSemester {
  id: string;
  year: number;
  term: string;
  totalCreditHours: number;
  courses: StudyPlanBoardCourse[];
}

interface StudyPlanBoardProps {
  semesters: StudyPlanBoardSemester[];
  edges: StudyPlanBoardEdge[];
}

type AnchorSide = 'left' | 'right' | 'top' | 'bottom';

interface SlotPosition {
  semesterIndex: number;
  rowIndex: number;
}

interface FlowNodeData extends Record<string, unknown> {
  course: StudyPlanBoardCourse;
}

interface FlowEdgeData extends Record<string, unknown> {
  color: string;
  kind: StudyPlanEdgeType;
}

type StudyPlanFlowNode = Node<FlowNodeData, 'course'>;
type StudyPlanFlowEdge = Edge<FlowEdgeData, 'study-smart'>;

const BOARD_PADDING_X = 20;
const COLUMN_WIDTH = 172;
const COLUMN_GAP = 56;
const HEADER_HEIGHT = 72;
const HEADER_TO_CARDS_GAP = 64;
const CARD_HEIGHT = 72;
const ROW_GAP = 54;
const BOARD_PADDING_BOTTOM = 48;
const HANDLE_SLOTS = ['18%', '39%', '61%', '82%'] as const;

const EDGE_PALETTE = [
  '#67f0dd',
  '#72c9ff',
  '#8ea6ff',
  '#8bf0aa',
  '#ffd56f',
  '#ffb185',
  '#d7abff',
  '#ff97c7',
  '#89ebff',
  '#bff67c',
  '#ffcb93',
  '#8fd8ff'
] as const;

const COURSE_KIND_STYLES: Record<StudyPlanCourseKind, { borderClass: string }> = {
  core: { borderClass: 'border-l-[#2CAD9E]' },
  elective: { borderClass: 'border-l-[#d98787]' },
  package: { borderClass: 'border-l-[#d8b95c]' },
  general: { borderClass: 'border-l-[#6f7e89]' }
};

function hashValue(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function edgeColorForKey(key: string): string {
  return EDGE_PALETTE[hashValue(key) % EDGE_PALETTE.length];
}

function columnLeft(semesterIndex: number): number {
  return BOARD_PADDING_X + semesterIndex * (COLUMN_WIDTH + COLUMN_GAP);
}

function cardsTop(): number {
  return HEADER_HEIGHT + HEADER_TO_CARDS_GAP;
}

function rowTop(rowIndex: number): number {
  return cardsTop() + rowIndex * (CARD_HEIGHT + ROW_GAP);
}

function hiddenHandleStyle(side: AnchorSide, slotIndex: number): Record<string, string | number> {
  const slot = HANDLE_SLOTS[slotIndex % HANDLE_SLOTS.length];

  if (side === 'left' || side === 'right') {
    return {
      top: slot,
      opacity: 0,
      width: 6,
      height: 6,
      border: 'none',
      background: 'transparent',
      pointerEvents: 'none'
    };
  }

  return {
    left: slot,
    opacity: 0,
    width: 6,
    height: 6,
    border: 'none',
    background: 'transparent',
    pointerEvents: 'none'
  };
}

function anchorSideForEdge(source: SlotPosition, target: SlotPosition): { sourceSide: AnchorSide; targetSide: AnchorSide } {
  if (source.semesterIndex === target.semesterIndex) {
    if (source.rowIndex <= target.rowIndex) {
      return {
        sourceSide: 'bottom',
        targetSide: 'top'
      };
    }

    return {
      sourceSide: 'top',
      targetSide: 'bottom'
    };
  }

  if (source.semesterIndex < target.semesterIndex) {
    return {
      sourceSide: 'right',
      targetSide: 'left'
    };
  }

  return {
    sourceSide: 'left',
    targetSide: 'right'
  };
}

function handleId(type: 'source' | 'target', side: AnchorSide, slotIndex: number): string {
  return `${type}-${side}-${slotIndex % HANDLE_SLOTS.length}`;
}

function CourseNode({ data }: NodeProps<StudyPlanFlowNode>) {
  const kind = COURSE_KIND_STYLES[data.course.kind];

  return (
    <div
      className={`h-full w-full overflow-hidden rounded-xl border border-border/70 border-l-[3px] bg-card/96 p-3 shadow-sm backdrop-blur ${kind.borderClass}`}
    >
      {(['left', 'right', 'top', 'bottom'] as const).flatMap((side) =>
        HANDLE_SLOTS.map((_, slotIndex) => (
          <Handle
            key={`source-${side}-${slotIndex}`}
            id={handleId('source', side, slotIndex)}
            type="source"
            position={
              side === 'left'
                ? Position.Left
                : side === 'right'
                  ? Position.Right
                  : side === 'top'
                    ? Position.Top
                    : Position.Bottom
            }
            style={hiddenHandleStyle(side, slotIndex)}
            isConnectable={false}
          />
        ))
      )}

      {(['left', 'right', 'top', 'bottom'] as const).flatMap((side) =>
        HANDLE_SLOTS.map((_, slotIndex) => (
          <Handle
            key={`target-${side}-${slotIndex}`}
            id={handleId('target', side, slotIndex)}
            type="target"
            position={
              side === 'left'
                ? Position.Left
                : side === 'right'
                  ? Position.Right
                  : side === 'top'
                    ? Position.Top
                    : Position.Bottom
            }
            style={hiddenHandleStyle(side, slotIndex)}
            isConnectable={false}
          />
        ))
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.06em] text-foreground/70">{data.course.code}</p>
          <h3 className="mt-1 overflow-hidden text-[11px] font-semibold leading-snug text-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
            {data.course.title}
          </h3>
        </div>
        <span className="shrink-0 rounded-md border border-border/70 bg-background/75 px-1.5 py-0.5 text-[10px] font-semibold text-foreground/80">
          {data.course.creditHours} CH
        </span>
      </div>
    </div>
  );
}

const MemoCourseNode = memo(CourseNode);

const edgeTypes = {
  'study-smart': SmartStepEdge
} as const;

const nodeTypes = {
  course: MemoCourseNode
} as const;

export function StudyPlanBoard({ semesters, edges }: StudyPlanBoardProps) {
  const maxRows = Math.max(...semesters.map((semester) => semester.courses.length), 0);

  const boardWidth =
    BOARD_PADDING_X * 2 + semesters.length * COLUMN_WIDTH + Math.max(0, semesters.length - 1) * COLUMN_GAP;
  const boardHeight =
    cardsTop() + maxRows * CARD_HEIGHT + Math.max(0, maxRows - 1) * ROW_GAP + BOARD_PADDING_BOTTOM;

  const slotByCourse = useMemo(() => {
    const map = new Map<string, SlotPosition>();

    semesters.forEach((semester, semesterIndex) => {
      semester.courses.forEach((course, rowIndex) => {
        map.set(course.code, { semesterIndex, rowIndex });
      });
    });

    return map;
  }, [semesters]);

  const flowNodes = useMemo<StudyPlanFlowNode[]>(() => {
    return semesters.flatMap((semester, semesterIndex) =>
      semester.courses.map((course, rowIndex) => ({
        id: course.code,
        type: 'course',
        position: {
          x: columnLeft(semesterIndex),
          y: rowTop(rowIndex)
        },
        draggable: false,
        selectable: false,
        data: {
          course
        },
        style: {
          width: COLUMN_WIDTH,
          height: CARD_HEIGHT
        }
      }))
    );
  }, [semesters]);

  const flowEdges = useMemo<StudyPlanFlowEdge[]>(() => {
    const sourceHandleCounts = new Map<string, number>();
    const targetHandleCounts = new Map<string, number>();

    return edges.map((edge) => {
      const sourceSlot = slotByCourse.get(edge.source);
      const targetSlot = slotByCourse.get(edge.target);
      if (!sourceSlot || !targetSlot) {
        throw new Error(`Missing slot for edge ${edge.source} -> ${edge.target}`);
      }

      const { sourceSide, targetSide } = anchorSideForEdge(sourceSlot, targetSlot);
      const sourceHandleKey = `${edge.source}:${sourceSide}`;
      const targetHandleKey = `${edge.target}:${targetSide}`;
      const sourceHandleIndex = sourceHandleCounts.get(sourceHandleKey) ?? 0;
      const targetHandleIndex = targetHandleCounts.get(targetHandleKey) ?? 0;

      sourceHandleCounts.set(sourceHandleKey, sourceHandleIndex + 1);
      targetHandleCounts.set(targetHandleKey, targetHandleIndex + 1);

      const color = edgeColorForKey(`${edge.type}:${edge.source}->${edge.target}`);

      return {
        id: `${edge.type}:${edge.source}->${edge.target}`,
        type: 'study-smart',
        source: edge.source,
        target: edge.target,
        sourceHandle: handleId('source', sourceSide, sourceHandleIndex),
        targetHandle: handleId('target', targetSide, targetHandleIndex),
        selectable: false,
        focusable: false,
        data: {
          color,
          kind: edge.type
        },
        style: {
          stroke: color
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color,
          width: 16,
          height: 16
        }
      };
    });
  }, [edges, slotByCourse]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-foreground/70">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5">
          <span className="inline-block h-0.5 w-7 rounded-full bg-foreground/70" />
          Solid = prereq
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5">
          <span className="inline-block h-0.5 w-7 rounded-full border-t-2 border-dashed border-foreground/70" />
          Dashed = coreq / concurrent
        </span>
        <span className="rounded-full border border-border/70 bg-card/70 px-3 py-1.5">React Flow + smart-edge routing</span>
      </div>

      <div className="relative overflow-x-auto rounded-2xl border border-border/70 bg-card/40 p-3">
        <div className="relative mx-auto" style={{ width: `${boardWidth}px`, height: `${boardHeight}px` }}>
          {semesters.map((semester, semesterIndex) => (
            <header
              key={semester.id}
              className="absolute z-20 rounded-lg border border-border/70 bg-card/88 px-3 py-2.5 shadow-sm backdrop-blur"
              style={{
                left: `${columnLeft(semesterIndex)}px`,
                top: 0,
                width: `${COLUMN_WIDTH}px`
              }}
            >
              <p className="text-lg font-semibold tracking-tight text-foreground">Year {semester.year}</p>
              <p className="text-sm font-medium text-foreground/75">
                {semester.term} ({semester.totalCreditHours} CH)
              </p>
            </header>
          ))}

          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView={false}
            panOnDrag={false}
            panOnScroll={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            preventScrolling={false}
            minZoom={1}
            maxZoom={1}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            colorMode="system"
            className="study-plan-flow"
          />
        </div>
      </div>
    </section>
  );
}
