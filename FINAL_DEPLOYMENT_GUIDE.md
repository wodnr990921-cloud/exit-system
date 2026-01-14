# 🚀 최종 배포 가이드 - 일일 마감 시스템

## ⚠️ 배포 전 필수 체크리스트

- [ ] Node.js 18 이상 설치 확인
- [ ] Supabase 프로젝트 생성 완료
- [ ] `.env.local` 파일 설정 완료
- [ ] OpenAI API Key 발급 완료

---

## 📦 1. 데이터베이스 마이그레이션 (필수!)

Supabase 대시보드 → SQL Editor에서 **다음 순서대로** 실행하세요:

### 1.1 Cart/Task Items 테이블 생성
```sql
-- schema_migration_cart.sql 파일 전체 내용 복사 후 실행
```

### 1.2 Closing 시스템 컬럼 추가
```sql
-- schema_migration_closing.sql 파일 전체 내용 복사 후 실행
```

### 1.3 Tasks 테이블 향상 (티켓 번호 자동 생성 포함)
```sql
-- schema_migration_tasks_enhanced.sql 파일 전체 내용 복사 후 실행
```

---

## 🔧 2. 환경 변수 설정

`.env.local` 파일을 프로젝트 루트에 생성하고 다음 내용을 입력하세요:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# OpenAI (GPT-4o-mini 사용)
OPENAI_API_KEY=sk-your-openai-key
```

---

## 📋 3. 마이그레이션 SQL 스크립트 상세

### 3.1 `schema_migration_cart.sql`
이 스크립트는 task_items 테이블을 생성합니다.

```sql
-- Task Items 테이블 (티켓 내 아이템)
CREATE TABLE IF NOT EXISTS task_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  amount INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_task_items_task_id ON task_items(task_id);
CREATE INDEX IF NOT EXISTS idx_task_items_status ON task_items(status);
CREATE INDEX IF NOT EXISTS idx_task_items_category ON task_items(category);

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_task_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_task_items_updated_at ON task_items;
CREATE TRIGGER update_task_items_updated_at
  BEFORE UPDATE ON task_items
  FOR EACH ROW
  EXECUTE FUNCTION update_task_items_updated_at();
```

### 3.2 `schema_migration_closing.sql`
이 스크립트는 마감 시스템에 필요한 컬럼들을 추가합니다.

```sql
-- tasks 테이블에 마감 관련 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'reply_content'
  ) THEN
    ALTER TABLE tasks ADD COLUMN reply_content TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'closed_at'
  ) THEN
    ALTER TABLE tasks ADD COLUMN closed_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'closed_by'
  ) THEN
    ALTER TABLE tasks ADD COLUMN closed_by UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- task_items 테이블에 발주 관련 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_items' AND column_name = 'procurement_status'
  ) THEN
    ALTER TABLE task_items ADD COLUMN procurement_status VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_items' AND column_name = 'sender_name'
  ) THEN
    ALTER TABLE task_items ADD COLUMN sender_name VARCHAR(255);
  END IF;
END $$;

-- games 테이블에 is_verified 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'is_verified'
  ) THEN
    ALTER TABLE games ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tasks_closed_at ON tasks(closed_at) WHERE closed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_closed_by ON tasks(closed_by) WHERE closed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_items_procurement_status ON task_items(procurement_status) WHERE procurement_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_is_verified ON games(is_verified) WHERE is_verified = TRUE;
```

### 3.3 `schema_migration_tasks_enhanced.sql`
이 스크립트는 티켓 번호 자동 생성 및 우편실 연동을 위한 컬럼을 추가합니다.

```sql
-- Tasks 테이블 향상
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'member_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN member_id UUID REFERENCES customers(id) ON DELETE SET NULL;
    UPDATE tasks SET member_id = customer_id WHERE customer_id IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'ticket_no'
  ) THEN
    ALTER TABLE tasks ADD COLUMN ticket_no VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'ai_summary'
  ) THEN
    ALTER TABLE tasks ADD COLUMN ai_summary TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE tasks ADD COLUMN total_amount INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'letter_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN letter_id UUID REFERENCES letters(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'assignee_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN assignee_id UUID REFERENCES users(id) ON DELETE SET NULL;
    UPDATE tasks SET assignee_id = assigned_to WHERE assigned_to IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'processed_at'
  ) THEN
    ALTER TABLE tasks ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- 티켓 번호 자동 생성 함수
CREATE OR REPLACE FUNCTION generate_ticket_no()
RETURNS TEXT AS $$
DECLARE
  today TEXT;
  seq_num INTEGER;
  ticket_no TEXT;
BEGIN
  today := TO_CHAR(NOW(), 'YYMMDD');

  SELECT COALESCE(MAX(
    CASE
      WHEN ticket_no ~ ('^' || today || '-[0-9]+$')
      THEN CAST(SUBSTRING(ticket_no FROM '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO seq_num
  FROM tasks
  WHERE ticket_no LIKE (today || '-%');

  ticket_no := today || '-' || LPAD(seq_num::TEXT, 4, '0');

  RETURN ticket_no;
END;
$$ LANGUAGE plpgsql;

-- 티켓 생성 시 자동으로 ticket_no 생성 트리거
CREATE OR REPLACE FUNCTION auto_generate_ticket_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_no IS NULL THEN
    NEW.ticket_no := generate_ticket_no();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_generate_ticket_no ON tasks;
CREATE TRIGGER trigger_auto_generate_ticket_no
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_ticket_no();

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tasks_member_id ON tasks(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_ticket_no ON tasks(ticket_no) WHERE ticket_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_letter_id ON tasks(letter_id) WHERE letter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_processed_at ON tasks(processed_at) WHERE processed_at IS NOT NULL;

-- 기존 티켓에 ticket_no 부여
UPDATE tasks
SET ticket_no = generate_ticket_no()
WHERE ticket_no IS NULL;
```

---

## ✅ 4. 마이그레이션 검증

마이그레이션이 제대로 실행되었는지 확인하세요:

```sql
-- 1. tasks 테이블 컬럼 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tasks'
ORDER BY column_name;

-- 2. task_items 테이블 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'task_items'
ORDER BY column_name;

-- 3. 티켓 번호 생성 함수 테스트
SELECT generate_ticket_no();

-- 4. 기존 티켓에 ticket_no가 부여되었는지 확인
SELECT id, ticket_no, created_at
FROM tasks
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🎯 5. 애플리케이션 빌드 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 개발 서버 실행
npm run dev

# 3. 프로덕션 빌드 (배포 전)
npm run build

# 4. 프로덕션 실행
npm start
```

---

## 🔐 6. 권한 설정

### 사용자 Role 종류:
- `ceo`: 최고 관리자 (모든 기능 접근 가능)
- `admin`: 관리자
- `operator`: 오퍼레이터 (검수, 배당, 마감 가능)
- `staff`: 직원 (티켓 처리)
- `employee`: 직원 (staff와 동일)

### 우편실 접근 권한:
- operator, ceo, admin만 접근 가능

### 일일 마감 접근 권한:
- operator, ceo, admin만 접근 가능

---

## 🌐 7. 페이지별 기능

### 7.1 OCR 업로드 (`/dashboard/ocr`)
- 편지 이미지 업로드
- 자동 OCR 처리
- 모든 사용자 접근 가능

### 7.2 우편실 (`/dashboard/mailroom`)
- 업로드된 편지 검수
- 회원 매칭
- 직원에게 티켓 배당
- 티켓 자동 생성
- **권한**: operator, ceo, admin

### 7.3 티켓 목록 (`/dashboard/intake`)
- 전체 티켓 조회
- 티켓 상세 보기
- 모든 사용자 접근 가능

### 7.4 일일 마감 (`/dashboard/closing`)
- 처리 완료된 티켓 조회
- GPT-4o-mini 답장 자동 생성
- 답장 수정 가능
- 마감 승인
- **권한**: operator, ceo, admin

### 7.5 일괄 출력 (`/dashboard/closing/print`)
- 마감된 티켓 선택
- A4 답장 편지 일괄 출력
- **권한**: operator, ceo, admin

---

## 🔥 8. 주요 개선 사항

### ✨ UI/UX 개선
- **Shadcn UI**: 모든 컴포넌트를 Shadcn UI로 통일
- **Lucide Icons**: 직관적인 아이콘 사용
- **로딩 스켈레톤**: 더 나은 로딩 경험
- **에러 처리**: 친절한 에러 메시지
- **반응형 디자인**: 모바일, 태블릿, 데스크톱 지원

### ⚡ 성능 개선
- **이미지 레이지 로딩**: 필요할 때만 로드
- **자동 알림 해제**: 5초 후 자동 사라짐
- **낙관적 업데이트**: 즉각적인 UI 반응

### 🛡️ 안정성 개선
- **폼 검증**: 모든 필수 항목 체크
- **에러 핸들링**: try-catch로 안전하게 처리
- **권한 검증**: 페이지별 권한 체크

---

## 🐛 9. 문제 해결

### 9.1 마이그레이션 오류
```
ERROR: column "xxx" already exists
```
→ 정상입니다. DO $$ 블록이 자동으로 처리합니다.

### 9.2 티켓 번호 미생성
```sql
-- 트리거 확인
SELECT * FROM pg_trigger WHERE tgname = 'trigger_auto_generate_ticket_no';

-- 수동으로 티켓 번호 부여
UPDATE tasks SET ticket_no = generate_ticket_no() WHERE ticket_no IS NULL;
```

### 9.3 OpenAI API 오류
- API Key가 올바른지 확인
- `.env.local` 파일이 프로젝트 루트에 있는지 확인
- 서버 재시작: `npm run dev`

---

## 📊 10. 워크플로우 다이어그램

```
┌─────────────────┐
│  OCR 업로드      │  ← 편지 이미지 업로드 및 OCR 처리
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  우편실 (검수)   │  ← 편지 검수, 회원 매칭, 티켓 생성 및 배당
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  업무 처리       │  ← 배당받은 티켓 처리 (도서, 배팅, 물품 등)
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  일일 마감       │  ← GPT-4o-mini 답장 생성, 마감 승인
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  일괄 출력       │  ← A4 답장 편지 일괄 출력
└─────────────────┘
```

---

## 🎉 11. 배포 완료 후 테스트

### 필수 테스트 시나리오:
1. [ ] 편지 업로드 및 OCR 처리
2. [ ] 우편실에서 편지 검수 및 배당
3. [ ] 티켓 생성 확인 (ticket_no 자동 생성)
4. [ ] 일일 마감에서 답장 자동 생성
5. [ ] 답장 수정 및 마감 승인
6. [ ] 일괄 출력으로 답장 인쇄

---

## 📞 12. 지원

문제가 발생하면 다음을 확인하세요:
1. `SUPABASE_MIGRATIONS.md` - 마이그레이션 가이드
2. `README_UPDATE.md` - 업데이트 내역
3. `FINAL_DEPLOYMENT_GUIDE.md` - 이 문서

---

**작업 완료일**: 2026-01-14
**버전**: 1.0.0
**상태**: 프로덕션 준비 완료 ✅
