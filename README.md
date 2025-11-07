# Yeollimi Backend (Cloud Run)

열림이(Yeollimi) 앱의 백엔드 서버입니다.  
자연어 길찾기 명령을 **Vertex AI 튜닝 모델**로 파싱하고,  
**네이버 지도 스킴 링크(nmap://)** 를 생성하여 안드로이드 앱에서 바로 실행할 수 있도록 지원합니다.

- **Runtime:** Node.js + Express  
- **Deployment:** Google Cloud Run  
- **AI Model:** Gemini 2.5 Flash Lite (Vertex AI Tuning) 
- **Core APIs:** Naver Map Scheme
