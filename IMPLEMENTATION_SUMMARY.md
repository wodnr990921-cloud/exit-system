# API 구현 요약

## 개요

요청하신 6개의 API 엔드포인트가 모두 성공적으로 구현되었습니다. 모든 API는 TypeScript로 작성되었으며, Supabase를 통한 데이터베이스 접근, 적절한 권한 체크, 에러 처리, JSON 응답을 포함합니다.

---

## 구현된 파일 목록

### 1. API 엔드포인트
- `src/app/api/admin/impersonate/route.ts` - 직원 화면 미리보기 API
- `src/app/api/admin/impersonate/stop/route.ts` - Impersonation 종료 API
- `src/app/api/notices/popup/route.ts` - 공지사항 팝업 API
- `src/app/api/admin/cleanup/route.ts` - 데이터 청소 API
- `src/app/api/finance/point-liability/route.ts` - 포인트 부채 현황 API
- `src/app/api/sports/crawl/naver/route.ts` - 네이버 스포츠 크롤링 API (기존 존재)

### 2. 미들웨어 및 유틸리티
- `src/lib/middleware/audit-logger.ts` - 감사 로그 자동 기록 미들웨어

### 3. 타입 정의
- `src/lib/types/api-types.ts` - 모든 API의 타입 정의

### 4. 클라이언트 예제
- `src/lib/api/client-examples.ts` - 프론트엔드에서 API 호출 예제

### 5. 문서
- `API_USAGE_EXAMPLES.md` - API 사용 가이드 및 예제
- `IMPLEMENTATION_SUMMARY.md` - 이 파일

---

## 상세 구현 내역

### 1. 직원 화면 미리보기 (Impersonation) API ✅

**파일:**
- `src/app/api/admin/impersonate/route.ts`
- `src/app/api/admin/impersonate/stop/route.ts`

**기능:**
- ✅ POST: 다른 직원으로 로그인
- ✅ GET: 현재 Impersonate 상태 확인
- ✅ 세션에 original_user_id 저장 (쿠키 사용)
- ✅ admin만 접근 가능
- ✅ CEO 계정 Impersonate 차단
- ✅ 감사 로그 자동 기록

**엔드포인트:**
```
POST   /api/admin/impersonate        - 다른 직원으로 전환
GET    /api/admin/impersonate        - 상태 확인
POST   /api/admin/impersonate/stop   - 원래 계정 복귀
GET    /api/admin/impersonate/stop   - 복귀 가능 상태 확인
```

**보안 기능:**
- 쿠키 HttpOnly, Secure 설정
- 8시간 자동 만료
- 모든 작업 감사 로그 기록
- IP 주소 추적

---

### 2. 공지사항 팝업 API ✅

**파일:** `src/app/api/notices/popup/route.ts`

**기능:**
- ✅ GET: 활성 팝업 공지 조회
- ✅ POST: 팝업 공지 생성 (admin만)
- ✅ PUT: "다시 보지 않기" 처리
- ✅ 사용자별 팝업 표시 상태 관리
- ✅ 시작일/종료일 기반 자동 활성화
- ✅ 우선순위 지원

**엔드포인트:**
```
GET    /api/notices/popup   - 활성 팝업 공지 조회
POST   /api/notices/popup   - 팝업 공지 생성 (admin)
PUT    /api/notices/popup   - 다시 보지 않기 처리
```

**데이터베이스 테이블 필요:**
```sql
-- notices 테이블
-- notice_dismissals 테이블 (사용자별 팝업 무시 기록)
```

---

### 3. 데이터 청소 API ✅

**파일:** `src/app/api/admin/cleanup/route.ts`

**기능:**
- ✅ POST: 데이터 청소 실행
- ✅ GET: 정리 가능한 데이터 통계
- ✅ 3가지 청소 유형 지원:
  - `orphaned_files`: 고아 파일 (DB 참조 없는 스토리지 파일)
  - `old_logs`: 오래된 로그 데이터
  - `temp_data`: 임시 데이터 (취소된 거래 등)
- ✅ 정리 결과 리포트 반환
- ✅ admin만 접근

**엔드포인트:**
```
POST   /api/admin/cleanup?daysOld=30   - 데이터 청소 실행
GET    /api/admin/cleanup?daysOld=30   - 통계 조회
```

**청소 알고리즘:**
1. **고아 파일**: Storage 파일 목록 → DB 참조 확인 → 참조 없으면 삭제
2. **오래된 로그**: cutoffDate 이전 audit_logs 삭제
3. **임시 데이터**: 취소된 오래된 거래 삭제

---

### 4. 포인트 부채 현황 API ✅

**파일:** `src/app/api/finance/point-liability/route.ts`

**기능:**
- ✅ GET: 전체 포인트 부채 조회
- ✅ POST: 포인트 부채 리포트 생성
- ✅ 일반 포인트 + 베팅 포인트 합계
- ✅ 고객별 포인트 상세
- ✅ 최근 거래 내역
- ✅ 일별 포인트 변동 통계 (최근 7일)
- ✅ admin만 접근

**엔드포인트:**
```
GET    /api/finance/point-liability   - 포인트 부채 현황
POST   /api/finance/point-liability   - 리포트 생성
```

**데이터 구조:**
```typescript
liability: {
  total: 전체 포인트
  general: 일반 포인트
  betting: 베팅 포인트
  customerCount: 고객 수
  averagePerCustomer: 평균 포인트
}
```

**SQL 쿼리:**
```sql
SELECT SUM(total_point_general + total_point_betting)
FROM customers
```

---

### 5. 스포츠 크롤링 API (네이버) ✅

**파일:** `src/app/api/sports/crawl/naver/route.ts`

**기능:**
- ✅ POST: 네이버 스포츠 페이지 크롤링
- ✅ GET: 지원 리그 목록 조회
- ✅ cheerio 라이브러리 사용
- ✅ 6개 리그 지원 (KBO, MLB, K리그, EPL, KBL, NBA)
- ✅ games 테이블에 저장 (is_verified=false)
- ✅ 중복 경기 자동 체크
- ✅ Rate limiting 적용

**엔드포인트:**
```
POST   /api/sports/crawl/naver   - 크롤링 실행
GET    /api/sports/crawl/naver   - 지원 리그 목록
```

**지원 리그:**
- `kbo`: KBO (한국야구)
- `mlb`: MLB (미국야구)
- `kleague`: K리그 (한국축구)
- `epl`: 프리미어리그 (영국축구)
- `kbl`: KBL (한국농구)
- `nba`: NBA (미국농구)

**크롤링 데이터:**
- 홈팀/원정팀
- 경기 일시
- 경기 상태 (예정/진행중/종료/연기/취소)
- 경기 결과 (종료 시)
- 경기 장소

---

### 6. 감사 로그 자동 기록 미들웨어 ✅

**파일:** `src/lib/middleware/audit-logger.ts`

**기능:**
- ✅ 모든 DB 변경 작업 자동 기록
- ✅ 사용자 ID, 테이블명 저장
- ✅ 변경 전후 값 저장 및 비교
- ✅ IP 주소, User Agent 기록
- ✅ 대량 작업 지원
- ✅ 커스텀 액션 로깅

**제공 함수:**
```typescript
// CRUD 작업 래퍼
auditedInsert()    - CREATE with audit
auditedUpdate()    - UPDATE with audit (변경사항 비교)
auditedDelete()    - DELETE with audit (삭제 전 데이터 저장)

// 대량 작업
auditedBulkInsert()   - 대량 삽입
auditedBulkUpdate()   - 대량 업데이트

// 커스텀 작업
logCustomAction()     - 특수 작업 로깅

// 유틸리티
getIpFromRequest()       - IP 추출
getUserAgentFromRequest() - User Agent 추출
```

**사용 예제:**
```typescript
// 기존 코드
const { data, error } = await supabase
  .from('customers')
  .insert({ name: '홍길동' })

// 감사 로그 포함
const { data, error } = await auditedInsert(
  supabase,
  'customers',
  { name: '홍길동' },
  userId,
  ipAddress
)
// → 자동으로 audit_logs 테이블에 기록됨
```

---

## 공통 기능

모든 API는 다음 기능을 공통으로 포함합니다:

### 1. 권한 체크
```typescript
const { isAdmin, userId } = await checkAdminAccess()
if (!isAdmin || !userId) {
  return NextResponse.json(
    { error: "관리자 권한이 필요합니다." },
    { status: 403 }
  )
}
```

### 2. 에러 처리
```typescript
try {
  // API 로직
} catch (error: any) {
  console.error("API error:", error)
  return NextResponse.json(
    { error: "서버 오류가 발생했습니다.", details: error.message },
    { status: 500 }
  )
}
```

### 3. 일관된 응답 형식
```typescript
// 성공
{
  "success": true,
  "data": { ... }
}

// 실패
{
  "error": "에러 메시지",
  "details": "상세 정보"
}
```

### 4. 감사 로그 기록
모든 중요 작업(생성, 수정, 삭제)은 자동으로 audit_logs 테이블에 기록됩니다.

---

## 데이터베이스 테이블 요구사항

### 필수 테이블

#### 1. notices 테이블
```sql
CREATE TABLE notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_popup BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  priority INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notices_popup ON notices(is_popup, is_active, start_date);
```

#### 2. notice_dismissals 테이블
```sql
CREATE TABLE notice_dismissals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  notice_id UUID REFERENCES notices(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, notice_id)
);

CREATE INDEX idx_notice_dismissals_user ON notice_dismissals(user_id);
```

#### 3. audit_logs 테이블 (이미 존재하는 경우 확인)
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

#### 4. customers 테이블 (이미 존재하는 경우 확인)
```sql
-- total_point_general, total_point_betting 컬럼 필요
```

#### 5. point_transactions 테이블 (이미 존재하는 경우 확인)
```sql
-- customer_id, amount, point_type, transaction_type, created_at 컬럼 필요
```

---

## TypeScript 타입 정의

모든 API의 타입은 `src/lib/types/api-types.ts`에 정의되어 있습니다:

```typescript
import type {
  ImpersonateRequest,
  ImpersonateResponse,
  CreateNoticeRequest,
  CleanupRequest,
  PointLiabilityResponse,
  // ... 등
} from '@/lib/types/api-types'
```

---

## 프론트엔드 통합

클라이언트에서 API를 호출하는 예제는 `src/lib/api/client-examples.ts`에 있습니다:

```typescript
import {
  impersonateUser,
  getPointLiability,
  cleanupData
} from '@/lib/api/client-examples'

// 사용 예시
const result = await impersonateUser('user-id')
const liability = await getPointLiability()
```

---

## 보안 고려사항

### 1. Impersonation API
- ✅ CEO 계정으로는 Impersonate 불가
- ✅ 모든 Impersonate 작업 감사 로그 기록
- ✅ 세션 8시간 자동 만료
- ✅ HttpOnly, Secure 쿠키 사용

### 2. Cleanup API
- ⚠️ 삭제 전 백업 권장
- ⚠️ 프로덕션에서는 dry-run 모드 먼저 실행 권장
- ✅ admin 권한 필수

### 3. Point Liability API
- ✅ 민감한 재무 정보 - admin만 접근
- ✅ 모든 리포트 생성 감사 로그 기록

### 4. Audit Logger
- ✅ 모든 DB 변경사항 추적
- ✅ IP 주소 및 User Agent 기록
- ✅ 변경 전후 값 비교 저장

---

## 테스트 방법

### 1. Postman/Thunder Client로 테스트

```bash
# Impersonate
POST http://localhost:3000/api/admin/impersonate
Content-Type: application/json

{
  "targetUserId": "user-uuid-here"
}

# Point Liability
GET http://localhost:3000/api/finance/point-liability

# Cleanup Stats
GET http://localhost:3000/api/admin/cleanup?daysOld=30

# Sports Crawling
POST http://localhost:3000/api/sports/crawl/naver
Content-Type: application/json

{
  "league": "kbo",
  "type": "schedule",
  "saveToDb": true
}
```

### 2. 브라우저 콘솔에서 테스트

```javascript
// 포인트 부채 조회
fetch('/api/finance/point-liability')
  .then(r => r.json())
  .then(console.log)

// 팝업 공지 조회
fetch('/api/notices/popup')
  .then(r => r.json())
  .then(console.log)
```

---

## 다음 단계

### 1. 데이터베이스 마이그레이션
```sql
-- SQL 스크립트를 실행하여 필요한 테이블 생성
-- notices, notice_dismissals 테이블
```

### 2. 프론트엔드 통합
- Impersonate 버튼 추가 (관리자 페이지)
- 팝업 공지사항 컴포넌트 생성
- 포인트 부채 대시보드 페이지
- 데이터 청소 관리 페이지

### 3. 테스트
- 단위 테스트 작성
- 통합 테스트 작성
- E2E 테스트

### 4. 모니터링
- 감사 로그 모니터링 대시보드
- 포인트 부채 알림 설정
- 크롤링 실패 알림

---

## 문제 해결

### Q: "관리자 권한이 필요합니다" 에러
A: 현재 로그인한 사용자의 role이 'admin'인지 확인하세요.

### Q: Impersonate 후 원래 계정으로 돌아올 수 없음
A: 쿠키가 삭제되었거나 만료되었습니다. `/api/admin/impersonate/stop` GET으로 상태 확인.

### Q: 크롤링이 실패함
A: 네이버 스포츠 페이지 구조가 변경되었을 수 있습니다. HTML 셀렉터 확인 필요.

### Q: 포인트 부채 값이 0으로 나옴
A: customers 테이블에 total_point_general, total_point_betting 컬럼이 있는지 확인.

---

## 라이센스 및 의존성

### 주요 의존성
- Next.js 16.1.1
- React 19.2.3
- Supabase (@supabase/supabase-js 2.90.1)
- cheerio 1.1.2 (크롤링)
- TypeScript 5.9.3

### 개발 환경
- Node.js (권장: 18.x 이상)
- npm 또는 yarn

---

## 요약

✅ **6개의 API 엔드포인트 모두 구현 완료**
- 직원 화면 미리보기 (Impersonation)
- 공지사항 팝업
- 데이터 청소
- 포인트 부채 현황
- 스포츠 크롤링 (네이버)
- 감사 로그 자동 기록 미들웨어

✅ **모든 요구사항 충족**
- TypeScript 사용
- Supabase 클라이언트로 DB 접근
- 적절한 권한 체크
- 에러 처리
- JSON 응답

✅ **추가 제공**
- 타입 정의 파일
- 클라이언트 예제 코드
- 상세 문서
- 사용 가이드

구현이 완료되었습니다. 프론트엔드 통합 및 테스트를 진행하시면 됩니다!
