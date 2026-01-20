-- =========================================
-- Supabase RLS 정책 수정 스크립트
-- 개발 환경용 (모든 접근 허용)
-- =========================================

-- =========================================
-- PART 1: returns 테이블 RLS 정책
-- =========================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "returns_read_all" ON returns;
DROP POLICY IF EXISTS "returns_write_authenticated" ON returns;

-- 새 정책 생성 (모든 접근 허용)
CREATE POLICY "returns_read_all" ON returns
  FOR SELECT USING (true);

CREATE POLICY "returns_insert_all" ON returns
  FOR INSERT WITH CHECK (true);

CREATE POLICY "returns_update_all" ON returns
  FOR UPDATE USING (true);

CREATE POLICY "returns_delete_all" ON returns
  FOR DELETE USING (true);

-- =========================================
-- PART 2: Storage 버킷 정책 (letters)
-- =========================================

-- letters 버킷이 없으면 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('letters', 'letters', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "letters_read_all" ON storage.objects;
DROP POLICY IF EXISTS "letters_insert_all" ON storage.objects;
DROP POLICY IF EXISTS "letters_update_all" ON storage.objects;
DROP POLICY IF EXISTS "letters_delete_all" ON storage.objects;

-- 새 정책 생성 (모든 접근 허용)
CREATE POLICY "letters_read_all" ON storage.objects
  FOR SELECT USING (bucket_id = 'letters');

CREATE POLICY "letters_insert_all" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'letters');

CREATE POLICY "letters_update_all" ON storage.objects
  FOR UPDATE USING (bucket_id = 'letters');

CREATE POLICY "letters_delete_all" ON storage.objects
  FOR DELETE USING (bucket_id = 'letters');

-- =========================================
-- PART 3: 기타 테이블 RLS 정책 완화
-- =========================================

-- task_items 테이블
DROP POLICY IF EXISTS "task_items_read_all" ON task_items;
DROP POLICY IF EXISTS "task_items_write_all" ON task_items;

CREATE POLICY "task_items_read_all" ON task_items
  FOR SELECT USING (true);

CREATE POLICY "task_items_write_all" ON task_items
  FOR ALL USING (true);

-- tasks 테이블
DROP POLICY IF EXISTS "tasks_read_all" ON tasks;
DROP POLICY IF EXISTS "tasks_write_all" ON tasks;

CREATE POLICY "tasks_read_all" ON tasks
  FOR SELECT USING (true);

CREATE POLICY "tasks_write_all" ON tasks
  FOR ALL USING (true);

-- customers 테이블
DROP POLICY IF EXISTS "customers_read_all" ON customers;
DROP POLICY IF EXISTS "customers_write_all" ON customers;

CREATE POLICY "customers_read_all" ON customers
  FOR SELECT USING (true);

CREATE POLICY "customers_write_all" ON customers
  FOR ALL USING (true);

-- sports_matches 테이블
DROP POLICY IF EXISTS "경기 조회 허용" ON sports_matches;
DROP POLICY IF EXISTS "경기 수정 허용" ON sports_matches;

CREATE POLICY "경기 조회 허용" ON sports_matches
  FOR SELECT USING (true);

CREATE POLICY "경기 수정 허용" ON sports_matches
  FOR ALL USING (true);

-- odds_history 테이블
DROP POLICY IF EXISTS "배당 히스토리 조회 허용" ON odds_history;
DROP POLICY IF EXISTS "배당 히스토리 수정 허용" ON odds_history;

CREATE POLICY "배당 히스토리 조회 허용" ON odds_history
  FOR SELECT USING (true);

CREATE POLICY "배당 히스토리 수정 허용" ON odds_history
  FOR ALL USING (true);

-- team_mapping 테이블
DROP POLICY IF EXISTS "team_mapping_read_all" ON team_mapping;
DROP POLICY IF EXISTS "team_mapping_write_authenticated" ON team_mapping;

CREATE POLICY "team_mapping_read_all" ON team_mapping
  FOR SELECT USING (true);

CREATE POLICY "team_mapping_write_all" ON team_mapping
  FOR ALL USING (true);

-- =========================================
-- PART 4: 확인
-- =========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ RLS 정책 수정 완료!';
  RAISE NOTICE '';
  RAISE NOTICE '변경된 테이블:';
  RAISE NOTICE '  - returns';
  RAISE NOTICE '  - task_items';
  RAISE NOTICE '  - tasks';
  RAISE NOTICE '  - customers';
  RAISE NOTICE '  - sports_matches';
  RAISE NOTICE '  - odds_history';
  RAISE NOTICE '  - team_mapping';
  RAISE NOTICE '';
  RAISE NOTICE '변경된 Storage 버킷:';
  RAISE NOTICE '  - letters (public)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  주의: 프로덕션 환경에서는 더 엄격한 정책을 사용하세요!';
  RAISE NOTICE '';
END $$;

-- 정책 목록 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
