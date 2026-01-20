-- Returns 테이블 RLS 정책 수정
-- 406 에러 해결

-- 기존 정책 삭제
DROP POLICY IF EXISTS "returns_select_all" ON returns;
DROP POLICY IF EXISTS "returns_insert_all" ON returns;
DROP POLICY IF EXISTS "returns_update_all" ON returns;
DROP POLICY IF EXISTS "returns_delete_all" ON returns;

-- 새로운 정책 생성 (모든 접근 허용 - 개발용)
CREATE POLICY "returns_select_all" ON returns
  FOR SELECT
  USING (true);

CREATE POLICY "returns_insert_all" ON returns
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "returns_update_all" ON returns
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "returns_delete_all" ON returns
  FOR DELETE
  USING (true);

-- 결과 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'returns'
ORDER BY policyname;

-- 테이블 권한 확인
SELECT 
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'returns'
  AND grantee = 'authenticated';
