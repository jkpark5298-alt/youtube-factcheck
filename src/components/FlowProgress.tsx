import { FLOW_GUIDE, NEXT_STEP_YELLOW } from "@/lib/flow-steps";

/** 전체 10단계. 다음에 할 단계만 진한 노란색. */
export function FlowProgress({ current }: { current: number | null }) {
  const next = FLOW_GUIDE.find((step) => step.n === current);

  return (
    <section
      className="rounded-xl border border-ink-200 bg-white/95 p-3 space-y-2 print:hidden"
      aria-label="전체 처리 절차"
    >
      <p className="text-sm font-semibold text-ink-900">전체 절차</p>
      <ol className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        {FLOW_GUIDE.map((step) => {
          const isNext = step.n === current;
          const done = current != null && step.n < current;
          return (
            <li
              key={step.n}
              aria-current={isNext ? "step" : undefined}
              className={`rounded-lg px-2 py-1.5 text-xs leading-snug ${
                isNext
                  ? NEXT_STEP_YELLOW
                  : done
                    ? "bg-ink-100 text-ink-500"
                    : "bg-ink-50 text-ink-400"
              }`}
            >
              {step.n}. {step.title}
            </li>
          );
        })}
      </ol>
      <p className="text-xs font-medium text-ink-900" role="status">
        {next
          ? `다음: ${next.n}. ${next.title} — ${next.hint}`
          : "10. 보고서 확정까지 끝났습니다."}
      </p>
    </section>
  );
}
