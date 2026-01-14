# 데이터베이스 업데이트 체크리스트

## 🚨 긴급: 반드시 실행해야 할 작업

방금 완료한 작업들 중 **데이터베이스 스키마 업데이트가 필요한 기능**들이 있습니다.

---

## 📋 실행해야 할 SQL 파일 목록

### 1. ✅ 필수: 전체 스키마 마이그레이션
**파일**: `ALL_MIGRATIONS.sql` (통합 버전 - 최신!)

이 파일에는 다음이 모두 포함되어 있습니다:
- **STEP 13: 사용자 인증 시스템 업데이트** ⭐ 새로 추가됨!
  - `users.is_approved` 컬럼 추가 (계정 승인 기능)
  - `users.last_login` 컬럼 추가 (마지막 로그인 시간)
  - `audit_logs` 테이블 구조 표준화 (table_name, record_id, changes)

기존 테이블들:
- `work_reports` - 업무보고 기능 (출퇴근/소모품/경비)
- `system_config` - 시스템 설정 (변수 조정)
- `returns` - 반송 처리
- `dormant_points` - 휴면 포인트
- `audit_logs` - 감사 로그
- `inventory_items` - 소모품 재고
- `customer_flags` - 블랙리스트
- `inmates` - 수용자 관리
- `prison_restrictions` - 교도소 제한사항
- 기타 필요한 모든 테이블

---

## 🔧 실행 방법

### 방법 1: Supabase 대시보드에서 실행 (권장)

1. **Supabase 대시보드** 접속
   - https://supabase.com

2. **프로젝트 선택** 후 **SQL Editor** 클릭

3. **New Query** 클릭

4. `ALL_MIGRATIONS.sql` 파일 내용을 **복사해서 붙여넣기**

5. **Run** 버튼 클릭 (또는 Ctrl + Enter)

6. 성공 메시지 확인:
   ```
   Success. No rows returned
   ```

---

### 방법 2: psql 커맨드라인 사용

```bash
psql -h [your-supabase-host] -U postgres -d postgres -f ALL_MIGRATIONS.sql
```

또는 개별 파일만 실행하려면:
```bash
psql -h [your-supabase-host] -U postgres -d postgres -f schema_migration_users_auth.sql
```

---

## ✅ 확인 방법

SQL 실행 후 다음 쿼리로 테이블이 생성되었는지 확인:

```sql
-- 테이블 목록 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 필수 테이블 및 컬럼 확인
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_reports')
    THEN '✅ work_reports 존재'
    ELSE '❌ work_reports 없음'
  END as work_reports,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs')
    THEN '✅ audit_logs 존재'
    ELSE '❌ audit_logs 없음'
  END as audit_logs,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_approved')
    THEN '✅ users.is_approved 존재'
    ELSE '❌ users.is_approved 없음'
  END as users_is_approved,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_login')
    THEN '✅ users.last_login 존재'
    ELSE '❌ users.last_login 없음'
  END as users_last_login;
```

---

## 🔍 작업별 필요한 테이블

| 기능 | 필요한 테이블/컬럼 | 파일 |
|------|---------------|------|
| **직원 관리/승인** ⭐ | `users.is_approved`, `users.last_login` | ALL_MIGRATIONS.sql (STEP 13) |
| **감사 로그** ⭐ | `audit_logs` (table_name, record_id, changes) | ALL_MIGRATIONS.sql (STEP 13) |
| 업무보고 | `work_reports` | ALL_MIGRATIONS.sql |
| 시스템 설정 | `system_config` | ALL_MIGRATIONS.sql |
| 반송 처리 | `returns` | ALL_MIGRATIONS.sql |
| 휴면 포인트 | `dormant_points` | ALL_MIGRATIONS.sql |
| 소모품 재고 | `inventory_items`, `inventory_transactions` | ALL_MIGRATIONS.sql |
| 블랙리스트 | `customer_flags` | ALL_MIGRATIONS.sql |
| 포인트 부채 | `customers` (기존 테이블) | - |

---

## 🚀 실행 후 할 일

### 1. 개발 서버 시작
```bash
npm run dev
```

### 2. 기능 테스트
- [ ] 업무보고: http://localhost:3000/dashboard (위젯 확인)
- [ ] 업무관리: http://localhost:3000/dashboard/operations
- [ ] 포인트관리: http://localhost:3000/dashboard/points-management
- [ ] 시스템 설정: http://localhost:3000/dashboard/settings
- [ ] 직원 관리: http://localhost:3000/dashboard/settings (직원 관리 탭)
- [ ] 모바일 UI: http://localhost:3000/mobile

### 3. 오류 확인
브라우저 콘솔(F12)에서 오류 메시지 확인:
- 테이블 없음 오류: 스키마 마이그레이션 재실행
- API 오류: 네트워크 탭에서 상세 확인

---

## ⚠️ 주의사항

1. **백업 먼저**: 프로덕션 데이터베이스라면 반드시 백업 먼저!
   ```sql
   -- Supabase에서 자동 백업되지만, 확인 권장
   ```

2. **순서 중요**: `ALL_MIGRATIONS.sql`이 모든 마이그레이션을 포함하므로 이것만 실행하면 됩니다.

   또는 특정 기능만 업데이트하려면:
   - 직원 관리/승인 기능만: `schema_migration_users_auth.sql`
   - 업무보고 기능만: `schema_migration_work_reports.sql`

3. **중복 실행 안전**: SQL 파일에 `IF NOT EXISTS` 구문이 있어서 여러 번 실행해도 안전합니다.

4. **RLS 정책**: Row Level Security 정책도 자동으로 생성됩니다.

---

## 🐛 문제 해결

### 문제 1: "relation does not exist" 오류
**해결**: 해당 테이블이 생성되지 않음. SQL 파일 재실행

### 문제 2: "permission denied" 오류
**해결**: Supabase 대시보드의 postgres 사용자로 실행

### 문제 3: "duplicate key value" 오류
**해결**: 테이블에 이미 데이터가 있음. 정상 동작

---

## 📞 도움이 필요하면

1. Supabase SQL Editor에서 오류 메시지 확인
2. 브라우저 개발자 도구(F12) 콘솔 확인
3. `ALL_MIGRATIONS.sql` 파일 내용 확인

### 문제 4: 직원 계정 로그인이 안 됨
**해결**: `users.is_approved` 컬럼이 false일 수 있음. SQL로 승인:
```sql
UPDATE users SET is_approved = true WHERE username = 'your_username';
```

---

## ✨ 완료 확인

모든 기능이 정상 작동하면:
- ✅ 업무보고 위젯에서 출퇴근 가능
- ✅ 업무관리 탭에서 모든 메뉴 접근
- ✅ 시스템 설정에서 변수 조정 가능
- ✅ 직원 관리에서 계정 생성 가능
- ✅ 모바일 UI 정상 작동

**모든 준비 완료! 🎉**
