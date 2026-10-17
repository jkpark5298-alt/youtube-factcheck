/** 전 화면 공통 절차 번호 (홈 → 요약 → 보고서) */
export const FLOW = {
  url: { n: 1, short: "유튜브 주소" },
  fetchScript: { n: 2, short: "자막 가져오기" },
  copyScript: { n: 3, short: "자막 복사" },
  openSummary: { n: 4, short: "요약 화면으로" },
  pasteSummary: { n: 5, short: "요약 붙여넣기" },
  tidySummary: { n: 6, short: "AI 답변 정리" },
  saveSummary: { n: 7, short: "요약 저장" },
  copySummary: { n: 8, short: "요약 복사 → 보고서 AI" },
  pasteReport: { n: 9, short: "보고서 붙여넣기" },
  confirmReport: { n: 10, short: "보고서 확정" },
} as const;

export function flowLabel(
  key: keyof typeof FLOW,
  extra?: string
): string {
  const s = FLOW[key];
  return extra ? `${s.n}. ${extra}` : `${s.n}. ${s.short}`;
}

/** Gemini API 자동 요약 → 요약 붙여넣기 칸으로 넘길 때 */
export const PENDING_OVERVIEW_KEY = "yfc-pending-overview";

export const FLOW_GUIDE: { n: number; title: string; hint: string }[] = [
  { n: 1, title: "유튜브 주소", hint: "공유한 링크를 주소 칸에 붙입니다." },
  {
    n: 2,
    title: "자막 가져오기",
    hint: "자동 가져오기로 스크립트 칸을 채웁니다.",
  },
  {
    n: 3,
    title: "자막 복사",
    hint: "저장한 자막을 제미나이·다글로에 붙여 요약을 받습니다.",
  },
  {
    n: 4,
    title: "요약 화면",
    hint: "「요약 화면으로」를 눌러 AI 요약을 붙입니다.",
  },
  {
    n: 5,
    title: "요약 붙여넣기",
    hint: "받은 요약을 요약 칸에 붙입니다.",
  },
  { n: 6, title: "답변 정리", hint: "붙인 요약의 줄바꿈과 번호를 확인합니다." },
  { n: 7, title: "요약 저장", hint: "요약을 이 영상에 저장합니다." },
  { n: 8, title: "요약 복사", hint: "저장된 요약을 보고서용 AI에 넘깁니다." },
  { n: 9, title: "보고서 붙여넣기", hint: "받은 보고서 글을 본문에 붙입니다." },
  { n: 10, title: "보고서 확정", hint: "본문을 확인한 뒤 보고서 확정을 누릅니다." },
];

/** 다음에 할 단계만 진한 노란색 */
export const NEXT_STEP_YELLOW =
  "bg-[#f5c400] text-ink-900 font-semibold ring-1 ring-[#a16207]";

export const NEXT_STEP_YELLOW_BTN =
  "border-[#a16207] bg-[#f5c400] text-ink-900 ring-1 ring-[#a16207] hover:bg-[#e6b800]";

/** 홈 화면: 주소 → 자막 → 복사 → 요약 화면 */
export function nextFlowStepForHome(state: {
  hasUrl: boolean;
  hasScript: boolean;
  scriptCopied: boolean;
}): number {
  if (!state.hasUrl) return 1;
  if (!state.hasScript) return 2;
  if (!state.scriptCopied) return 3;
  return 4;
}

/** 저장된 영상 상태로 다음에 할 단계. 끝나면 null. */
export function nextFlowStepForVideo(video: {
  status: string;
  transcript?: string | null;
  transcriptSource?: string | null;
  overview?: string | null;
  report?: unknown;
}): number | null {
  if (video.status === "ready") return null;
  const script = (video.transcript ?? "").trim();
  const hasScript =
    script.length > 80 &&
    video.transcriptSource !== "none" &&
    video.transcriptSource !== "creator_meta";
  const hasOverview = (video.overview ?? "").trim().length >= 40;
  if (!hasScript) return 2;
  if (!hasOverview) return 5;
  if (!video.report) return 9;
  return 10;
}
