# 📮 우편실 편지 업로드 오류 해결 가이드

## 🚨 문제

```
❌ 편지 사진 업로드 시 실패
❌ "StorageApiError: new row violates row-level security policy" 오류
```

---

## ✅ 해결 방법

### 1단계: Supabase SQL Editor에서 실행

**Supabase Dashboard:**
```
1. https://supabase.com/dashboard/project/ijokjxmzyvonjpiosffu
2. 왼쪽 메뉴 → "SQL Editor" 클릭
3. "New query" 클릭
4. fix_storage_upload.sql 내용을 복사 → 붙여넣기
5. "Run" 버튼 클릭 (Ctrl+Enter)
6. ✅ "Storage 업로드 설정 완료!" 메시지 확인
```

---

### 2단계: Storage 버킷 확인

**Supabase Dashboard:**
```
1. 왼쪽 메뉴 → "Storage" 클릭
2. "letters" 버킷 확인
```

**버킷이 없으면 생성:**
```
1. "Create bucket" 클릭
2. 입력:
   - Name: letters
   - Public bucket: ✅ 체크
   - File size limit: 10 MB
   - Allowed MIME types: image/* (또는 비워두기)
3. "Create bucket" 클릭
```

---

### 3단계: 테스트

**우편실 화면에서:**
```
1. 편지 사진 업로드 시도
2. F12 → Console 탭 확인
3. 오류가 사라졌는지 확인
```

---

## 🔍 문제가 계속되면

### 브라우저 콘솔 확인

```javascript
// F12 → Console 탭에서 오류 메시지 확인
// 예:
// ❌ StorageApiError: new row violates row-level security policy
// ❌ 403 Forbidden
// ❌ Policy violation
```

### Supabase 로그 확인

```
1. Supabase Dashboard → "Logs" 클릭
2. "Postgrest" 로그 확인
3. 최근 오류 메시지 찾기
```

### letters 테이블 정책 확인

**SQL Editor에서 실행:**
```sql
-- 현재 정책 확인
SELECT 
  policyname,
  cmd,
  permissive,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'letters';

-- Storage 정책 확인
SELECT 
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE '%letters%';
```

---

## 📋 수동 정책 설정 (대안)

SQL이 작동하지 않으면 **Supabase Dashboard에서 직접 설정:**

### letters 테이블 정책

```
1. Supabase Dashboard → "Authentication" → "Policies"
2. "letters" 테이블 찾기
3. 모든 정책 삭제
4. "New policy" 클릭:
   - Policy name: letters_all_access
   - Allowed operation: ALL
   - Target roles: public
   - USING expression: true
   - WITH CHECK expression: true
5. "Save policy" 클릭
```

### Storage 정책

```
1. Supabase Dashboard → "Storage" → "letters" 버킷 클릭
2. "Policies" 탭
3. 모든 정책 삭제
4. "New policy" 클릭 (4개):

   Policy 1 - Read:
   - Policy name: letters_public_read
   - Allowed operation: SELECT
   - Target roles: public
   - Policy definition: bucket_id = 'letters'

   Policy 2 - Insert:
   - Policy name: letters_public_insert
   - Allowed operation: INSERT
   - Target roles: public
   - Policy definition: bucket_id = 'letters'

   Policy 3 - Update:
   - Policy name: letters_public_update
   - Allowed operation: UPDATE
   - Target roles: public
   - Policy definition: bucket_id = 'letters'

   Policy 4 - Delete:
   - Policy name: letters_public_delete
   - Allowed operation: DELETE
   - Target roles: public
   - Policy definition: bucket_id = 'letters'
```

---

## ⚠️ 보안 주의사항

**현재 설정:** 개발 환경용 (모든 접근 허용)

**프로덕션 환경에서는:**
```sql
-- 인증된 사용자만 업로드
CREATE POLICY "letters_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'letters');

-- 본인이 업로드한 파일만 수정/삭제
CREATE POLICY "letters_owner_only"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'letters' AND 
  owner = auth.uid()
);
```

---

## 🎉 해결 확인

**업로드가 성공하면:**
```
✅ "업로드 완료" 토스트 메시지
✅ 편지 목록에 새 편지 표시
✅ Console에 오류 없음
```

---

## 📞 추가 지원

문제가 계속되면:
1. 브라우저 Console 오류 메시지 캡처
2. Supabase Logs 확인
3. SQL 실행 결과 공유
