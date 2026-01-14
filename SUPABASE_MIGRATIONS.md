# Supabase 마이그레이션 가이드

일어나셨을 때 Supabase SQL 편집기에서 다음 마이그레이션 스크립트들을 **순서대로** 실행해주세요.

## 1. 기본 Closing 마이그레이션
파일: `schema_migration_closing.sql`

이 마이그레이션은 일일 마감 시스템을 위한 기본 컬럼들을 추가합니다:
- tasks 테이블: reply_content, closed_at, closed_by
- task_items 테이블: procurement_status, sender_name
- games 테이블: is_verified

```sql
-- schema_migration_closing.sql 파일 전체 내용을 복사하여 실행
```

## 2. Tasks 테이블 향상 마이그레이션
파일: `schema_migration_tasks_enhanced.sql`

이 마이그레이션은 우편실 연동 및 티켓 관리를 위한 추가 컬럼들을 추가합니다:
- member_id: 회원 ID (customer_id 별칭)
- ticket_no: 티켓 고유 번호 (자동 생성)
- ai_summary: AI 티켓 요약
- total_amount: 총 금액
- letter_id: 원본 편지 참조
- assignee_id: 담당 직원 (assigned_to 별칭)
- processed_at: 처리 완료 시각

**중요**: 이 마이그레이션은 자동으로 티켓 번호 생성 함수와 트리거도 생성합니다.

```sql
-- schema_migration_tasks_enhanced.sql 파일 전체 내용을 복사하여 실행
```

## 3. Cart/Task Items 마이그레이션
파일: `schema_migration_cart.sql`

이 마이그레이션은 티켓 내 아이템(장바구니) 관리를 위한 테이블을 생성합니다:
- task_items 테이블 생성 (도서, 경기, 물품 등)

```sql
-- schema_migration_cart.sql 파일 전체 내용을 복사하여 실행
```

## 실행 순서

1. Supabase 대시보드 로그인
2. SQL Editor 열기
3. `schema_migration_cart.sql` 전체 복사 → 붙여넣기 → 실행
4. `schema_migration_closing.sql` 전체 복사 → 붙여넣기 → 실행
5. `schema_migration_tasks_enhanced.sql` 전체 복사 → 붙여넣기 → 실행

## 마이그레이션 후 확인사항

다음 쿼리로 컬럼들이 제대로 추가되었는지 확인하세요:

```sql
-- tasks 테이블 컬럼 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tasks'
ORDER BY column_name;

-- ticket_no 자동 생성 함수 확인
SELECT generate_ticket_no();

-- 기존 티켓에 ticket_no가 부여되었는지 확인
SELECT id, ticket_no, created_at
FROM tasks
ORDER BY created_at DESC
LIMIT 10;
```

## 문제 발생 시

만약 마이그레이션 중 오류가 발생하면:
1. 오류 메시지를 확인
2. 이미 컬럼이 존재하는 경우 → 정상 (DO $$ 블록이 자동으로 처리)
3. 다른 오류 → 오류 메시지와 함께 문의

## 새로 추가된 기능

마이그레이션 후 다음 기능들이 활성화됩니다:

### 1. 우편실 (Mailroom) 기능
- URL: `/dashboard/mailroom`
- 업로드된 편지 검수
- OCR 결과 확인 및 수정
- 회원 매칭
- 직원에게 티켓 배당

### 2. 일일 마감 (Closing) 기능 (개선됨)
- URL: `/dashboard/closing`
- GPT-4o-mini 답장 자동 생성
- 마감 승인 및 자금 동결
- 답장 내용 수정 가능

### 3. 일괄 출력 (Batch Print) 기능
- URL: `/dashboard/closing/print`
- A4 답장 편지 일괄 출력
- 선택한 티켓만 출력 가능

## 워크플로우

```
우편 업로드 (OCR) → 우편실 (검수/배당) → 업무 처리 (Reception/Intake) → 일일 마감 (Closing) → 일괄 출력 (Print)
```

1. `/dashboard/ocr` - 편지 이미지 업로드 및 OCR
2. `/dashboard/mailroom` - 편지 검수 및 직원 배당
3. `/dashboard/intake` - 배당된 티켓 확인 및 처리
4. `/dashboard/closing` - 처리 완료된 티켓 마감 및 답장 생성
5. `/dashboard/closing/print` - 마감된 티켓 답장 일괄 출력
