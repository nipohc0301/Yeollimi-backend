# Yeollimi Backend (Cloud Run)

열림이(Yeollimi) 앱의 백엔드 서버입니다.  
자연어 길찾기 명령을 **Vertex AI 튜닝 모델**로 파싱하고,  
**네이버 지도 스킴 링크(nmap://)** 를 생성하여 안드로이드 앱에서 바로 실행할 수 있도록 지원합니다.

- **Runtime:** Node.js + Express  
- **Deployment:** Google Cloud Run  
- **AI Model:** Gemini 2.5 Flash Lite (Vertex AI Tuning)  
- **Core APIs:** Naver Map Scheme, Kakao SDK(optional), Play Store Deep Link  

---

## ✅ 주요 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/v1/parse-map` | 자연어 → 출발지/도착지/이동수단 JSON 추출 |
| `POST` | `/v1/maplink`   | JSON 입력 → 네이버 지도 딥링크 생성 (fallback 포함) |

> ⚠️ Cloud Run 실행 시 `process.env.PORT` 로 서버를 구동해야 합니다.

---

## 1. 기능 개요

### `/v1/parse-map`
- 입력: `"하나고등학교에서 서울역으로 차로 가고 싶어"` 와 같은 자연어 명령
- 처리: Vertex AI 튜닝 모델로 `origin`, `destination`, `transport` 추출

```json
{
  "origin": "하나고등학교",
  "destination": "서울역",
  "transport": "car"
}
