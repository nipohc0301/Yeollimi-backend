Yeollimi Backend (Cloud Run)

열림이(Yeollimi) 앱의 백엔드 서비스입니다.
자연어 길찾기 요청을 Vertex AI 튜닝 모델로 파싱하고, 네이버 지도 스킴 링크(nmap://) 를 생성해 안드로이드 앱에서 바로 열 수 있도록 합니다.

런타임: Node.js + Express

배포: Google Cloud Run

핵심 엔드포인트:

POST /v1/parse-map : 자연어 → {origin, destination, transport} JSON 추출

POST /v1/maplink : {origin, destination, transport} → 네이버 지도 딥링크 URL 생성 (좌표/장소 미흡 시 안전한 fallback)

⚠️ Cloud Run에서는 반드시 process.env.PORT로 서버를 구동해야 합니다.

1. 기능 개요
/v1/parse-map

입력: 자연어 명령(예: “하나고등학교에서 서울역으로 차로 가고 싶어”)

처리: Vertex AI 튜닝 모델을 호출해 출발지/도착지/교통수단을 JSON으로 추출

출력(JSON):

{
  "origin": "하나고등학교",
  "destination": "서울역",
  "transport": "car"   // car | transit | walk
}

/v1/maplink

입력(JSON): origin, destination, transport 중 가능한 정보를 전달

처리:

값이 충분하면 바로 네이버 지도 스킴 링크 생성

값이 불충분하면 튜닝 모델로 보완 시도

여전히 불충분하면 검색 링크로 안전하게 fallback

출력(JSON):

{
  "url": "nmap://route/car?slat=...&slng=...&sname=...&dlat=...&dlng=...&dname=..."
}

2. 환경 변수

키/URL은 저장소에 커밋 금지 (로컬은 .env, 배포는 Cloud Run 환경변수 사용)

변수명	설명
PROJECT_ID	GCP 프로젝트 ID
REGION	Vertex/Endpoint 리전 (예: us-central1)
GEMINI_API_KEY	(옵션) Generative Language API 키 사용 시
MAP_API_KEY	(옵션) 장소/좌표 보완에 외부 API가 필요할 경우
MAP_ENDPOINT_ID	(옵션) 튜닝 모델 엔드포인트 ID (엔드포인트 호출 방식일 때)

.env 예시

PROJECT_ID=yeollimi-dev
REGION=us-central1
GEMINI_API_KEY=***
MAP_API_KEY=***
MAP_ENDPOINT_ID=***

3. 로컬 실행
# 1) 의존성 설치
npm install

# 2) 환경변수(.env) 준비

# 3) 실행
npm run start
# 또는 개발용
npm run dev


기본 포트: PORT 미지정 시 8080

헬스체크: GET / (간단한 ok 응답)

4. Cloud Run 배포
gcloud builds submit --tag gcr.io/$PROJECT_ID/yeollimi-backend

gcloud run deploy yeollimi-backend \
  --image gcr.io/$PROJECT_ID/yeollimi-backend \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars PROJECT_ID=$PROJECT_ID,REGION=$REGION,GEMINI_API_KEY=...,MAP_API_KEY=...,MAP_ENDPOINT_ID=...


배포 후 콘솔에서 환경변수 수정 가능.
에러: Revision not ready → app.listen(process.env.PORT) 확인.

5. API 명세
5.1 POST /v1/parse-map

Request

{ "query": "하나고등학교에서 서울역으로 차로 가고 싶어" }


Response 200

{
  "origin": "하나고등학교",
  "destination": "서울역",
  "transport": "car",
  "confidence": 0.92
}


예시 curl

curl -X POST "$BASE_URL/v1/parse-map" \
  -H "Content-Type: application/json" \
  -d '{"query":"하나고등학교에서 서울역으로 차로 가고 싶어"}'

5.2 POST /v1/maplink

Request

{
  "origin": "하나고등학교",
  "destination": "서울역",
  "transport": "car"
}


Response 200 (성공)

{
  "url": "nmap://route/car?slat=37.123&slng=127.456&sname=%ED%95%98%EB%82%98%EA%B3%A0...&dlat=37.556&dlng=126.972&dname=%EC%84%9C%EC%9A%B8%EC%97%AD"
}


Response 200 (Fallback)

{
  "url": "nmap://search?query=%EC%84%9C%EC%9A%B8%EC%97%AD"
}


예시 curl

curl -X POST "$BASE_URL/v1/maplink" \
  -H "Content-Type: application/json" \
  -d '{"origin":"하나고등학교","destination":"서울역","transport":"car"}'

6. 네이버 지도 스킴 링크 참고

경로 예:

자동차: nmap://route/car?...

대중교통: nmap://route/public?...

도보: nmap://route/walk?...

공통 파라미터(예):
slat, slng, sname, dlat, dlng, dname, appname

정확 좌표가 없을 때는 search 스킴으로 안전하게 연결

좌표가 확보되면 route URL, 없으면 search URL로 항상 열리는 링크 보장.

7. 오류 처리 & 로깅

공통 에러 포맷

{ "error": { "code": "BAD_REQUEST", "message": "..." } }


대표 상황

파라미터 누락 → 400 BAD_REQUEST

튜닝 모델 호출 실패 → 모델 호출 스킵 후 검색 링크 fallback

외부 API 실패 → 재시도(or fallback) 후 200으로 검색 링크 반환

8. 보안 & 운영

민감키는 코드에 하드코딩하지 않음(환경변수)

서버 로그: Cloud Logging

요청 제한(선택): Cloud Armor/앱단 Rate-limit

CORS: 모바일 앱 도메인만 허용 권장

9. 테스트 체크리스트

/v1/parse-map이 다양한 말투에서 key 3종(origin/destination/transport)을 안정적으로 추출하는지

/v1/maplink가 좌표 있을 때 route, 없을 때 search로 정상 동작하는지

Cloud Run 환경에서 PORT 정상 수신 및 헬스체크 응답

Android 앱에서 URL 인텐트로 네이버 지도 연결 확인

10. 라이선스

프로젝트 루트의 LICENSE를 참고합니다. (필요 시 추가)

11. 문의

Team AlphaHana (알파하나)

Role: AI 모델링 · 백엔드 · Android · UI/UX
