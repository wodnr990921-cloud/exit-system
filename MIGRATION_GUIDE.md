# 데이터베이스 마이그레이션 가이드

이 문서는 데이터베이스 스키마 마이그레이션 파일들의 실행 순서와 의존성을 설명합니다.

## 마이그레이션 파일 목록

1. `schema.sql` - 기본 스키마 (최초 설치 시 실행)
2. `schema_migration_cart.sql` - 장바구니 시스템 (tasks, task_items 테이블)
3. `schema_migration_logistics.sql` - 물류 시스템
4. `schema_migration_logistics_inventory.sql` - 물류 재고 시스템
5. `schema_migration_sports.sql` - 스포츠 배팅 시스템
6. `schema_migration_games.sql` - 경기 관리 시스템
7. `schema_migration_finance.sql` - 재무 관리 시스템
8. `schema_migration_notifications.sql` - 알림 시스템
9. `schema_migration_notices.sql` - 공지사항 시스템
10. `schema_migration_comments.sql` - 댓글 타입 시스템
11. `schema_migration_closing.sql` - 일일 마감 시스템

## 실행 순서

### 1단계: 기본 스키마 설치
```sql
-- schema.sql 실행
-- 기본 테이블, RPC 함수, 트리거 생성
```

### 2단계: 핵심 기능 마이그레이션
```sql
-- schema_migration_cart.sql 실행
-- tasks, task_items 테이블 생성 (장바구니 시스템)
```

### 3단계: 도메인별 기능 마이그레이션 (순서 무관)
```sql
-- schema_migration_logistics.sql 실행
-- 물류 관련 테이블 (books, senders 등)
```

```sql
-- schema_migration_logistics_inventory.sql 실행
-- 물류 재고 관리 (logistics_inventory 테이블)
```

```sql
-- schema_migration_sports.sql 실행
-- 스포츠 배팅 시스템 (task_items에 details JSON 컬럼 추가)
```

```sql
-- schema_migration_games.sql 실행
-- 경기 관리 (games 테이블, task_items에 game_id FK 추가)
```

```sql
-- schema_migration_finance.sql 실행
-- 재무 관리 (points 테이블에 task_item_id 컬럼 추가)
```

### 4단계: 알림 및 통신 시스템
```sql
-- schema_migration_notifications.sql 실행
-- customer_notifications 테이블, customers에 mailbox_address 추가
```

```sql
-- schema_migration_notices.sql 실행
-- notices 테이블 (공지사항)
```

```sql
-- schema_migration_comments.sql 실행
-- task_comments에 comment_type 컬럼 추가
```

```sql
-- schema_migration_closing.sql 실행
-- tasks 테이블에 reply_content, closed_at, closed_by 컬럼 추가
-- task_items 테이블에 procurement_status, sender_name 컬럼 추가
-- games 테이블에 is_verified 컬럼 추가
```

## 의존성 체인

```
schema.sql
  └─> schema_migration_cart.sql
        ├─> schema_migration_logistics.sql
        ├─> schema_migration_sports.sql
        │     └─> schema_migration_games.sql
        ├─> schema_migration_finance.sql
        ├─> schema_migration_notifications.sql
        ├─> schema_migration_notices.sql
        ├─> schema_migration_comments.sql
        └─> schema_migration_closing.sql
```

## 중요 참고사항

1. **schema.sql은 반드시 먼저 실행**되어야 합니다.
2. **schema_migration_cart.sql은 다른 마이그레이션보다 먼저** 실행되어야 합니다 (tasks, task_items 테이블이 다른 마이그레이션에서 참조됨).
3. **나머지 마이그레이션들은 순서가 크게 중요하지 않지만**, 위 순서를 따르는 것을 권장합니다.
4. 모든 마이그레이션 파일은 **멱등성(idempotent)**을 고려하여 작성되었습니다 (`IF NOT EXISTS`, `DO $$ BEGIN ... END $$` 사용).
5. 마이그레이션 실행 후 오류가 발생하면, 해당 마이그레이션의 내용을 확인하고 수동으로 수정할 수 있습니다.

## 새 마이그레이션 추가 시

새 마이그레이션 파일을 추가할 때:
1. 파일명 형식: `schema_migration_<기능명>.sql`
2. `IF NOT EXISTS` 또는 `DO $$ BEGIN ... END $$` 블록을 사용하여 멱등성 보장
3. 이 문서에 새로운 마이그레이션 정보 추가
4. 의존성 관계 명시

## 롤백

현재 마이그레이션 파일들은 **롤백 스크립트를 포함하지 않습니다**. 
롤백이 필요한 경우:
1. Supabase Dashboard의 데이터베이스 백업 사용
2. 또는 수동으로 ALTER TABLE/DROP TABLE 문 실행
