# TripBite

외국인 관광객을 위한 QR 기반 AI 로컬 투어 메뉴판.
"2026 관광데이터 AI 활용 공모전 - 웹·앱 구현 부문" 제출작.

> TripBite는 외국인 관광객의 식사 순간을 지역 관광 소비로 전환하는 QR 기반 AI 관광 데이터 서비스입니다.

데모 매장: 부산 송정해수욕장 인근 "선라이즈볼"

## 실행 방법

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # 프로덕션 빌드 (dist/)
```

한국관광공사 TourAPI 키가 있다면 `.env.example`을 `.env`로 복사하고
`VITE_TOUR_API_KEY`에 채워 넣으면 실 API 연동으로 동작합니다. 키가 없으면
`src/lib/tourApi.ts`가 자동으로 mock 데이터로 대체합니다.

## 핵심 흐름

QR 스캔 → 메뉴 이해/AI 추천 → 식사 후 주변 관광 코스 추천 → 스탬프/쿠폰으로 방문 유도

## 다국어 자동 번역 (DeepL, 준비됨 · 키 미설정)

매장/메뉴 데이터를 늘릴 때 5개 언어를 전부 손으로 쓰지 않도록, 한국어 원문을 DeepL로 초안 번역하는
Cloud Function(`functions/src/index.ts`의 `translateFields`)을 준비해뒀습니다. API 키가 아직 없어도
코드/타입 체크는 통과하며, 키가 없으면 함수가 `failed-precondition` 에러를 던지고
`src/lib/translate.ts`의 `translateFromKorean()`이 이를 `TranslationNotConfiguredError`로 구분해줍니다
(호출부는 이걸 잡아서 수동 입력으로 폴백하면 됩니다).

담당자가 DeepL API 키를 발급받으면:

```bash
cd functions && npm install
firebase functions:secrets:set DEEPL_API_KEY   # 발급받은 키 입력
firebase deploy --only functions
```

이후 클라이언트에서 `translateFromKorean({ name: '핑크 알로하', description: '...' })`를 호출하면
en/ja/zh/fr/es 초안이 돌아옵니다. 브라우저에는 API 키가 절대 노출되지 않습니다(함수는 로그인한
사장님 계정에서만 호출 가능).

## 코드 구조

```
src/
  lib/
    tourApi.ts              TourAPI adapter (실 연동 + mock fallback)
    recommendationEngine.ts  메뉴 필터링 AI + 코스 추천 알고리즘
    stampModule.ts           스탬프/쿠폰 상태 관리
    analyticsStore.ts        QR 스캔/코스 클릭/스탬프/쿠폰 통계 집계
    qr.ts                    QR payload 파싱 · 데모 생성
  data/                     매장/메뉴/관광지 mock 데이터
  i18n/                     한/영/일/중 번역 딕셔너리
  context/AppContext.tsx    언어·세션·장바구니 전역 상태
  screens/                  QR입장/랜딩/메뉴/AI추천/코스/스탬프/통계 7개 화면
```
