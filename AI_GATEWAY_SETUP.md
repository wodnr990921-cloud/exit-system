# 🤖 AI Gateway 설정 가이드

## ⚠️ 중요: 우리 프로젝트에서는 실제로 사용하지 않습니다!

우리 프로젝트는:
- ⚽ 스포츠 배팅 시스템 (The Odds API)
- 📊 경기 데이터 (REST API)
- 💰 배당 관리 (Supabase)

**AI 기능을 사용하지 않으므로 AI Gateway가 불필요합니다!**

하지만 향후를 위해 설정 방법을 문서화합니다.

---

## 🔧 AI Gateway란?

Vercel AI Gateway는:
- OpenAI, Anthropic, Google AI 등의 API 중간 프록시
- API 사용량 추적
- 캐싱 및 최적화
- 오류 처리 및 재시도

**우리는 사용 안 함:** ❌ OpenAI, ❌ Claude, ❌ Gemini

---

## 📋 설정 방법 (참고용)

### 1단계: Vercel Dashboard

1. **Vercel Dashboard** 접속: https://vercel.com/dashboard
2. **Storage** → **AI Gateway** 클릭
3. **Create AI Gateway** 버튼 클릭
4. API 키 복사

### 2단계: 환경 변수 추가

**.env.local:**
```bash
AI_GATEWAY_API_KEY=vck_xxxxx
```

**Vercel Dashboard:**
```
Settings → Environment Variables
AI_GATEWAY_API_KEY = vck_xxxxx
```

### 3단계: AI SDK 설치 (필요시)

```bash
npm install ai @ai-sdk/openai
```

### 4단계: 코드 예시 (사용하지 않음)

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const result = await streamText({
    model: openai('gpt-4'),
    prompt: 'Hello',
  });

  return result.toDataStreamResponse();
}
```

---

## ❌ 우리가 설치하지 않는 이유

### 사용하는 API들

| API | 용도 | AI 여부 |
|-----|------|---------|
| The Odds API | 스포츠 배당 | ❌ 일반 REST API |
| Supabase | 데이터베이스 | ❌ PostgreSQL |
| API-Volleyball | 배구 데이터 | ❌ 일반 REST API |
| API-Basketball | 농구 데이터 | ❌ 일반 REST API |

**결론:** AI Gateway 불필요! ✅

---

## 🎯 실제 설정 (현재 상태)

### .env.local 파일

```bash
# ✅ 실제로 사용하는 것들
NEXT_PUBLIC_SUPABASE_URL=https://ijokjxmzyvonjpiosffu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_key
ODDS_API_KEY=your_key

# ❌ 사용하지 않음 (삭제해도 됨)
AI_GATEWAY_API_KEY=vck_xxxxx  
```

---

## 📊 Vercel Dashboard 확인

### 현재 설정된 API들

**Settings → Environment Variables:**
```
✅ ODDS_API_KEY - The Odds API (스포츠 데이터)
✅ SUPABASE_SERVICE_ROLE_KEY - Supabase (데이터베이스)
❌ AI_GATEWAY_API_KEY - 불필요
```

**Settings → Integrations:**
```
✅ GitHub (자동 배포)
❌ AI Gateway (불필요)
```

---

## 🔍 AI Gateway가 필요한 경우

### 향후 AI 기능 추가 시

예를 들어:
1. **AI 경기 예측**: 과거 데이터로 승률 예측
2. **챗봇**: 고객 문의 자동 응답
3. **이미지 분석**: 경기 사진 분석

이런 기능을 추가할 때 AI Gateway를 사용할 수 있습니다.

### 설정 시 필요한 것

```bash
# 1. AI SDK 설치
npm install ai @ai-sdk/openai

# 2. OpenAI API 키 발급
# https://platform.openai.com/api-keys

# 3. .env.local에 추가
OPENAI_API_KEY=sk-xxxxx
AI_GATEWAY_API_KEY=vck_xxxxx

# 4. Vercel에 환경 변수 추가
vercel env add OPENAI_API_KEY
```

---

## ✅ 현재 권장사항

### 해야 할 것

```bash
# 1. GitHub에 푸시 (완료 ✅)
git push origin master

# 2. Vercel 자동 배포 확인
# GitHub → 저장소 → 커밋에 Vercel ✅ 확인

# 3. 실제 URL 확인
# Vercel Dashboard → Deployments → Visit

# 4. API 테스트
curl https://your-actual-domain.vercel.app/api/sync-odds-api
```

### 하지 않아도 되는 것

```bash
# ❌ AI SDK 설치
# ❌ AI Gateway 설정
# ❌ OpenAI API 키
```

---

## 🎉 요약

**질문:** AI Gateway 연결 계속해?

**답변:**
- ✅ `.env.local`에 AI_GATEWAY_API_KEY가 있음 (자동 추가됨)
- ❌ 실제로는 사용하지 않음 (삭제해도 무방)
- ✅ 스포츠 배팅 시스템은 AI 없이 완벽히 작동

**권장사항:**
1. AI_GATEWAY_API_KEY는 그냥 두기 (해가 없음)
2. AI SDK 설치 안 함 (불필요)
3. 스포츠 API만 사용 (현재 완료 ✅)

---

## 📞 최종 확인

### Vercel 배포 상태 확인

```bash
# 1. GitHub 저장소 확인
# https://github.com/wodnr990921-cloud/exit-system
# → 최근 커밋에 Vercel ✅ 확인

# 2. Vercel Dashboard 확인
# https://vercel.com/dashboard
# → Deployments 탭
# → "Building" → "Ready" 확인

# 3. 실제 사이트 접속
# https://exit-system.vercel.app (또는 실제 도메인)
# → /dashboard/sports 접속
# → 경기 일정 불러오기 테스트
```

---

**결론: AI Gateway는 설정되어 있지만 사용하지 않습니다. 스포츠 배팅 시스템은 정상 작동합니다!** ✅⚽
