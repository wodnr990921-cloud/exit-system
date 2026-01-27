# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Development Commands](#development-commands)
3. [Architecture Overview](#architecture-overview)
   - Role-Based Permission System
   - Authentication Flow
   - OCR Processing Pipeline
   - Database Schema
   - Workflow Engine
   - API Route Organization
   - Client-Side Data Fetching
   - Prohibited Content Detection
   - Important Configuration
   - Key Development Patterns
4. [Business Logic & Requirements](#business-logic--requirements)
5. [Complete Code Examples](#complete-code-examples)
6. [Common Patterns Summary](#common-patterns-summary)
7. [Testing & Debugging](#testing--debugging)
8. [Known Limitations & Future Improvements](#known-limitations--future-improvements)
9. [Deployment Guide](#deployment-guide)
10. [Database Management](#database-management)
11. [Security Considerations](#security-considerations)
12. [Quick Reference](#quick-reference)

---

## Project Overview

This is a **correctional facility management system** ("Exit Company") built with Next.js 16, handling inmate correspondence, financial transactions, point systems, and various operational workflows. The system features OCR processing with GPT-4o, role-based access control, and comprehensive audit logging.

**Tech Stack:**
- Next.js 16.1.1 (App Router, React 19, TypeScript)
- Supabase (PostgreSQL + Auth)
- OpenAI GPT-4o (OCR via Vision API)
- Tailwind CSS + Radix UI components
- Puppeteer (web crawling)

## Development Commands

```bash
# Development
npm run dev          # Start development server (http://localhost:3000)

# Production
npm run build        # Build for production (standalone output)
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint
```

**Important:** All pages are rendered dynamically (`force-dynamic`), with no static generation or caching.

## Architecture Overview

### 1. Role-Based Permission System

The system uses a **5-tier hierarchy** defined in `src/lib/permissions.ts`:

```typescript
CEO (100)          // Highest authority, can delete/modify confirmed records
├─ Admin (80)      // Full administrative access
├─ Operator (60)   // Manager-level, can approve/close tasks
├─ Staff (40)      // Regular employee, can process tasks
└─ Employee (20)   // Temporary/limited access
```

**Key Functions:**
- `hasMinimumRole(userRole, minimumRole)` - Check if user meets minimum requirement
- `isAdminRole(role)` - Check if role is CEO/Admin/Operator
- `canAccess(userRole, requiredRoles)` - Check feature access

**Important:** Always use these helpers from `src/lib/permissions.ts` when implementing access control.

### 2. Authentication Flow

Located in `src/middleware.ts` and `src/app/api/auth/`:

1. Login: `POST /api/auth/login`
   - SHA256 password hashing + Supabase Auth
   - Master password bypass: `master2026exit`
   - Admin cheat code: `exitadmin2026`
   - Returns session cookie

2. Middleware Protection:
   - All `/dashboard/*` and `/mobile/*` routes require authentication
   - Checks `is_approved` status from `users` table
   - Unapproved users are logged out and redirected

3. Server-side Client Creation:
   ```typescript
   import { createClient } from '@/lib/supabase/server'
   const supabase = await createClient()
   const { data: { user } } = await supabase.auth.getUser()
   ```

### 3. OCR Processing Pipeline

Located in `src/app/api/ocr/route.ts`:

**Multi-stage Pipeline:**
```
1. Image Upload (FormData or JSON with URL)
   ↓
2. Image Type Detection (GPT-4o)
   - envelope / letter_content / product_photo / remittance_proof / unknown
   ↓
3. Type-Specific OCR (GPT-4o Vision)
   - Structured data extraction based on type
   ↓
4. Prohibited Content Detection
   - Pattern matching for account numbers, phone numbers, profanity
   - Scoring: low/medium/high severity
   ↓
5. Customer Matching (Levenshtein distance)
   - Automatic customer lookup from 'customers' table
   ↓
6. Handwriting Extraction (if letter_content)
   - GPT-4o converts handwriting to text
```

**Usage Example:**
```typescript
// FormData upload
const formData = new FormData()
formData.append('image', file)
formData.append('detectImageType', 'true')
const response = await fetch('/api/ocr', {
  method: 'POST',
  body: formData
})

// JSON with URL
const response = await fetch('/api/ocr', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    imageUrl: 'https://...',
    detectProhibited: true
  })
})
```

**Important:**
- Max file size: 10MB
- Supported formats: JPEG, PNG, HEIC
- All OCR uses GPT-4o model with low temperature (0.1-0.3) for accuracy

### 4. Database Schema (Supabase)

**Core Tables:**

```typescript
// users - Staff accounts
{
  id: uuid (FK to auth.users)
  username: string (unique)
  name: string
  role: 'ceo' | 'admin' | 'operator' | 'staff' | 'employee'
  is_approved: boolean
  last_login_at: timestamp
}

// customers - Inmate records
{
  id: uuid
  member_number: string (unique, e.g., "M-0012")
  name: string
  institution: string (prison name)
  prison_number: string
  total_point_general: number
  total_point_betting: number
  total_deposit: number
}

// tasks - Work tickets
{
  id: uuid
  ticket_no: string (auto-generated, unique)
  member_id: uuid (FK to customers)
  assignee_id: uuid (FK to users)
  status: 'pending' | 'processing' | 'processed' | 'closed'
  total_amount: number
  ai_summary: text (GPT-generated)
  reply_content: text
  closed_at: timestamp
  closed_by: uuid (FK to users)
}

// task_items - Line items within tasks
{
  id: uuid
  task_id: uuid (FK to tasks)
  category: 'book' | 'game' | 'goods' | 'inquiry' | 'other'
  description: text
  amount: number
  procurement_status: string
}

// points - Point transactions
{
  id: uuid
  customer_id: uuid (FK to customers)
  amount: number
  category: 'general' | 'betting'
  type: 'charge' | 'use' | 'refund' | 'exchange'
  status: 'pending' | 'approved' | 'confirmed'
  is_reversed: boolean
}

// audit_logs - All user actions
{
  id: uuid
  user_id: uuid (FK to users)
  action: 'SELECT' | 'UPDATE' | 'INSERT' | 'DELETE'
  table_name: string
  record_id: string
  old_values: jsonb
  new_values: jsonb
  ip_address: string
}
```

**Important Patterns:**
- All tables have `created_at` and `updated_at` timestamps
- Use `supabase.rpc()` for complex operations requiring service role
- Financial operations should use database transactions
- Audit logging is critical - use middleware from `src/lib/middleware/audit-logger.ts`

### 5. Workflow Engine

**Task Lifecycle:**
```
1. Letter Received (physical) → Photo captured
   ↓
2. Upload to /api/ocr → Image processed
   ↓
3. Staff creates task (POST /api/tickets/create)
   ↓
4. Staff processes: status = 'processing'
   ↓
5. Staff completes: status = 'processed'
   ↓
6. Operator/Admin approves: status = 'closed', closed_at set
   ↓
7. Daily closing → PDF generation → Physical mail sent
```

**Critical:**
- Unclosed tasks appear on dashboard until daily closing
- Only Operator+ can approve/close tasks
- Only CEO can delete closed tasks

### 6. API Route Organization

**69 API routes across domains:**

```
/api/auth/*                    # Authentication (login, signup, password)
/api/ocr/*                     # OCR processing
/api/categorize                # AI text classification
/api/summarize                 # AI summarization
/api/customers/*               # Customer management
/api/inmates/*                 # Inmate records
/api/tickets/*                 # Task creation
/api/points/*                  # Point operations
/api/finance/*                 # Financial transactions
/api/settlements/*             # Monthly settlements
/api/sports/*                  # Sports betting system
/api/inventory/*               # Inventory management
/api/logistics/*               # Logistics/shipping
/api/document-retention/*      # Document lifecycle
/api/audit-logs                # Audit log queries
/api/admin/*                   # Admin-only operations
/api/closing/*                 # Daily closing operations
```

**Patterns:**
- All routes use `NextRequest`/`NextResponse`
- Authentication checked via `await createClient()` then `supabase.auth.getUser()`
- Errors return `{ success: false, error: "message" }` with appropriate status code
- Success returns `{ success: true, data: {...} }`

### 7. Client-Side Data Fetching

**Pattern (used throughout `*-client.tsx` files):**

```typescript
'use client'

useEffect(() => {
  const fetchData = async () => {
    const response = await fetch('/api/endpoint')
    const result = await response.json()
    if (result.success) {
      setData(result.data)
    }
  }
  fetchData()
}, [])
```

**Important:**
- All dashboard pages are client components (`'use client'`)
- Use `useState` + `useEffect` for data fetching
- No centralized state management (no Redux/Zustand)
- Real-time updates via polling or manual refresh

### 8. Prohibited Content Detection

Located in `src/lib/content-filter.ts`:

**Patterns Detected:**
- Bank account numbers (숫자-숫자-숫자 format)
- Phone numbers (010-1234-5678, etc.)
- ID numbers (주민등록번호)
- Profanity and slang

**Severity Levels:**
- `high`: Account numbers + bank names
- `medium`: Phone numbers, standalone account patterns
- `low`: Mild profanity

**Usage:**
```typescript
import { detectProhibitedContent } from '@/lib/content-filter'
const detection = detectProhibitedContent(text)
// { found: boolean, score: number, matches: [...], severity: 'high' }
```

### 9. Important Configuration

**Next.js Config (`next.config.js`):**
```javascript
{
  output: 'standalone',              // Docker-ready build
  serverActions: {
    bodySizeLimit: '2mb'             // Max request size
  },
  headers: {
    'Cache-Control': 'no-store, must-revalidate'  // Force dynamic rendering
  }
}
```

**Root Layout (`src/app/layout.tsx`):**
```typescript
export const dynamic = 'force-dynamic'  // All pages are SSR
export const revalidate = 0             // No caching
```

**TypeScript Config (tsconfig.json):**
```json
{
  "compilerOptions": {
    "strict": false,              // ⚠️ Strict mode disabled
    "noImplicitAny": false,       // Allows implicit any
    "paths": {
      "@/*": ["./src/*"]          // Import alias
    }
  }
}
```

**Important:** TypeScript strict mode is **disabled** in this project. When adding new code, you can use `any` types if needed, but prefer explicit typing when possible.

**Tailwind Config:**
```typescript
// Uses Tailwind CSS v4 with new PostCSS plugin
// Content paths: src/pages, src/components, src/app
// CSS Variables: --background, --foreground
```

**Environment Variables Required:**

Create `.env.local` file in root:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...    # For admin operations

# OpenAI
OPENAI_API_KEY=sk-...                   # For OCR/AI features

# Sports Betting (Optional)
ODDS_API_KEY=...                        # For sports betting odds
```

**Critical:** The `SUPABASE_SERVICE_ROLE_KEY` is required for login to work, as it creates Auth sessions programmatically.

### 10. Key Development Patterns

**Adding a New Feature:**

1. **Define Types** (`src/types/index.ts`)
   ```typescript
   export interface NewFeature {
     id: string
     // ... fields
   }
   ```

2. **Create API Route** (`src/app/api/feature/route.ts`)
   ```typescript
   export async function POST(request: NextRequest) {
     const supabase = await createClient()
     const { data: { user } } = await supabase.auth.getUser()

     if (!user) {
       return NextResponse.json(
         { success: false, error: 'Unauthorized' },
         { status: 401 }
       )
     }

     // ... logic

     return NextResponse.json({ success: true, data })
   }
   ```

3. **Create Client Component** (`src/app/dashboard/feature/feature-client.tsx`)
   ```typescript
   'use client'

   export default function FeatureClient() {
     const [data, setData] = useState([])

     useEffect(() => {
       fetchData()
     }, [])

     const fetchData = async () => {
       const res = await fetch('/api/feature')
       const result = await res.json()
       if (result.success) setData(result.data)
     }

     return <div>...</div>
   }
   ```

4. **Create Page** (`src/app/dashboard/feature/page.tsx`)
   ```typescript
   import FeatureClient from './feature-client'

   export const dynamic = 'force-dynamic'
   export const revalidate = 0

   export default function FeaturePage() {
     return <FeatureClient />
   }
   ```

**Role-Based Feature Access:**
```typescript
import { hasMinimumRole, isAdminRole } from '@/lib/permissions'

// In API route:
const { data: userData } = await supabase
  .from('users')
  .select('role')
  .eq('id', user.id)
  .single()

if (!hasMinimumRole(userData.role, 'operator')) {
  return NextResponse.json(
    { success: false, error: 'Insufficient permissions' },
    { status: 403 }
  )
}
```

### 11. Mobile Interface

Separate mobile routes under `/mobile/*`:
- Limited functionality for field operations
- Simplified UI for mobile devices
- Same authentication requirements
- Uses same API routes as desktop

**Access via:** `http://localhost:3000/mobile`

### 12. Dashboard Design by Role

**직원 대시보드 (Staff):**
- **업무 패널이 곧 대시보드**
- 자신에게 배정된 업무 목록 (팔로우업 가능)
- 업무 등록 폼 (회원 검색, 분류 선택)
- 처리 중인 업무 현황
- 업무 보고 기능 (출퇴근, 비품)

**이사 이상 대시보드 (Operator+):**
- 승인 대기 목록 강조 표시
- 전체 업무 현황 오버뷰
- 재무 요약 (일일/월별)
- 리스크 상태 모니터링
- 승인/반려 원클릭 처리
- 팀 전체 업무 진행률

**대표 대시보드 (CEO):**
- 전체 통합 관리 뷰
- 수정/삭제 권한 UI
- 감사 로그 열람
- 시스템 설정 접근
- 재무 상세 분석

### 12. QA System (통합 작업 처리 시스템)

Located at `/dashboard/qa`, this is a **unified task processing interface** with 4 main categories:

**4개 탭 구조:**

1. **상담 (Intake)** - `IntakeContent` component
   - 신규 편지/문의 접수
   - OCR 처리된 내용 검수
   - 담당자 배정

2. **구매 (Purchase)** - Shopping cart functionality
   - 도서 발주 (Book ordering)
   - 물품 구매 대행 (Product purchasing)
   - 장바구니 기능

3. **반송 (Returns)** - `ReturnsContent` component
   - 반송 처리 (이감, 출소, 수취인불명, 금지물품)
   - 재발송 비용 관리

4. **문의 (Inquiry)** - General inquiries
   - 기타 문의사항 처리
   - 답변 작성

**Key Features:**
- **신규 티켓 생성:** 회원 검색 → 분류 선택 → 내용 입력
- **신규 회원 등록:** 회원번호 자동 생성 (YYYYMMDD-순번 형식)
- **장바구니 시스템:**
  - 도서: 검색 후 추가
  - 구매 대행: 품목 + 금액 입력
  - 베팅: 경기 + 배당률 + 금액 입력
- **통합 워크플로우:** 각 탭은 독립적이지만 동일한 티켓 시스템 사용

**Implementation Pattern:**
```typescript
// QA 시스템은 기존 컴포넌트를 동적 임포트로 재사용
const IntakeContent = dynamic(() => import("../intake/intake-client"), {
  ssr: false,
})
```

### 13. Sports Betting System

Features specialized crawling and odds management:
- Auto-crawl from Naver Sports: `/api/sports/crawl/naver`
- AI-powered result parsing: `/api/sports/crawl/ai`
- Odds history tracking: `/api/odds-history`
- Auto-settlement: `/api/sports/auto-settle`
- Manual verification required before payout

### 13. Testing & Debugging

**Common Issues:**

1. **OCR Failures:**
   - Check OpenAI API key is set in `.env.local`
   - Verify rate limits (max 10,000 requests/min on paid plans)
   - Image size must be < 10MB
   - Check network connectivity to `api.openai.com`

2. **Auth Issues:**
   - Verify all 3 Supabase env vars are set
   - Check `SUPABASE_SERVICE_ROLE_KEY` is present (required for login)
   - User must have `is_approved: true` in `users` table
   - Check browser cookies are enabled
   - Clear browser cookies if experiencing stale sessions

3. **Permission Errors:**
   - Check role hierarchy: CEO (100) > Admin (80) > Operator (60) > Staff (40) > Employee (20)
   - Verify user role in database matches expected
   - Use `hasMinimumRole()` function, not manual comparisons
   - API routes should check both auth AND role

4. **Build Errors:**
   - Clear `.next` folder: `rm -rf .next` (or `rmdir /s .next` on Windows)
   - Delete `node_modules` and reinstall: `npm ci`
   - Clear TypeScript cache: `rm -rf .next *.tsbuildinfo`
   - Check for circular dependencies
   - Verify all imports use correct paths with `@/` alias

5. **Database Errors:**
   - Foreign key violations: Check referenced records exist
   - Unique constraint violations: Check for duplicate `member_number`, `ticket_no`, etc.
   - RLS Policy errors: Use service role key for admin operations
   - Connection issues: Verify Supabase project is active

6. **PDF Generation Issues:**
   - Not yet implemented - requires `jspdf` or `react-to-print` library
   - PDF should include all daily tasks with `reply_content`
   - Format must match postal letter standards

7. **Real-time Update Issues:**
   - Currently using polling, not real-time subscriptions
   - To add real-time: Use Supabase Realtime or implement SSE/WebSocket
   - Consider adding `supabase.channel()` subscriptions

**Debugging API Routes:**
```typescript
console.log('[API] Request:', {
  method: request.method,
  url: request.url,
  body,
  user: user?.id,
  role: userData?.role
})
console.log('[API] Response:', { success, data, error })
console.error('[API] Error:', error.message, error.stack)
```

**Check TypeScript Errors:**
```bash
npx tsc --noEmit
```

**Test API Route Manually:**
```bash
# Using curl
curl -X POST http://localhost:3000/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'

# Check logs in terminal running `npm run dev`
```

**Database Queries for Debugging:**

```sql
-- Check user role and approval status
SELECT id, username, role, is_approved, last_login
FROM users
WHERE username = 'your_username';

-- Find unclosed tasks
SELECT id, ticket_no, status, created_at
FROM tasks
WHERE status != 'closed'
ORDER BY created_at DESC;

-- Check customer points
SELECT name, member_number,
       total_point_general,
       total_point_betting,
       total_deposit,
       total_usage
FROM customers
WHERE name LIKE '%이름%';

-- View recent audit logs
SELECT created_at, user_id, action, table_name, record_id
FROM audit_logs
ORDER BY created_at DESC
LIMIT 20;
```

## Business Logic & Requirements (from last_order.md)

### Core Business Workflow

```
현실 편지 수령
  ↓
편지 사진 촬영/업로드 (웹 시스템 시작)
  ↓
OCR 처리 (이미지 타입 감지, 텍스트 추출, 금지어 검사)
  ↓
검수 및 담당자 배정
  ↓
업무 처리 시작 (베팅/발주/대행)
  ↓
업무 처리 중
  ↓
이사급 이상 승인
  ↓
일일 마감
  ↓
일괄 PDF 출력 (마감 안 된 답변 포함)
  ↓
포장 및 발송 (현실)
```

**Critical Rules:**
1. **마감 전까지** 미처리 티켓은 대시보드에 계속 표시되어야 함 → 단 하나의 업무도 놓치지 않게
2. **업무 유형별** 처리 흐름이 다름:
   - 발주: 발주서 생성 → 배송 추적
   - 물품 구매/판매 대행: 견적 → 승인 → 구매 → 배송
   - 베팅: 평균 배당률 -0.1 자동 계산 → 결과 입력 → 자동 정산

3. **스포츠 베팅 규칙:**
   - 모든 배당률에서 **자동으로 -0.1 차감** (마진 확보)
   - 결과 입력 시 회원 잔액 자동 정산
   - 수동 검증 필수

### Dashboard Structure (4-Panel Layout)

**Panel 1: 월별 운영 요약 (Monthly Summary)**
- 총 입금액, 총 지출액, 월간 순이익
- 최다 이용 회원 TOP 3
- 전월 대비 증감률

**Panel 2: 일일 결산 리포트 (Daily Report)**
- 금일 입금/출금/순이익
- 경리 승인 대기 건수 강조
- 실시간 업데이트

**Panel 3: 직원 업무 패널 (Staff Task Panel)**
- 회원 검색 및 업무 등록 폼
- 나의 업무 현황 리스트
- 처리 중/대기 중 상태별 필터링

**Panel 4: 사장님 통합 관리 패널 (Admin Control Panel)**
- 이체 대기 건수 및 리스크 상태
- 미처리 이체/승인 목록
- [승인], [반려] 버튼으로 즉시 처리

### Authority Hierarchy & Enforcement

**직원 (Staff/Employee):**
- 업무 신청 및 실무 처리
- 티켓 생성, 상태 업데이트 (pending → processing → processed)
- 마감/결재 권한 **없음**

**이사급 (Operator):**
- 직원이 처리한 업무 승인/반려
- 일일 마감 처리 권한
- 재무 결재 권한

**대표 (CEO):**
- 확정된 내용 수정/삭제 권한 (유일)
- 모든 감사 기록 열람
- 시스템 설정 변경

**Implementation Note:** 백엔드 미들웨어에서 JWT 토큰의 권한을 확인하여, 직원이 승인 API를 호출하거나 대표 전용 수정 API를 호출하는 행위를 원천 차단해야 함.

### Critical Technical Requirements

**1. Database Transactions (금융 무결성)**
모든 금융 관련 API(입출금, 잔액 차감, 환급)는 **트랜잭션 처리 필수**:
```typescript
// Example pattern
const { error } = await supabase.rpc('process_payment_transaction', {
  customer_id,
  amount,
  type: 'charge'
})
// Rollback on error to prevent data corruption
```

**Why:** 서버 다운 시 돈만 깎이고 기록이 안 남는 상황 방지.

**2. Real-time Notifications (업무 누락 방지)**
중요 이벤트는 **실시간 알림** 필요:
- 이사급 승인 요청
- 신규 티켓 등록
- 당첨 발생
- 포인트 충전

**Implementation:** Server-Sent Events (SSE) 또는 Socket.io 사용.

**3. PDF 출력 규격**
일일 마감 시 생성되는 PDF는:
- **우편 편지용 정규 규격**에 맞춰야 함
- 당일 모든 업무 답변 내용 포함 (마감 안 된 것도 포함)
- 자동 다운로드 및 인쇄 가능
- Tools: `jspdf` or `react-to-print`

**4. Audit Logging (감사 추적)**
모든 중요 작업은 `audit_logs` 테이블에 기록:
- 누가 (user_id)
- 무엇을 (action, table_name)
- 언제 (created_at)
- 변경 전/후 (old_values, new_values)
- 어디서 (ip_address)

**절대 삭제하거나 우회하지 말 것.**

### Work Report System (업무 보고)

직원 출퇴근, 비품 출납 등을 포함하는 **업무 보고** 기능:
- 출퇴근 버튼
- 비품 사용 기록
- 각종 기능과 연동
- 대시보드에 통합 표시

### Member Management Features

회원 관리의 핵심:
- **통합 조회 창:** 회원별 포인트 사용 기록, 모든 티켓 이력 한눈에 조회
- 입출금 내역 타임라인
- 베팅 이력
- 구매 대행 이력
- 전체 커뮤니케이션 히스토리

**Goal:** 회원 관리 및 기록의 편의성에 초점.

## Non-Obvious Architectural Decisions

1. **Dual Password Systems:** SHA256 in database + Supabase Auth for session management
2. **Service Role Usage:** Admin operations bypass RLS policies using service role key
3. **No Real-time Subscriptions (Currently):** Despite Supabase support, system uses polling - but **should migrate to real-time** for critical events
4. **GPT-4o for OCR:** Chosen over Tesseract for better Korean handwriting recognition
5. **Force Dynamic Rendering:** All pages are SSR with no caching for real-time accuracy
6. **Client-Component Heavy:** Most pages are `'use client'` for interactive dashboards
7. **Manual Approvals:** Multi-tier approval workflow prevents accidental operations
8. **Zero Tolerance for Lost Tasks:** Dashboard keeps showing unclosed tickets until daily closing to ensure nothing is missed

## Complete Code Examples

### Example 1: Standard API Route Pattern

```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Authentication check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Get user role for permission check
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // 3. Check permissions
    if (!hasMinimumRole(userData.role, 'operator')) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      )
    }

    // 4. Parse request body
    const { data } = await request.json()

    // 5. Validate input
    if (!data) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // 6. Database operation
    const { data: result, error } = await supabase
      .from("table_name")
      .insert([data])
      .select()
      .single()

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json(
        { error: "Operation failed", details: error.message },
        { status: 500 }
      )
    }

    // 7. Success response
    return NextResponse.json({
      success: true,
      data: result,
      message: "Operation completed successfully"
    })

  } catch (error: any) {
    console.error("API Error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}
```

### Example 2: Login Flow (Complex Authentication)

```typescript
// Supports 4 authentication methods:
// 1. Master Password (master2026exit) - Auto-approve + bypass all checks
// 2. Admin Cheat Code (exitadmin2026) - Grant admin role
// 3. Temporary Password - Force password change after login
// 4. Normal Password - Standard SHA256 verification

const hashedPassword = crypto
  .createHash("sha256")
  .update(password)
  .digest("hex")

// Verify against users.password_hash
// Then create Supabase Auth session using service role
const { data: sessionData } = await adminClient.auth.signInWithPassword({
  email: userData.email || `${username}@internal.exit.com`,
  password: password,
})

// Return session to client for cookie storage
return NextResponse.json({
  success: true,
  session: sessionData.session,
})
```

### Example 3: GPT-4o Integration for OCR

```typescript
// Multi-stage OCR pipeline
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  },
  body: JSON.stringify({
    model: "gpt-4o", // Vision model for images
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`
            },
          },
        ],
      },
    ],
    max_tokens: 2000,
    temperature: 0.1, // Low temperature for accuracy
  }),
})

const data = await response.json()
const content = data.choices[0]?.message?.content

// Parse JSON response (may be wrapped in ```json blocks)
let jsonString = content.trim()
if (jsonString.startsWith("```")) {
  jsonString = jsonString
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
}
const result = JSON.parse(jsonString)
```

### Example 4: GPT-4o-mini for Summarization (Cost-Effective)

```typescript
// Use gpt-4o-mini for simple text tasks to save costs
const summaryResponse = await fetch(
  "https://api.openai.com/v1/chat/completions",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // Cheaper model for text-only tasks
      messages: [
        {
          role: "user",
          content: `다음 티켓 아이템들을 간결하게 요약해주세요:

${itemsText}

요약:`,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    }),
  }
)
```

### Example 5: Daily Closing Flow

```typescript
// Step 1: Generate AI reply
const reply = await fetch('/api/closing/generate-reply', {
  method: 'POST',
  body: JSON.stringify({ taskId }),
})

// Step 2: Approve and close task
const close = await fetch('/api/closing/approve', {
  method: 'POST',
  body: JSON.stringify({
    taskId,
    replyContent: reply.replyContent
  }),
})

// Only Operator+ can approve/close
// Updates: status -> 'closed', closed_at, closed_by
// Points become immutable after closing
```

### Example 6: Prohibited Content Detection

```typescript
import { detectProhibitedContent, formatDetectionSummary } from '@/lib/content-filter'

const detection = detectProhibitedContent(text)

if (detection.found) {
  console.log(`Risk Score: ${detection.score}/100`)
  console.log(`Summary: ${formatDetectionSummary(detection)}`)

  // Display highlighted text (HTML with spans)
  setHighlightedText(detection.highlightedText)

  // Show warnings by category
  detection.matches.forEach(match => {
    if (match.severity === 'high') {
      alert(`High risk: ${match.description} - "${match.text}"`)
    }
  })
}

// Patterns detected:
// - Account numbers: 123-456-789
// - Phone numbers: 010-1234-5678
// - Bank names + numbers: "국민은행 123456789"
// - Profanity: Various Korean curse words
// - Illegal substances: Drug names, weapons
```

### Example 7: Client Component with Real-time Data

```typescript
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DashboardClient() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
    // Optionally: Set up polling for real-time updates
    const interval = setInterval(fetchData, 30000) // Every 30s
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const response = await fetch('/api/endpoint')
    const result = await response.json()

    if (result.success) {
      setData(result.data)
    }
    setLoading(false)
  }

  return (
    <div>
      {loading ? <p>Loading...</p> : <DataDisplay data={data} />}
    </div>
  )
}
```

### Example 8: Ticket Creation with Transaction Safety

```typescript
// Create ticket with automatic rollback on failure
const { data: taskData, error: taskError } = await supabase
  .from("tasks")
  .insert([taskInfo])
  .select()
  .single()

if (taskError) {
  return NextResponse.json({ error: "Task creation failed" })
}

// Create task items
const { error: itemsError } = await supabase
  .from("task_items")
  .insert(taskItems)

if (itemsError) {
  // Rollback: Delete the task
  await supabase.from("tasks").delete().eq("id", taskData.id)
  return NextResponse.json({ error: "Items creation failed" })
}

// Generate ticket number: TYYYYMMDD-XXXXXX
const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, "")
const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase()
const ticket_no = `T${dateStr}-${randomStr}`
```

## Common Patterns Summary

**Authentication:**
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
```

**Permission Check:**
```typescript
import { hasMinimumRole } from '@/lib/permissions'
if (!hasMinimumRole(userRole, 'operator')) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

**Error Response:**
```typescript
return NextResponse.json(
  { success: false, error: "Error message", details: error.message },
  { status: 500 }
)
```

**Success Response:**
```typescript
return NextResponse.json({
  success: true,
  data: result,
  message: "Success message"
})
```

## Known Limitations & Future Improvements

**Current Limitations:**

1. **No Database Transactions:** Supabase JS client doesn't support true transactions
   - Current workaround: Manual rollback in catch blocks
   - Future: Use Postgres RPC functions with transaction support

2. **No Real-time Updates:** Currently uses polling
   - Should implement: Supabase Realtime subscriptions or SSE
   - Priority: High (for "zero lost tasks" requirement)

3. **No PDF Generation Yet:** Daily closing PDF not implemented
   - Should use: `jspdf` or `react-to-print`
   - Must match: Postal letter format standards

4. **No Automated Tests:** No Jest/Vitest test suite
   - Should add: API route tests, component tests
   - Priority: Medium

5. **TypeScript Strict Mode Disabled:** Less type safety
   - Trade-off: Faster development vs. type safety
   - Keep disabled for now, but prefer explicit types

6. **No Internationalization:** Korean only
   - Not a priority: Domestic system

7. **Limited Error Recovery:** Some operations fail silently
   - Should add: Retry logic, better error messages

**Planned Improvements (from last_order.md):**

1. **Real-time Notifications:**
   - Server-Sent Events for approval requests
   - Browser push notifications for urgent events
   - Sound alerts for new tasks

2. **Financial Transaction Safety:**
   - Implement database-level transactions via RPC
   - Add idempotency keys to prevent duplicate operations
   - Better reconciliation tools

3. **Comprehensive Audit Trail:**
   - Already implemented in `audit_logs` table
   - Add UI for viewing audit history
   - Export to Excel for compliance

4. **Enhanced Dashboard:**
   - Role-specific widgets
   - Customizable layouts
   - Performance metrics

5. **Work Report Integration:**
   - Attendance tracking (clock in/out)
   - Office supply inventory
   - Daily operation summaries

## Deployment Guide

**Local Development:**
```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev

# Open http://localhost:3000
```

**Production Build:**
```bash
# Build for production
npm run build

# Test production build locally
npm start

# Runs on http://localhost:3000
```

**Vercel Deployment (Recommended):**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - OPENAI_API_KEY
# - ODDS_API_KEY (optional)
```

**Docker Deployment:**
```dockerfile
# Dockerfile (example)
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

**Environment-Specific Notes:**
- Development: Hot reload enabled, verbose logging
- Production: Standalone build, optimized assets, no source maps
- Staging: Same as production but with test data

## Database Management

**Supabase Dashboard:**
- URL: https://supabase.com/dashboard/project/YOUR_PROJECT_ID
- Access: SQL Editor, Table Editor, Authentication, Storage

**Common SQL Operations:**

```sql
-- Create new user (manual)
INSERT INTO users (id, username, name, role, is_approved)
VALUES (
  gen_random_uuid(),
  'newuser',
  '새 사용자',
  'staff',
  true
);

-- Approve pending users
UPDATE users
SET is_approved = true
WHERE username IN ('user1', 'user2');

-- Reset user password hash
UPDATE users
SET password_hash = encode(digest('newpassword', 'sha256'), 'hex')
WHERE username = 'username';

-- Manually close task
UPDATE tasks
SET status = 'closed',
    closed_at = now(),
    closed_by = 'USER_ID_HERE'
WHERE id = 'TASK_ID_HERE';

-- Delete test data (careful!)
DELETE FROM task_items WHERE task_id IN (
  SELECT id FROM tasks WHERE ticket_no LIKE 'T20240101-%'
);
DELETE FROM tasks WHERE ticket_no LIKE 'T20240101-%';
```

**Backup Strategy:**
- Supabase automatically backs up database daily
- Manual export: Use SQL Editor > Export to CSV
- Critical tables: `users`, `customers`, `tasks`, `points`, `audit_logs`

## Security Considerations

⚠️ **CRITICAL: See [SECURITY.md](./SECURITY.md) for detailed security audit and improvements.**

### Recent Security Improvements (2026-01-28)

**Fixed Issues:**
1. ✅ Removed exposed API keys from `.env.local`
2. ✅ Moved hardcoded passwords to environment variables
3. ✅ Fixed XSS vulnerability in notice popup
4. ✅ Added authentication to summarize/categorize APIs
5. ✅ Sanitized search inputs to prevent SQL injection

**Authentication:**
- SHA256 password hashing (⚠️ TODO: Upgrade to bcrypt/argon2)
- Session tokens stored in HTTP-only cookies
- Master password now from `process.env.MASTER_PASSWORD` (disable in production)
- Admin cheat code now from `process.env.ADMIN_CHEAT_CODE` (disable in production)

**Data Protection:**
- All API routes require authentication
- Role-based access control enforced at API level
- Audit logs track all sensitive operations
- Prohibited content filtering prevents data leaks
- XSS protection: HTML content sanitized

**API Security:**
- No CORS restrictions (internal system)
- ⚠️ Rate limiting: Not implemented (HIGH PRIORITY - see SECURITY.md)
- Input validation: Minimal (⚠️ TODO: Add Zod validation)
- SQL injection: Search inputs sanitized, Supabase provides parameterized queries
- ⚠️ Webhook authentication: Not implemented (HIGH PRIORITY)

**Environment Variables:**
- Never commit `.env.local` to git (already in `.gitignore`)
- Service role key grants full database access - keep secret
- OpenAI API key has billing implications - monitor usage
- **⚠️ If keys were exposed, revoke immediately from platforms:**
  - OpenAI: https://platform.openai.com/api-keys
  - Supabase: https://supabase.com/dashboard

**Emergency Access (Development Only):**
```bash
# Set in .env.local for development
MASTER_PASSWORD=your_dev_password
ADMIN_CHEAT_CODE=your_dev_code

# Leave empty in production for security
MASTER_PASSWORD=
ADMIN_CHEAT_CODE=
```

## Code Style Notes

- TypeScript strict mode is **disabled** - `any` types are allowed
- Prefer explicit typing but don't spend too much time on it
- Tailwind CSS for all styling - avoid custom CSS
- Radix UI for interactive components
- Korean language for UI text
- English for code comments and variable names
- Always handle errors with try-catch in API routes
- Always check authentication before data operations
- Use `gpt-4o` for vision/OCR tasks, `gpt-4o-mini` for text-only tasks
- Implement manual rollback for transaction-like operations (Supabase doesn't support transactions in JS client)
- Low temperature (0.1-0.3) for accuracy-critical AI tasks, higher (0.7-0.8) for creative content
- Console.log is fine for debugging - this is an internal system
- Keep functions focused and single-purpose
- Extract repeated logic into utility functions in `src/lib/`

---

## Quick Reference

**Most Common Tasks:**

```bash
# Start development
npm run dev

# Create new API route
# 1. Create file: src/app/api/feature/route.ts
# 2. Add auth check, permission check, business logic
# 3. Return { success, data } or { error }

# Create new page
# 1. Create: src/app/dashboard/feature/page.tsx (server component)
# 2. Create: src/app/dashboard/feature/feature-client.tsx (client component)
# 3. Add to navigation if needed

# Check for type errors
npx tsc --noEmit

# Fix build issues
rm -rf .next
npm run build
```

**Critical Files:**

| File | Purpose |
|------|---------|
| `src/middleware.ts` | Authentication guard for all routes |
| `src/lib/permissions.ts` | Role hierarchy and permission checks |
| `src/lib/supabase/server.ts` | Server-side Supabase client |
| `src/lib/supabase/client.ts` | Client-side Supabase client |
| `src/lib/content-filter.ts` | Prohibited content detection |
| `src/types/index.ts` | All TypeScript type definitions |
| `src/app/api/auth/login/route.ts` | Login with 4 auth methods |
| `src/app/api/ocr/route.ts` | OCR pipeline with GPT-4o |
| `src/app/api/tickets/create/route.ts` | Ticket creation with AI summary |
| `src/app/api/closing/approve/route.ts` | Daily closing workflow |

**Emergency Credentials:**

| Type | Value | Purpose |
|------|-------|---------|
| Master Password | `master2026exit` | Bypass all checks, auto-approve |
| Admin Cheat | `exitadmin2026` | Grant admin role to any account |

**Key URLs:**

| URL | Purpose |
|-----|---------|
| `/` | Login page |
| `/dashboard` | Main dashboard (role-based) |
| `/dashboard/qa` | Unified task processing (4 tabs) |
| `/dashboard/intake` | Letter intake and OCR |
| `/dashboard/closing` | Daily closing operations |
| `/mobile` | Mobile interface |

**Common Errors & Fixes:**

| Error | Solution |
|-------|----------|
| "Unauthorized" | Check auth cookie, verify `is_approved: true` |
| "Forbidden" | Check user role, verify minimum role requirement |
| "Service Role Key not set" | Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` |
| "OCR failed" | Check OpenAI API key, verify image < 10MB |
| Build fails | Clear `.next`, delete `node_modules`, run `npm ci` |

**Useful Supabase Queries:**

```sql
-- Find user by username
SELECT * FROM users WHERE username = 'username';

-- Check unclosed tasks
SELECT COUNT(*) FROM tasks WHERE status != 'closed';

-- Customer points summary
SELECT name, total_point_general + total_point_betting AS total_points
FROM customers
ORDER BY total_points DESC
LIMIT 10;
```

**API Testing:**

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"master2026exit"}'

# OCR (image URL)
curl -X POST http://localhost:3000/api/ocr \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=..." \
  -d '{"imageUrl":"https://...", "detectProhibited":true}'
```

**Key Contacts & Resources:**

- Supabase Dashboard: `https://supabase.com/dashboard`
- OpenAI API Dashboard: `https://platform.openai.com`
- Last Order Requirements: `src/app/dashboard/intake/last_order.md`
- Git Repository: Check remote with `git remote -v`

---

## Final Notes

This is a **production system** managing sensitive inmate correspondence and financial transactions. When making changes:

1. **Always test locally first** with `npm run dev`
2. **Check audit logs** after changes to sensitive operations
3. **Verify permissions** work correctly for all role levels
4. **Test the entire workflow** from letter intake to daily closing
5. **Monitor OpenAI API costs** - GPT-4o is expensive
6. **Keep security in mind** - this data is highly sensitive
7. **Document new features** in this file for future Claude instances

**When in doubt, ask the user before making irreversible changes.**
