/**
 * 서식 막대는 커서 Y가 아니라 보이는 뷰포트 상단에 둔다.
 */
function barTop(viewTop: number, chromeBottom: number, gap = 8) {
  return viewTop + Math.max(0, chromeBottom) + gap;
}

const cases = [
  { viewTop: 0, chrome: 64, caretY: 480, expect: 72 },
  { viewTop: 0, chrome: 0, caretY: 900, expect: 8 },
  { viewTop: 120, chrome: 0, caretY: 400, expect: 128 },
];

for (const c of cases) {
  const top = barTop(c.viewTop, c.chrome);
  if (top !== c.expect) {
    console.error("FAIL", c, top);
    process.exit(1);
  }
  // 커서 줄과 무관해야 함
  if (top === c.caretY || Math.abs(top - c.caretY) < 40) {
    console.error("FAIL: too close to caret", c, top);
    process.exit(1);
  }
}
console.log("OK format-bar viewport-top placement", cases.length, "cases");
