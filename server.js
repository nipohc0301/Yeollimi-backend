import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { VertexAI } from '@google-cloud/vertexai';

const {
  PROJECT_ID = 'yeollimi-dev',
  LOCATION = 'us-central1',
  TUNED_ENDPOINT_ID = '6569928322124349440',
  APPNAME = 'com.yeollimi.app',
  PORT = process.env.PORT || 8080
} = process.env;

// 엔드포인트 리소스 경로(튜닝 엔드포인트를 model로 사용)
const MODEL_ENDPOINT_PATH = `projects/${PROJECT_ID}/locations/${LOCATION}/endpoints/${TUNED_ENDPOINT_ID}`;

const vertex = new VertexAI({ project: PROJECT_ID, location: LOCATION });
const tunedModel = vertex.getGenerativeModel({
  model: MODEL_ENDPOINT_PATH
});

// 구조화 출력 스키마(필요 필드 강제)
const responseSchema = {
  type: 'object',
  properties: {
    mode: { type: 'string', enum: ['public', 'car', 'walk', 'bicycle'] },
    origin: {
      type: 'object',
      nullable: true, // ← 이 한 줄로 null 허용
      properties: {
        name: { type: 'string' },
        lat: { type: 'number' },
        lng: { type: 'number' }
      },
      additionalProperties: false
    },
    destination: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        lat: { type: 'number' },
        lng: { type: 'number' }
      },
      required: ['lat', 'lng'],
      additionalProperties: false
    },
    waypoints: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          lat: { type: 'number' },
          lng: { type: 'number' }
        },
        required: ['lat', 'lng'],
        additionalProperties: false
      }
    }
  },
  required: ['mode', 'destination'],
  additionalProperties: false
};


function buildNaverLink(parts) {
  const { mode, origin, destination, waypoints = [] } = parts;

  const action = {
    public: 'route/public',
    car: 'route/car',
    walk: 'route/walk',
    bicycle: 'route/bicycle'
  }[mode] || 'route/public';

  const u = new URL(`nmap://${action}`);

  // 출발지(선택)
  if (origin?.lat && origin?.lng) {
    u.searchParams.set('slat', origin.lat.toString());
    u.searchParams.set('slng', origin.lng.toString());
  }
  if (origin?.name) u.searchParams.set('sname', origin.name);

  // 경유지 1개 예시(필요 없으면 스킵)
  if (waypoints[0]?.lat && waypoints[0]?.lng) {
    u.searchParams.set('v1lat', waypoints[0].lat.toString());
    u.searchParams.set('v1lng', waypoints[0].lng.toString());
    if (waypoints[0]?.name) u.searchParams.set('v1name', waypoints[0].name);
  }

  // 도착지(필수)
  u.searchParams.set('dlat', destination.lat.toString());
  u.searchParams.set('dlng', destination.lng.toString());
  if (destination?.name) u.searchParams.set('dname', destination.name);

  // 네이버 스킴 필수
  u.searchParams.set('appname', APPNAME);

  return u.toString();
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_, res) => res.send('ok'));

app.post('/v1/maplink', async (req, res) => {
  try {
    const { query, current } = req.body || {};

    const sys = `You are a routing extractor. Return ONLY JSON that matches the schema:
{
 "mode": "public|car|walk|bicycle",
 "origin": {"name": string, "lat": number, "lng": number} | null,
 "destination": {"name": string, "lat": number, "lng": number},
 "waypoints": [{"name": string, "lat": number, "lng": number}]
}
Rules:
- If origin is not clearly provided by user, set origin to null (device location will be used).
- destination.lat and destination.lng are required.
- mode must be one of the enum values.
- No additional keys.`;

    const contents = [
      { role: 'user', parts: [{ text: `${sys}\n\nUser: ${query || ''}\n\nCurrent: ${JSON.stringify(current || null)}` }] }
    ];

    const resp = await tunedModel.generateContent({
      contents,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema
      }
    });

    // SDK 버전별로 응답 접근 방식이 다를 수 있어 안전하게 파싱
    let text;
    if (resp?.response?.text) {
      text = await resp.response.text();
    } else if (resp?.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      text = resp.response.candidates[0].content.parts[0].text;
    } else {
      return res.status(502).json({ error: 'NO_TEXT_RESPONSE', raw: resp });
    }

    let parts;
    try {
      parts = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({ error: 'MODEL_JSON_PARSE_ERROR', raw: text });
    }

    if (!parts?.destination?.lat || !parts?.destination?.lng) {
      // 좌표 없음 → 네이버 스킴 생성 불가. (차후 지오코딩 추가 추천)
      return res.status(400).json({ error: 'NEEDS_GEOCODING', parts });
    }

    const url = buildNaverLink(parts);
    res.json({ url, parts, source: 'tuned' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`server started on ${PORT}`);
});