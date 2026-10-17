import {
  fetchYoutubeKoreanTimedText,
  looksLikeKoreanText,
} from "../src/lib/youtube-transcript-ai";

const id = process.argv[2] || "luimFKB9ZD8";
const r = await fetchYoutubeKoreanTimedText(id);
if (!r) {
  console.error("FAIL: null");
  process.exit(1);
}
if (!looksLikeKoreanText(r.text)) {
  console.error("FAIL: not Korean", r.text.slice(0, 80));
  process.exit(1);
}
console.log("OK", {
  langTried: r.langTried,
  len: r.text.length,
  sample: r.text.slice(0, 80),
});
