import { NextResponse } from "next/server";
import { extractVideoId } from "@/lib/youtube";
import {
  fetchYoutubeKoreanTimedText,
  fetchYoutubeTranscriptAi,
  looksLikeKoreanText,
} from "@/lib/youtube-transcript-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/transcript?url=... | ?videoId=...  → 한글 우선 자막 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url")?.trim() || "";
    const videoIdParam = searchParams.get("videoId")?.trim() || "";
    const lang = searchParams.get("lang")?.trim() || undefined;

    const videoId =
      videoIdParam || (url ? extractVideoId(url) : null) || null;

    if (!videoId) {
      return NextResponse.json(
        {
          error:
            "유튜브 주소 또는 videoId가 필요합니다. ① 유튜브 주소를 먼저 넣어 주세요.",
        },
        { status: 400 }
      );
    }

    // 1) 한글은 유튜브 직접(할당량 없음)을 먼저 — AI 서비스 기본이 영문인 영상 대응
    if (!lang || lang === "ko" || lang.startsWith("ko")) {
      const ytKo = await fetchYoutubeKoreanTimedText(videoId);
      if (ytKo) {
        return NextResponse.json({
          videoId,
          transcript: ytKo.text,
          length: ytKo.text.length,
          langTried: ytKo.langTried,
          source: "youtube-timedtext",
          sourceUrl: ytKo.sourceUrl,
        });
      }
    }

    // 2) youtube-transcript.ai (한글 없으면 영문 등)
    const result = await fetchYoutubeTranscriptAi(videoId, { lang });
    if (!lang && !looksLikeKoreanText(result.text)) {
      const ytKo = await fetchYoutubeKoreanTimedText(videoId);
      if (ytKo) {
        return NextResponse.json({
          videoId,
          transcript: ytKo.text,
          length: ytKo.text.length,
          langTried: ytKo.langTried,
          source: "youtube-timedtext",
          sourceUrl: ytKo.sourceUrl,
        });
      }
    }

    return NextResponse.json({
      videoId,
      transcript: result.text,
      length: result.text.length,
      langTried: result.langTried,
      source: "youtube-transcript.ai",
      sourceUrl: result.sourceUrl,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "자막을 가져오지 못했습니다.";

    // AI 할당량·오류여도 유튜브 한글 직접 자막은 시도
    try {
      const { searchParams } = new URL(req.url);
      const url = searchParams.get("url")?.trim() || "";
      const videoIdParam = searchParams.get("videoId")?.trim() || "";
      const videoId =
        videoIdParam || (url ? extractVideoId(url) : null) || null;
      if (videoId) {
        const ytKo = await fetchYoutubeKoreanTimedText(videoId);
        if (ytKo) {
          return NextResponse.json({
            videoId,
            transcript: ytKo.text,
            length: ytKo.text.length,
            langTried: ytKo.langTried,
            source: "youtube-timedtext",
            sourceUrl: ytKo.sourceUrl,
            notice: message,
          });
        }
      }
    } catch {
      /* ignore */
    }

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
