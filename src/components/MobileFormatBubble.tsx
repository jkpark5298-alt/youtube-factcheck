"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bold, Minus, Plus, Underline } from "lucide-react";
import type { Editor } from "@tiptap/react";
import { getActiveReportEditor } from "@/lib/report-editor-registry";
import { HIGHLIGHT_COLORS, TEXT_COLORS } from "@/lib/report-editor-utils";

const CIRCLED_NUMBERS = [
  "①",
  "②",
  "③",
  "④",
  "⑤",
  "⑥",
  "⑦",
  "⑧",
  "⑨",
  "⑩",
] as const;

type Pos = {
  /** 가로 정렬용 본문 왼쪽 */
  editorLeft: number;
  editorWidth: number;
};

/** 커서가 본문(ProseMirror) 안에 있는지 — 표시 여부만 결정 */
function caretInEditor(): boolean {
  const ed = getActiveReportEditor();
  if (ed) {
    try {
      const focused =
        ed.isFocused ||
        ed.view.hasFocus() ||
        ed.view.dom.contains(document.activeElement);
      if (focused) return true;
    } catch {
      /* fall through */
    }
  }
  const sel = window.getSelection();
  if (!sel?.rangeCount) return false;
  const range = sel.getRangeAt(0);
  const node =
    range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (range.commonAncestorContainer as Element)
      : range.commonAncestorContainer.parentElement;
  return Boolean(node?.closest?.(".ProseMirror"));
}

function editorBox(): DOMRect | null {
  const ed = getActiveReportEditor();
  if (!ed) return null;
  try {
    return ed.view.dom.getBoundingClientRect();
  } catch {
    return null;
  }
}

function formatBubbleWidth(maxBarWidth: number) {
  if (typeof window === "undefined") return maxBarWidth;
  return Math.min(maxBarWidth, window.innerWidth - 16);
}

/** 사이트 헤더 등 고정 요소 아래부터 쓰기 */
function chromeOffsetTop(): number {
  const header = document.querySelector("header");
  if (!header) return 0;
  const r = header.getBoundingClientRect();
  if (r.bottom <= 0) return 0;
  return Math.max(0, r.bottom);
}

/**
 * 커서가 본문에 있을 때만 표시.
 * 위치는 커서 줄이 아니라 **지금 보이는 페이지(뷰포트) 상단**.
 * 화면 전체에 붙는 고정 헤더가 아니라, 포커스·스크롤에 따라 보이게/숨기게.
 */
function useFormatBubbleAnchor(active: boolean) {
  const [pos, setPos] = useState<Pos | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      setPos(null);
      return;
    }

    let raf = 0;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let selecting = false;

    const place = () => {
      if (!caretInEditor()) return false;
      const box = editorBox();
      if (!box || box.width < 40 || box.height < 20) return false;
      // 본문이 화면 밖으로 완전히 나가면 숨김
      const vv = window.visualViewport;
      const viewTop = vv?.offsetTop ?? 0;
      const viewBottom = viewTop + (vv?.height ?? window.innerHeight);
      if (box.bottom < viewTop + 40 || box.top > viewBottom - 40) return false;
      setPos({
        editorLeft: box.left,
        editorWidth: box.width,
      });
      setVisible(true);
      return true;
    };

    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (selecting) {
          setVisible(false);
          return;
        }
        if (!place()) {
          if (hideTimer) clearTimeout(hideTimer);
          hideTimer = setTimeout(() => {
            if (!place()) setVisible(false);
          }, 280);
          return;
        }
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest("[data-format-bubble]")) return;
      selecting = true;
      setVisible(false);
    };
    const onPointerUp = () => {
      if (!selecting) return;
      selecting = false;
      update();
    };

    update();
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerUp, true);
    document.addEventListener("selectionchange", update);
    document.addEventListener("focusin", update);
    document.addEventListener("touchend", update, { passive: true });
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);

    let bound: Editor | null = null;
    const onSel = () => update();
    const ensureBound = () => {
      const ed = getActiveReportEditor();
      if (ed === bound) return;
      if (bound) {
        bound.off("selectionUpdate", onSel);
        bound.off("focus", onSel);
        bound.off("transaction", onSel);
      }
      bound = ed;
      if (bound) {
        bound.on("selectionUpdate", onSel);
        bound.on("focus", onSel);
        bound.on("transaction", onSel);
      }
    };
    ensureBound();
    const poll = window.setInterval(() => {
      ensureBound();
      update();
    }, 400);

    return () => {
      cancelAnimationFrame(raf);
      if (hideTimer) clearTimeout(hideTimer);
      window.clearInterval(poll);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerUp, true);
      document.removeEventListener("selectionchange", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("touchend", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      if (bound) {
        bound.off("selectionUpdate", onSel);
        bound.off("focus", onSel);
        bound.off("transaction", onSel);
      }
    };
  }, [active]);

  return { pos, visible };
}

const MOBILE_BUBBLE_WIDTH = 360;
const BAR_PAD_ATTR = "data-format-bar-pad";

/**
 * 아이폰 등: 커서가 본문에 있을 때 보이는 페이지 상단 서식 바.
 */
export function MobileFormatBubble({
  active,
  onBold,
  onUnderline,
  onFontSizeStep,
  onInsertChar,
  onColor,
  onHighlight,
}: {
  active: boolean;
  onBold: () => void;
  onUnderline: () => void;
  onFontSizeStep: (delta: number) => void;
  onInsertChar: (ch: string) => void;
  onColor: (c: string) => void;
  onHighlight: (c: string) => void;
}) {
  const { pos, visible } = useFormatBubbleAnchor(active);

  if (!active || !visible || !pos) return null;

  const keep = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <FormatBubbleFrame
      pos={pos}
      className="md:hidden"
      width={formatBubbleWidth(MOBILE_BUBBLE_WIDTH)}
    >
      <div className="pointer-events-none flex items-center gap-1 overflow-x-auto rounded-xl border border-ink-200 bg-white/95 px-1.5 py-1 shadow-lg backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&_button]:pointer-events-auto">
        <BubbleBtn onClick={onBold} title="굵게" onMouseDown={keep}>
          <Bold className="h-4 w-4" />
        </BubbleBtn>
        <BubbleBtn onClick={onUnderline} title="밑줄" onMouseDown={keep}>
          <Underline className="h-4 w-4" />
        </BubbleBtn>
        <BubbleBtn
          onClick={() => onFontSizeStep(-1)}
          title="글자 작게"
          onMouseDown={keep}
        >
          <Minus className="h-4 w-4" />
        </BubbleBtn>
        <BubbleBtn
          onClick={() => onFontSizeStep(1)}
          title="글자 크게"
          onMouseDown={keep}
        >
          <Plus className="h-4 w-4" />
        </BubbleBtn>
        <span className="w-px h-5 bg-ink-200 shrink-0" aria-hidden />
        <div className="flex items-center gap-0.5 shrink-0">
          {CIRCLED_NUMBERS.map((ch) => (
            <button
              key={ch}
              type="button"
              title={`${ch} 삽입`}
              onMouseDown={keep}
              onClick={() => onInsertChar(ch)}
              className="min-h-8 min-w-7 rounded-md px-0.5 text-[13px] font-medium text-ink-800 hover:bg-accent-muted"
            >
              {ch}
            </button>
          ))}
        </div>
        <span className="w-px h-5 bg-ink-200 shrink-0" aria-hidden />
        {TEXT_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            title={c.label}
            onMouseDown={keep}
            onClick={() => onColor(c.color)}
            className="h-7 w-7 shrink-0 rounded-full border border-ink-200"
            style={{ background: c.color }}
          />
        ))}
        <span className="w-px h-5 bg-ink-200 shrink-0" aria-hidden />
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={`hl-${c.id}`}
            type="button"
            title={`${c.label} 형광`}
            onMouseDown={keep}
            onClick={() => onHighlight(c.bg)}
            className="h-7 w-7 shrink-0 rounded-md border border-ink-200"
            style={{ background: c.bg }}
          />
        ))}
      </div>
    </FormatBubbleFrame>
  );
}

const YELLOW_HIGHLIGHT =
  HIGHLIGHT_COLORS.find((c) => c.id === "yellow")?.bg ?? "#fef08a";

/**
 * 데스크톱: 보이는 페이지 상단 서식. 굵게·번호·노란 형광만.
 */
export function DesktopFormatBubble({
  active,
  onBold,
  onInsertChar,
  onHighlight,
}: {
  active: boolean;
  onBold: () => void;
  onInsertChar: (ch: string) => void;
  onHighlight: (c: string) => void;
}) {
  const { pos, visible } = useFormatBubbleAnchor(active);

  if (!active || !visible || !pos) return null;

  const keep = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <FormatBubbleFrame pos={pos} className="hidden md:block">
      <div className="pointer-events-none flex items-center gap-1 overflow-x-auto rounded-xl border border-ink-200 bg-white/95 px-1.5 py-1 shadow-lg backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&_button]:pointer-events-auto">
        <BubbleBtn onClick={onBold} title="굵게" onMouseDown={keep}>
          <Bold className="h-4 w-4" />
        </BubbleBtn>
        <span className="w-px h-5 bg-ink-200 shrink-0" aria-hidden />
        <div className="flex items-center gap-0.5 shrink-0">
          {CIRCLED_NUMBERS.map((ch) => (
            <button
              key={ch}
              type="button"
              title={`${ch} 삽입`}
              onMouseDown={keep}
              onClick={() => onInsertChar(ch)}
              className="min-h-8 min-w-7 rounded-md px-0.5 text-[13px] font-medium text-ink-800 hover:bg-accent-muted"
            >
              {ch}
            </button>
          ))}
        </div>
        <span className="w-px h-5 bg-ink-200 shrink-0" aria-hidden />
        <button
          type="button"
          title="노란 형광"
          onMouseDown={keep}
          onClick={() => onHighlight(YELLOW_HIGHLIGHT)}
          className="h-7 w-7 shrink-0 rounded-md border border-ink-200"
          style={{ background: YELLOW_HIGHLIGHT }}
        />
      </div>
    </FormatBubbleFrame>
  );
}

function FormatBubbleFrame({
  pos,
  className,
  width,
  children,
}: {
  pos: Pos;
  className: string;
  width?: number;
  children: React.ReactNode;
}) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState({
    top: 0,
    left: 8,
    ready: false,
  });

  useLayoutEffect(() => {
    if (!node) return;
    const h = node.offsetHeight;
    const w = node.offsetWidth;
    const gap = 8;
    const vv = window.visualViewport;
    const viewTop = vv?.offsetTop ?? 0;
    const viewLeft = vv?.offsetLeft ?? 0;
    const viewWidth = vv?.width ?? window.innerWidth;
    // 보이는 페이지 상단 (헤더 아래). 커서 줄 Y는 쓰지 않음.
    const top = viewTop + chromeOffsetTop() + gap;
    const barWidth = width ?? w;
    const left = Math.max(
      viewLeft + 8,
      Math.min(pos.editorLeft + 8, viewLeft + viewWidth - barWidth - 8)
    );
    setBox({ top, left, ready: true });

    // 본문 첫 줄이 막대에 가리지 않도록 패딩 (스크롤해도 상단 고정 느낌은 뷰포트 기준)
    const ed = getActiveReportEditor();
    const dom = ed?.view?.dom as HTMLElement | undefined;
    if (dom) {
      dom.setAttribute(BAR_PAD_ATTR, "1");
      dom.style.scrollPaddingTop = `${h + gap * 2}px`;
    }

    return () => {
      if (dom?.getAttribute(BAR_PAD_ATTR) === "1") {
        dom.style.scrollPaddingTop = "";
        dom.removeAttribute(BAR_PAD_ATTR);
      }
    };
  }, [node, pos, width]);

  useEffect(() => {
    return () => {
      const ed = getActiveReportEditor();
      const dom = ed?.view?.dom as HTMLElement | undefined;
      if (dom?.getAttribute(BAR_PAD_ATTR) === "1") {
        dom.style.scrollPaddingTop = "";
        dom.removeAttribute(BAR_PAD_ATTR);
      }
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={setNode}
      data-format-bubble=""
      className={`fixed z-[80] print:hidden !m-0 pointer-events-none [&_*]:pointer-events-none [&_button]:pointer-events-auto ${className}`}
      style={{
        top: box.top,
        left: box.left,
        width,
        visibility: box.ready ? "visible" : "hidden",
      }}
      inert={box.ready ? undefined : true}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </div>,
    document.body
  );
}

function BubbleBtn({
  children,
  onClick,
  title,
  onMouseDown,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  onMouseDown?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={onMouseDown}
      onClick={onClick}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-700 hover:bg-accent-muted"
    >
      {children}
    </button>
  );
}
