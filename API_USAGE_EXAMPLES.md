# API 사용 가이드

이 문서는 새로 구현된 API 엔드포인트들의 사용 방법을 설명합니다.

## 1. 직원 화면 미리보기 (Impersonation) API

관리자가 다른 직원의 계정으로 일시적으로 로그인하여 화면을 확인할 수 있습니다.

### 1.1 다른 직원으로 로그인

**Endpoint:** `POST /api/admin/impersonate`

**권한:** admin만

**Request Body:**
```json
{
  "targetUserId": "user-uuid-here"
}
```

**Response (성공):**
```json
{
  "success": true,
  "message": "john_doe 계정으로 전환되었습니다.",
  "impersonatedUser": {
    "id": "user-uuid",
    "username": "john_doe",
    "name": "홍길동",
    "role": "staff"
  },
  "originalUser": {
    "id": "admin-uuid",
    "username": "admin"
  }
}
```

**사용 예시:**
```javascript
const response = await fetch('/api/admin/impersonate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    targetUserId: 'target-user-id-here'
  })
});
const data = await response.json();
```

### 1.2 Impersonate 상태 확인

**Endpoint:** `GET /api/admin/impersonate`

**Response:**
```json
{
  "isImpersonating": true,
  "originalUser": {
    "id": "admin-uuid",
    "username": "admin",
    "name": "관리자",
    "role": "admin"
  },
  "currentUser": {
    "id": "user-uuid",
    "username": "john_doe",
    "name": "홍길동",
    "role": "staff"
  }
}
```

### 1.3 원래 계정으로 복귀

**Endpoint:** `POST /api/admin/impersonate/stop`

**Response:**
```json
{
  "success": true,
  "message": "원래 계정으로 복귀했습니다.",
  "user": {
    "id": "admin-uuid",
    "username": "admin",
    "name": "관리자",
    "role": "admin"
  }
}
```

---

## 2. 공지사항 팝업 API

### 2.1 활성 팝업 공지사항 조회

**Endpoint:** `GET /api/notices/popup`

**권한:** 로그인한 모든 사용자

**Response:**
```json
{
  "success": true,
  "notices": [
    {
      "id": "notice-uuid",
      "title": "시스템 점검 안내",
      "content": "2024년 1월 15일 오전 2시부터 4시까지 시스템 점검이 있습니다.",
      "is_popup": true,
      "is_active": true,
      "start_date": "2024-01-10T00:00:00Z",
      "end_date": "2024-01-20T23:59:59Z",
      "priority": 10,
      "created_at": "2024-01-10T10:00:00Z"
    }
  ],
  "count": 1
}
```

### 2.2 팝업 공지사항 생성

**Endpoint:** `POST /api/notices/popup`

**권한:** admin만

**Request Body:**
```json
{
  "title": "시스템 점검 안내",
  "content": "2024년 1월 15일 오전 2시부터 4시까지 시스템 점검이 있습니다.",
  "start_date": "2024-01-10T00:00:00Z",
  "end_date": "2024-01-20T23:59:59Z",
  "priority": 10
}
```

**Response:**
```json
{
  "success": true,
  "message": "팝업 공지사항이 생성되었습니다.",
  "notice": {
    "id": "notice-uuid",
    "title": "시스템 점검 안내",
    "content": "...",
    "is_popup": true,
    "is_active": true
  }
}
```

### 2.3 "다시 보지 않기" 처리

**Endpoint:** `PUT /api/notices/popup`

**권한:** 로그인한 모든 사용자

**Request Body:**
```json
{
  "noticeId": "notice-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "다시 보지 않기 처리되었습니다."
}
```

---

## 3. 데이터 청소 API

### 3.1 데이터 청소 실행

**Endpoint:** `POST /api/admin/cleanup`

**권한:** admin만

**Request Body:**
```json
{
  "cleanupType": "old_logs",
  "daysOld": 30
}
```

**cleanupType 옵션:**
- `orphaned_files`: 고아 파일 (DB에 참조 없는 스토리지 파일)
- `old_logs`: 오래된 로그 데이터
- `temp_data`: 임시 데이터 (취소된 거래 등)

**Response:**
```json
{
  "success": true,
  "message": "데이터 정리가 완료되었습니다.",
  "result": {
    "type": "old_logs",
    "deletedCount": 1234,
    "freedSpace": 0,
    "details": {
      "audit_logs": 1200,
      "system_logs": 34
    },
    "errors": []
  }
}
```

### 3.2 정리 가능한 데이터 통계 조회

**Endpoint:** `GET /api/admin/cleanup?daysOld=30`

**Response:**
```json
{
  "success": true,
  "stats": {
    "old_logs_count": 1234,
    "temp_data_count": 56
  },
  "daysOld": 30,
  "cutoffDate": "2023-12-15T00:00:00Z"
}
```

---

## 4. 포인트 부채 현황 API

### 4.1 포인트 부채 조회

**Endpoint:** `GET /api/finance/point-liability`

**권한:** admin만

**Response:**
```json
{
  "success": true,
  "liability": {
    "total": 5000000,
    "general": 3000000,
    "betting": 2000000,
    "customerCount": 150,
    "averagePerCustomer": 33333
  },
  "topCustomers": [
    {
      "id": "customer-uuid",
      "name": "홍길동",
      "generalPoints": 50000,
      "bettingPoints": 30000,
      "totalPoints": 80000
    }
  ],
  "recentTransactions": [
    {
      "id": "transaction-uuid",
      "customerId": "customer-uuid",
      "customerName": "홍길동",
      "customerCode": "C001",
      "amount": 10000,
      "pointType": "general",
      "transactionType": "deposit",
      "createdAt": "2024-01-14T10:00:00Z"
    }
  ],
  "dailyStats": [
    {
      "date": "2024-01-08",
      "added": 100000,
      "deducted": 50000,
      "net": 50000
    }
  ],
  "generatedAt": "2024-01-14T12:00:00Z"
}
```

### 4.2 포인트 부채 리포트 생성

**Endpoint:** `POST /api/finance/point-liability`

**권한:** admin만

**Request Body:**
```json
{
  "format": "json",
  "includeCustomers": true
}
```

**Response:**
```json
{
  "success": true,
  "report": {
    "generatedAt": "2024-01-14T12:00:00Z",
    "generatedBy": "admin-uuid",
    "summary": {
      "totalLiability": 5000000,
      "totalGeneral": 3000000,
      "totalBetting": 2000000,
      "customerCount": 150
    },
    "customers": [
      {
        "id": "customer-uuid",
        "name": "홍길동",
        "code": "C001",
        "generalPoints": 50000,
        "bettingPoints": 30000,
        "totalPoints": 80000
      }
    ]
  }
}
```

---

## 5. 스포츠 크롤링 API (네이버)

**Note:** 이 API는 이미 구현되어 있습니다. (`/api/sports/crawl/naver`)

### 5.1 네이버 스포츠 크롤링

**Endpoint:** `POST /api/sports/crawl/naver`

**Request Body:**
```json
{
  "league": "kbo",
  "type": "schedule",
  "saveToDb": true
}
```

**league 옵션:**
- `kbo`: KBO (한국야구)
- `mlb`: MLB (미국야구)
- `kleague`: K리그 (한국축구)
- `epl`: 프리미어리그 (영국축구)
- `kbl`: KBL (한국농구)
- `nba`: NBA (미국농구)

**type 옵션:**
- `schedule`: 일정
- `result`: 결과

**Response:**
```json
{
  "success": true,
  "message": "10개의 경기를 크롤링했습니다.",
  "stats": {
    "total": 10,
    "saved": 8,
    "updated": 2,
    "skipped": 0
  },
  "games": [
    {
      "league": "KBO",
      "homeTeam": "두산",
      "awayTeam": "LG",
      "gameDate": "2024-01-15T18:30:00Z",
      "status": "scheduled",
      "location": "잠실야구장"
    }
  ]
}
```

### 5.2 지원 리그 목록 조회

**Endpoint:** `GET /api/sports/crawl/naver`

**Response:**
```json
{
  "success": true,
  "leagues": [
    {
      "code": "kbo",
      "name": "KBO",
      "sport": "baseball"
    },
    {
      "code": "mlb",
      "name": "MLB",
      "sport": "baseball"
    }
  ]
}
```

---

## 6. 감사 로그 자동 기록 미들웨어

### 6.1 기본 사용법

```typescript
import {
  auditedInsert,
  auditedUpdate,
  auditedDelete,
  logCustomAction
} from '@/lib/middleware/audit-logger'

// CREATE - 자동 감사 로그
const { data, error } = await auditedInsert(
  supabase,
  'customers',
  { name: '홍길동', email: 'hong@example.com' },
  userId,
  ipAddress
)

// UPDATE - 자동 감사 로그 (변경 전후 비교)
const { data, error } = await auditedUpdate(
  supabase,
  'customers',
  customerId,
  { name: '김철수' },
  userId,
  ipAddress
)

// DELETE - 자동 감사 로그 (삭제 전 데이터 저장)
const { error } = await auditedDelete(
  supabase,
  'customers',
  customerId,
  userId,
  ipAddress
)
```

### 6.2 대량 작업

```typescript
// 대량 삽입
const { data, error } = await auditedBulkInsert(
  supabase,
  'customers',
  [
    { name: '홍길동' },
    { name: '김철수' },
    { name: '이영희' }
  ],
  userId,
  ipAddress
)

// 대량 업데이트
const { data, error } = await auditedBulkUpdate(
  supabase,
  'customers',
  'status',
  'active',
  { verified: true },
  userId,
  ipAddress
)
```

### 6.3 커스텀 액션 로깅

```typescript
await logCustomAction(
  supabase,
  userId,
  'password_reset',
  {
    email: 'user@example.com',
    reason: 'user_requested'
  },
  ipAddress
)
```

### 6.4 유틸리티 함수

```typescript
import { getIpFromRequest, getUserAgentFromRequest } from '@/lib/middleware/audit-logger'

// API Route에서 사용
export async function POST(request: NextRequest) {
  const ipAddress = getIpFromRequest(request)
  const userAgent = getUserAgentFromRequest(request)

  // ... 작업 수행
}
```

---

## 데이터베이스 테이블 요구사항

새로운 API들이 제대로 작동하려면 다음 테이블들이 필요합니다:

### notices 테이블
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
```

### notice_dismissals 테이블
```sql
CREATE TABLE notice_dismissals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  notice_id UUID REFERENCES notices(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, notice_id)
);
```

### point_transactions 테이블 (이미 존재하는 경우 확인)
```sql
-- 포인트 거래 내역 테이블이 필요합니다
-- customer_id, amount, point_type, transaction_type, created_at 등의 컬럼 필요
```

---

## 보안 고려사항

1. **Impersonation API**
   - CEO 계정으로는 Impersonate 불가
   - 모든 Impersonate 작업은 감사 로그에 기록됨
   - 세션은 8시간 후 자동 만료

2. **Cleanup API**
   - 삭제 전 백업 권장
   - 프로덕션 환경에서는 dry-run 모드 먼저 실행 권장
   - admin 권한 필수

3. **Point Liability API**
   - 민감한 재무 정보이므로 admin만 접근 가능
   - 모든 리포트 생성은 감사 로그에 기록됨

4. **Audit Logger**
   - 모든 DB 변경사항 추적
   - IP 주소 및 User Agent 기록
   - 변경 전후 값 비교 저장

---

## 에러 처리

모든 API는 일관된 에러 형식을 반환합니다:

```json
{
  "error": "에러 메시지",
  "details": "상세 에러 정보 (개발 환경)"
}
```

**HTTP 상태 코드:**
- `400`: 잘못된 요청 (파라미터 누락/형식 오류)
- `401`: 인증 실패
- `403`: 권한 없음
- `404`: 리소스를 찾을 수 없음
- `500`: 서버 내부 오류
