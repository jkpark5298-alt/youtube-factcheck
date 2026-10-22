# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

모든 답변·설명은 한국어로 작성한다. UI 문구·에러 메시지·코드 주석도 한국어가 기본이다.

## 개요

유튜브 링크(또는 직접 입력한 스크립트) → **요약** → **팩트체크(자동+수동 수정)** → **유형별 보고서(H 역사 / S 주식 / C 교양 / P 정치·시사)** → 인포그래픽 → 저장·검색·공유를 하는 Next.js 15(App Router, React 19) 앱. Vercel(`hnd1` 리전)에 배포한다.

## 명령어

```bash
npm run dev          # 개발 서버 (http://localhost:3000)
npm run dev:lan      # LAN 접속용 (0.0.0.0:3000, 모바일 실기기 테스트)
npm run build        # 프로덕션 빌드 (next.config.ts에서 빌드 시 ESLint 무시)
npx tsc --noEmit     # 타입 체크 (빌드가 lint를 건너뛰므로 별도로 확인)
npm run test:tiptap  # TipTap 에디터 스모크 테스트 (jsdom)
```

- `npm run lint`는 ESLint가 devDependencies에 없어 현재 동작하지 않는다.
- 테스트 프레임워크는 없다. `scripts/test-*.mts|ts`는 단독 실행 스크립트로, 하나씩 `npx tsx scripts/<파일>` 로 실행한다(실패 시 `process.exit(1)`). 일부는 인자를 받는다. 예: `npx tsx scripts/test-yt-ko-fallback.mts <videoId>`. 네트워크·API 키가 필요한 스크립트도 있다. `test-report-v4.ts`, `test-bulk-paste.mts`, `test-unwrap-soft-breaks.mts`는 예전 동작을 기대해 원래부터 실패한다.
- Windows에서 tsx 임시 스크립트는 절대경로(`c:/…`) import가 안 되므로 `scripts/` 안에 두고 `../src/lib/…` 상대경로로 import한다.
- 미커밋 `src/app/test/`, `src/components/ReportReflowTestView.tsx`는 없는 모듈(`plain-report-doc`)을 참조해 `tsc`/`build`를 깨뜨린다. 빌드 확인 시 잠시 옮겨 두거나 무시한다(`.vercelignore`로 배포에서는 제외됨).

## 배포·운영

- GitHub `master`에 push하면 Vercel 프로젝트 `youtube-factcheck`가 자동으로 프로덕션 배포한다. 운영 주소: https://builder-zeta-eight.vercel.app
- 배포 상태 확인: `npx vercel ls youtube-factcheck`, `npx vercel inspect <배포 URL>`.
- 운영 데이터 읽기(읽기 전용): `GET https://builder-zeta-eight.vercel.app/api/videos/<id>`. 운영에서 PATCH 등 쓰기 요청을 테스트로 보내지 않는다.

## 로컬 브라우저 테스트

- 로컬은 DB 없이 `data/videos.json`을 쓰므로, 테스트 전에 백업하고 끝나면 되돌린다(자동 저장이 파일을 바꾼다). `data/`는 git 무시 대상이다.
- 운영 보고서로 재현할 때는 위 GET으로 받은 레코드를 로컬 `data/videos.json`에 임시로 넣어 쓴다.
- 브라우저 자동화는 의존성에 없다. 작업용 폴더에 `playwright-core`를 설치해 시스템 Chrome(`C:/Program Files/Google/Chrome/Application/chrome.exe`)이나 WebKit(아이폰 사파리 근사)으로 돌린다.

## 환경 변수 (`.env.example` 참고)

모두 선택 사항이며, 없으면 폴백으로 동작한다.

- `OPENAI_API_KEY` (+ `OPENAI_MODEL` 기본 `gpt-4o-mini`, `OPENAI_BASE_URL`): 없으면 요약·팩트체크·보고서가 규칙 기반/수동(질문 복사 → 외부 AI 붙여넣기) 모드로 동작. `src/lib/llm.ts`의 `hasLlm()`로 분기.
- `DATABASE_URL`(또는 `POSTGRES_URL` 등): Neon Postgres. 없으면 `data/*.json` 로컬 파일 저장(Vercel에서는 `/tmp`).
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob 이미지 저장. 실패/미연결 시 Neon → 로컬 `data/media` 순으로 폴백.
- `SUPADATA_API_KEY`, `YOUTUBE_TRANSCRIPT_AI_API_KEY`: 자막 API. **서버 전용 — `NEXT_PUBLIC_` 접두사 금지.**
- `APP_API_TOKEN`/`GEMINI_API_TOKEN`: `/api/gemini`가 외부 Gemini 헬퍼로 프록시할 때 쓰는 토큰.

## 아키텍처

### 데이터 모델과 저장소
- 핵심 레코드는 `VideoRecord`와 `Topic`(`src/lib/types.ts`). 요약 항목·팩트체크 결과·보고서(`TypedReport`)·인포그래픽이 모두 하나의 `VideoRecord` JSON 안에 들어간다. `inputMode`가 `"youtube"` | `"report"`(직접 입력) 를 구분한다.
- `src/lib/store.ts`가 유일한 저장 진입점: Neon이 있으면 `videos`/`topics` 테이블의 JSONB `data` 컬럼, 없으면 로컬 JSON 파일. 스키마는 `src/lib/db.ts`의 `ensureSchema()`가 최초 호출 시 생성한다.
- **낙관적 동시성 제어**: 저장 시 `expectedUpdatedAt`이 현재 `updatedAt`과 다르면 `StorageConflictError`를 던진다. 저장 경로를 수정할 때 이 계약을 유지해야 한다.
- 저장 전 `media-budget.ts`(`compactVideoForStorage`)와 `media-store.ts`(`externalizeVideoMedia`)가 data URL 이미지를 Blob/Neon/로컬로 빼내 URL로 치환한다. 이미지 정리는 `media-gc.ts`, `/api/media/cleanup|release`.

### 처리 파이프라인
- `src/lib/process.ts`가 오케스트레이션: 작업 생성(`createVideoJob`) → 메타·자막 수집 → `pipeline.ts`의 요약(`summarizeContent`)·팩트체크 생성 → `report-write.ts`/`report-skeleton.ts`로 보고서 조립.
- `POST /api/videos`: 붙여넣은 스크립트가 있으면 동기 처리, URL만 있으면 레코드를 먼저 저장하고 `next/server`의 `after()`로 백그라운드 실행 → 클라이언트는 `VideoProcessingPoller`로 상태를 폴링. 파이프라인 오류는 레코드의 `status`에 저장된다.
- 자막 수집(`src/lib/transcript.ts`) 우선순위: 붙여넣은 스크립트 → Supadata → `youtube-transcript` 라이브러리 → timedtext/captionTracks(innertube) → youtube-transcript.ai(`youtube-transcript-ai.ts`, 한국어 자막 우선) → yt-dlp(로컬에 설치된 경우) → 제목·설명·챕터만. 한국어 자막을 영어보다 우선한다.
- LLM 호출은 `llm.ts`의 `chatJson`/`chatText`만 사용(OpenAI 호환 API, 느슨한 JSON 파싱 포함). 프롬프트는 `pipeline.ts`, `report-write.ts` 등에 한국어로 정의돼 있다.
- 팩트체크 판정은 4종(`true`/`mostly_true`/`false`/`unverifiable`)으로 정규화한다(`labels.ts`의 `normalizeSimpleVerdict`).

### 보고서 편집기
- 보고서 본문은 TipTap 3 리치 텍스트(`RichTextEditor`, `EditableReportPanel`, `ReportFormatToolbar`, 모바일용 `MobileFormatBubble`).
- 커스텀 TipTap 확장: `report-tiptap-fc-anchor.ts`(본문 내 팩트체크 앵커, `data-fc-item` 속성 — `fc-markers.ts`), `report-tiptap-s-image.ts`.
- **S 마커 규칙**(`report-body-s-slots.ts`): 문장/문단 끝의 `S`, `S1`, `S2`… 표시는 화면에 보이지 않고 그 자리에 이미지 슬롯이 된다. 본문 파싱·붙여넣기 정규화(`paste.ts`, `paste-organize.ts`, `report-editor-format.ts`)를 고칠 때 이 규칙과 FC 앵커가 깨지지 않는지 `npm run test:tiptap` 및 관련 `scripts/test-*` 로 확인한다.
- **「본문」 탭은 편집기 하나**: 편집 진입 시 `EditableReportPanel`의 `toSingleBodyDraft`(= `mergeReportSectionsToSingleBody` + 중복 정리)로 섹션을 한 본문으로 합친다. 섹션별 편집기로 되돌리면 빈 섹션이 지울 수 없는 빈 공간이 되고 섹션 경계에서 백스페이스가 막힌다. 합치기만으로는 저장하지 않고, 사용자가 고칠 때 자동 저장한다.
- **자동 저장**: 편집 중 draft가 바뀌면 1.6초 뒤 `PATCH { updateReport }`. 같은 시점에 다른 저장(PATCH)을 따로 보내면 서버의 `updatedAt` 검사에서 409(STORAGE_CONFLICT)가 나므로, 본문을 바꾸는 기능은 저장을 자동 저장에 맡긴다.
- **형식 갱신(rebuild)**: `format !== "general_v5"`인 보고서는 `status === "ready"`일 때만, 영상당 한 번만 `PATCH { rebuild: true }`를 보낸다. 서버는 ready가 아니면 갱신하지 않으므로 조건 없이 보내면 새로고침 → 재요청이 무한 반복되고 요청 제한(PATCH 1분 90회)에 걸려 저장이 전부 실패한다.
- **제미나이 보고서 붙여넣기(9단계 「9. 본문 교체」)**: `ai-report-markdown.ts`의 `convertAiReportMarkdown`이 마크다운(`#` 제목·`**`·글머리·번호·표·백틱)을 섹션 분할 없이 본문 HTML 하나로 바꾸고, 원문 글자가 하나라도 빠지면 반영을 거부한다. 팩트체크(entries)·이미지룸은 유지하고 `updateDraft(..., { history: "immediate" })`라 Ctrl+Z로 되돌릴 수 있다. 예전의 섹션 매칭 방식(`importReportText`, `replaceAllReportBodies`, `normalizeAiReportPaste`)은 맞는 칸이 없는 내용을 버리고, 옛 내용과 섞고, 번호 목록을 섹션으로 쪼갰다. 붙여넣기 흐름에 다시 쓰지 않는다.
- **자동 조립 보고서 문장 정리**: 요약으로 조립(`buildTypedReport`)하거나 AI가 쓴(`report-write.ts`) 보고서는 `report.ts`의 `cleanGeneratedText`로 백틱·`**`·`#`을 지우고, 세부 항목은 문단별로 둔다. 요약 원문에 번호가 잘못 붙어 있으면 `parseOverviewNarrative`가 번호 줄마다 섹션을 만든다(알려진 한계).
- 내보내기: PDF(`pdf.ts`, jspdf + html2canvas, `public/fonts`의 나눔고딕), DOCX(`report-docx.ts`), 공유(카카오톡 `NEXT_PUBLIC_KAKAO_JS_KEY`, 이메일, GoodNotes).

### 기타
- 진행 단계 UI(`FlowProgress`, `flow-steps.ts`)는 "다음 단계"를 노란색으로 강조한다.
- 토픽(`Topic`, `/topics/[id]`)은 여러 영상/보고서를 묶는 단위(`topic.ts`, `topic-compose.ts`).
- URL 기사 입력도 지원(`article-fetch.ts`, `url-article-report.ts`, `reader-view.ts`), PDF 텍스트 추출은 `unpdf`(`/api/pdf/extract`).
- `@/*` 경로 별칭 → `src/*`.
