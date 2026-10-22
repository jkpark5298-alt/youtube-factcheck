import { decodeHtmlEntities } from "./report";

/**
 * 제미나이·ChatGPT 마크다운 보고서 → 보고서 본문 HTML.
 * 섹션으로 나누지 않고 원문 순서 그대로 한 본문으로 만든다.
 * (섹션 매칭 방식은 맞는 칸이 없는 내용을 버리거나 옛 내용과 섞었다)
 */
export type AiReportConversion = {
  bodyHtml: string;
  /** 본문 첫 글 (summaryExcerpt 용) */
  plain: string;
  /** 원문 글자가 결과에서 빠졌으면 그 근처 원문 조각. 정상이면 "" */
  missing: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 줄 안의 마크다운: **굵게**, *기울임*, `코드`, [글](링크) */
function inlineMarkdown(raw: string): string {
  let t = escapeHtml(raw);
  t = t.replace(/`+([^`]+?)`+/g, "$1").replace(/`/g, "");
  t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, "$1 ($2)");
  t = t.replace(/\*\*\*([^*]+?)\*\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/__([^_\n]+?)__/g, "<strong>$1</strong>");
  t = t.replace(
    /(^|[^\p{L}\p{N}*])\*(?![\s*])([^*\n]+?)(?<![\s*])\*(?![\p{L}\p{N}*])/gu,
    "$1<em>$2</em>"
  );
  // 짝이 안 맞아 남은 ** 는 기호만 지움
  t = t.replace(/\*\*/g, "");
  return t.trim();
}

const INDENT = "   ";

function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;| /g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

/** 글자·숫자만 남긴 서명 — 기호·공백 차이는 무시하고 내용 누락만 잡는다 */
function contentSignature(s: string): string {
  return s.normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "");
}

function findMissing(source: string, resultPlain: string): string {
  const a = contentSignature(source);
  const b = contentSignature(resultPlain);
  if (a === b) return "";
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.slice(Math.max(0, i - 10), i + 30) || "(끝부분)";
}

export function convertAiReportMarkdown(raw: string): AiReportConversion {
  const source = decodeHtmlEntities(raw || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[​﻿]/g, "")
    .replace(/ /g, " ")
    // ```markdown 같은 코드 울타리 줄
    .replace(/^[ \t]*```[^\n]*$/gm, "");

  const out: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(`<p>${para.join("<br>")}</p>`);
    para = [];
  };

  for (const rawLine of source.split("\n")) {
    const line = rawLine.replace(/\t/g, "    ").replace(/\s+$/, "");
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    // --- *** ___ 구분선
    if (/^([-*_])(?:[ \t]*\1){2,}$/.test(trimmed)) {
      flush();
      continue;
    }
    const indented = line.length - line.trimStart().length >= 2;

    const heading = trimmed.match(/^#{1,6}[ \t]+(.+?)[ \t]*#*$/);
    if (heading) {
      flush();
      const text = inlineMarkdown(heading[1]).replace(/<\/?strong>/g, "");
      if (text) out.push(`<p><strong>${text}</strong></p>`);
      continue;
    }

    const bullet = trimmed.match(/^[*\-+•●▪◦·][ \t]+(.+)$/);
    if (bullet) {
      flush();
      out.push(
        `<p>${indented ? `${INDENT}◦ ` : "• "}${inlineMarkdown(bullet[1])}</p>`
      );
      continue;
    }

    // 1. / 1) / ① 번호 — 섹션으로 쪼개지 않고 번호 그대로 한 줄
    const numbered =
      trimmed.match(/^(\d+[.)])[ \t]+(.+)$/) ||
      trimmed.match(/^([①-⑳])[ \t]*(.+)$/);
    if (numbered) {
      flush();
      out.push(
        `<p>${indented ? INDENT : ""}${numbered[1]} ${inlineMarkdown(numbered[2])}</p>`
      );
      continue;
    }

    // 표: | a | b | → a · b (구분 줄 |---| 은 건너뜀)
    if (/^\|.*\|$/.test(trimmed)) {
      if (/^\|[\s:|-]+\|$/.test(trimmed)) continue;
      flush();
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => inlineMarkdown(c.trim()))
        .filter(Boolean);
      if (cells.length) out.push(`<p>${cells.join(" · ")}</p>`);
      continue;
    }

    para.push(inlineMarkdown(trimmed.replace(/^>[ \t]?/, "")));
  }
  flush();

  const bodyHtml = out.join("");
  const plain = htmlToPlain(bodyHtml).replace(/\s+/g, " ").trim();
  return {
    bodyHtml,
    plain,
    missing: bodyHtml ? findMissing(source, htmlToPlain(bodyHtml)) : "",
  };
}
