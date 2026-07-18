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
