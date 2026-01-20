# 🔒 RLS (Row Level Security) 정책 오류 해결 가이드

## 🚨 발생한 오류

### 1. **406 오류** - returns 테이블
```
Failed to load resource: the server responded with a status of 406
```
→ RLS 정책이 SELECT를 차단

### 2. **400 오류** - Storage 업로드
```
Failed to load resource: the server responded with a status of 400
```
→ Storage 버킷의 정책이 업로드를 차단

### 3. **RLS 정책 위반**
```
StorageApiError: new row violates row-level security policy
```
→ INSERT 시 정책을 통과하지 못함

---

## ✅ 해결 방법

### 1단계: Supabase SQL Editor 열기

1. **Supabase Dashboard** 접속
2. 좌측 메뉴에서 **SQL Editor** 클릭
3. **New Query** 버튼 클릭

### 2단계: 수정 스크립트 실행

**파일:** `fix_rls_policies.sql`

```sql
-- 스크립트 전체 복사 → 붙여넣기 → RUN 버튼 클릭
```

**수정되는 항목:**
- ✅ `returns` 테이블 - 모든 CRUD 허용
- ✅ `task_items` 테이블 - 모든 CRUD 허용
- ✅ `tasks` 테이블 - 모든 CRUD 허용
- ✅ `customers` 테이블 - 모든 CRUD 허용
- ✅ `sports_matches` 테이블 - 모든 CRUD 허용
- ✅ `odds_history` 테이블 - 모든 CRUD 허용
- ✅ `team_mapping` 테이블 - 모든 CRUD 허용
- ✅ Storage `letters` 버킷 - Public 접근 허용

### 3단계: 확인

**SQL Editor에서 확인:**
```sql
-- RLS 정책 목록 조회
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

**예상 결과:**
```
tablename      | policyname              | cmd
---------------|-------------------------|--------
returns        | returns_read_all        | SELECT
returns        | returns_insert_all      | INSERT
sports_matches | 경기 조회 허용          | SELECT
sports_matches | 경기 수정 허용          | ALL
```

---

## 🔍 개별 오류 해결

### 오류 1: returns 테이블 (406)

**증상:**
```javascript
Failed to load resource: 406
/rest/v1/returns?select=return_reason...
```

**원인:**
```sql
-- 기존 정책이 너무 엄격함
CREATE POLICY "returns_read" ON returns
  FOR SELECT USING (auth.uid() = created_by);  -- ❌ 로그인 필수
```

**해결:**
```sql
-- 모든 접근 허용
CREATE POLICY "returns_read_all" ON returns
  FOR SELECT USING (true);  -- ✅ 모두 허용
```

---

### 오류 2: Storage 업로드 (400)

**증상:**
```javascript
StorageApiError: new row violates row-level security policy
```

**원인:**
- Storage 버킷이 private로 설정됨
- 업로드 정책이 없음

**해결 (Supabase Dashboard):**

#### 방법 1: SQL로 해결
```sql
-- letters 버킷을 public으로 변경
UPDATE storage.buckets
SET public = true
WHERE id = 'letters';

-- 정책 추가
CREATE POLICY "letters_insert_all" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'letters');
```

#### 방법 2: UI로 해결
1. **Storage** 메뉴 클릭
2. **letters** 버킷 선택
3. **Settings** → **Public bucket** 체크
4. **Policies** 탭 → **New Policy** 클릭
5. **For full customization** 선택
6. Policy name: `Allow all uploads`
7. Policy definition:
```sql
bucket_id = 'letters'
```
8. **Save** 클릭

---

### 오류 3: task_items 삽입 실패

**증상:**
```javascript
Error: new row violates row-level security policy for table "task_items"
```

**해결:**
```sql
-- task_items 정책 완화
CREATE POLICY "task_items_write_all" ON task_items
  FOR ALL USING (true);
```

---

## 🛡️ 프로덕션 환경용 정책 (추후 적용)

개발이 완료되면 더 엄격한 정책으로 변경하세요:

### 1. 인증된 사용자만 허용
```sql
CREATE POLICY "authenticated_only" ON returns
  FOR ALL USING (auth.role() = 'authenticated');
```

### 2. 본인 데이터만 접근
```sql
CREATE POLICY "own_data_only" ON task_items
  FOR SELECT USING (auth.uid() = created_by);
```

### 3. Storage는 인증된 사용자만
```sql
CREATE POLICY "authenticated_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'letters' 
    AND auth.role() = 'authenticated'
  );
```

---

## 🔧 추가 문제 해결

### Storage 버킷이 없는 경우

```sql
-- letters 버킷 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('letters', 'letters', true)
ON CONFLICT (id) DO NOTHING;
```

### RLS를 완전히 비활성화 (개발 중에만)

```sql
-- 특정 테이블의 RLS 비활성화
ALTER TABLE returns DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;

-- ⚠️ 주의: 프로덕션에서는 절대 사용하지 마세요!
```

### RLS 다시 활성화

```sql
-- 다시 활성화
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
```

---

## ✅ 테스트

### 1. returns 테이블 조회
```sql
SELECT * FROM returns LIMIT 5;
```

### 2. Storage 업로드 테스트
```javascript
// 브라우저 콘솔에서 테스트
const { data, error } = await supabase.storage
  .from('letters')
  .upload('test.txt', new Blob(['test'], { type: 'text/plain' }));

console.log(data, error);
```

### 3. task_items 삽입 테스트
```sql
INSERT INTO task_items (task_id, item_name, amount)
VALUES ('test-id', 'test-item', 1000);
```

---

## 📋 체크리스트

```
□ fix_rls_policies.sql 실행 완료?
□ 오류 메시지 사라짐?
□ returns 테이블 조회 가능?
□ Storage 업로드 가능?
□ 브라우저 콘솔에서 오류 없음?
```

---

## 🎯 요약

**문제:**
- Supabase RLS 정책이 너무 엄격함
- 개발 환경에서 접근이 차단됨

**해결:**
1. `fix_rls_policies.sql` 실행
2. 모든 테이블과 Storage 버킷에 접근 허용
3. 브라우저 새로고침 (F5)

**프로덕션:**
- 배포 전에 더 엄격한 정책으로 변경
- 인증된 사용자만 접근 허용
- 본인 데이터만 조회/수정 가능하게 제한

---

**이제 406, 400 오류가 모두 해결될 것입니다!** ✅
