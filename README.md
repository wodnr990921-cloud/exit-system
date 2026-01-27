# 편지 관리 시스템 (Exit Company)

교정시설 수용자 편지 관리 및 업무 처리 통합 시스템

## 주요 기능

- 📬 **OCR 편지 처리**: GPT-4o 기반 자동 텍스트 추출 및 분류
- 🛡️ **금지어 감지**: 계좌번호, 개인정보, 욕설 자동 탐지
- 👥 **회원 관리**: 포인트 시스템, 입출금 관리
- 📋 **티켓 시스템**: 도서 발주, 물품 구매, 베팅 등 통합 처리
- 🔐 **역할 기반 권한**: CEO/Admin/Operator/Staff/Employee 5단계
- 📊 **대시보드**: 역할별 맞춤 대시보드
- 📝 **일일 마감**: AI 자동 답장 생성 및 일괄 처리
- 🔍 **감사 로그**: 모든 중요 작업 기록

## 기술 스택

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **AI/ML**: OpenAI GPT-4o (OCR), GPT-4o-mini (요약)
- **Auth**: Supabase Auth + Custom SHA256
- **UI**: Radix UI Components

## 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 편집하여 다음 값을 입력:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - OPENAI_API_KEY

# 3. 개발 서버 실행
npm run dev

# 4. 브라우저에서 열기
# http://localhost:3000
```

## 초기 로그인

```
Username: admin
Password: master2026exit (마스터 비밀번호)
또는
Password: exitadmin2026 (어드민 권한 부여)
```

## 프로젝트 구조

```
src/
├── app/
│   ├── api/              # API 라우트 (69개)
│   │   ├── auth/         # 인증
│   │   ├── ocr/          # OCR 처리
│   │   ├── tickets/      # 티켓 생성
│   │   ├── closing/      # 일일 마감
│   │   └── ...
│   ├── dashboard/        # 대시보드 페이지
│   │   ├── qa/           # 통합 작업 처리
│   │   ├── intake/       # 편지 접수
│   │   ├── closing/      # 마감 관리
│   │   └── ...
│   └── mobile/           # 모바일 인터페이스
├── components/
│   └── ui/               # Radix UI 컴포넌트
├── lib/
│   ├── supabase/         # Supabase 클라이언트
│   ├── permissions.ts    # 권한 관리
│   ├── content-filter.ts # 금지어 필터
│   └── ...
└── types/
    └── index.ts          # TypeScript 타입 정의
```

## 주요 워크플로우

```
편지 수령 (오프라인)
  ↓
사진 촬영 및 업로드
  ↓
OCR 자동 처리 (GPT-4o)
  ↓
금지어 검사 + 회원 매칭
  ↓
담당자 배정 및 처리
  ↓
이사급 승인
  ↓
일일 마감 (AI 답장 생성)
  ↓
PDF 출력 및 우편 발송
```

## 권한 체계

| 역할 | 레벨 | 권한 |
|------|------|------|
| CEO | 100 | 모든 권한 + 삭제/수정 |
| Admin | 80 | 관리자 권한 |
| Operator | 60 | 승인/마감 권한 |
| Staff | 40 | 업무 처리 |
| Employee | 20 | 제한적 접근 |

## 개발 가이드

자세한 개발 가이드는 [CLAUDE.md](./CLAUDE.md)를 참조하세요.

### 주요 명령어

```bash
npm run dev      # 개발 서버 실행
npm run build    # 프로덕션 빌드
npm start        # 프로덕션 서버 실행
npm run lint     # ESLint 실행
```

### API 테스트

```bash
# 로그인
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"master2026exit"}'

# OCR 처리
curl -X POST http://localhost:3000/api/ocr \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://example.com/image.jpg"}'
```

## 환경 변수

| 변수 | 설명 | 필수 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | ✅ |
| `OPENAI_API_KEY` | OpenAI API 키 | ✅ |
| `ODDS_API_KEY` | 스포츠 배당률 API 키 | ❌ |

## 배포

### Vercel (권장)

```bash
vercel
# 환경 변수는 Vercel 대시보드에서 설정
```

### Docker

```bash
docker build -t exit-system .
docker run -p 3000:3000 exit-system
```

## 보안

⚠️ **중요**: 보안 감사 및 개선사항은 [SECURITY.md](./SECURITY.md)를 참조하세요.

**보안 기능:**
- 모든 API 라우트는 인증 필수
- 역할 기반 접근 제어 (5단계 권한)
- 감사 로그 자동 기록
- 금지 콘텐츠 자동 필터링 (계좌번호, 개인정보 등)
- XSS 방어 (HTML sanitization)
- SQL Injection 방어 (입력 sanitization)

**인증:**
- SHA256 패스워드 해싱 (⚠️ bcrypt로 업그레이드 권장)
- Supabase Auth + 세션 쿠키
- 마스터 패스워드: 환경 변수로 관리 (프로덕션에서 비활성화)

**API 키 관리:**
- 절대 `.env.local` 파일을 커밋하지 마세요
- Service Role Key는 서버에서만 사용
- 주기적으로 키를 로테이션하세요

**보안 개선 우선순위:**
1. 🔴 노출된 API 키 폐기 (즉시)
2. 🔴 bcrypt 패스워드 해싱 도입
3. 🔴 Rate Limiting 구현
4. 🟡 Webhook 인증 추가
5. 🟡 Input Validation (Zod)

자세한 내용은 [SECURITY.md](./SECURITY.md)를 참조하세요.

## 라이센스

Private - Exit Company 전용

## 지원

문제가 발생하면:
1. [CLAUDE.md](./CLAUDE.md)의 트러블슈팅 섹션 확인
2. 개발팀에 문의
3. Supabase/OpenAI 대시보드에서 로그 확인

---

**Last Updated**: 2026-01-28
