-- =========================================
-- Storage 업로드 오류 해결
-- =========================================
-- 문제: 편지 사진 업로드 시 RLS 정책 위반
-- 해결: letters 버킷의 RLS 정책을 완화

-- =========================================
-- PART 1: letters 테이블 RLS 정책 확인/수정
-- =========================================

-- letters 테이블이 있는지 확인
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'letters') THEN
    RAISE NOTICE '❌ letters 테이블이 없습니다. 먼저 테이블을 생성하세요.';
  ELSE
    RAISE NOTICE '✅ letters 테이블이 존재합니다.';
  END IF;
END $$;

-- letters 테이블 RLS 활성화 및 정책 설정
ALTER TABLE IF EXISTS letters ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "letters_read_all" ON letters;
DROP POLICY IF EXISTS "letters_insert_authenticated" ON letters;
DROP POLICY IF EXISTS "letters_update_authenticated" ON letters;
DROP POLICY IF EXISTS "letters_delete_authenticated" ON letters;

-- 새 정책 생성 (개발 환경용 - 모든 접근 허용)
CREATE POLICY "letters_read_all" ON letters
  FOR SELECT USING (true);

CREATE POLICY "letters_insert_all" ON letters
  FOR INSERT WITH CHECK (true);

CREATE POLICY "letters_update_all" ON letters
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "letters_delete_all" ON letters
  FOR DELETE USING (true);

-- =========================================
-- PART 2: Storage 버킷 RLS 정책 설정
-- =========================================

-- letters 버킷의 모든 기존 정책 삭제
DROP POLICY IF EXISTS "letters_bucket_read" ON storage.objects;
DROP POLICY IF EXISTS "letters_bucket_insert" ON storage.objects;
DROP POLICY IF EXISTS "letters_bucket_update" ON storage.objects;
DROP POLICY IF EXISTS "letters_bucket_delete" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload letters" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view letters" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload letters" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for letters" ON storage.objects;

-- 새 정책 생성 (모든 사용자 업로드/읽기 가능)
CREATE POLICY "letters_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'letters');

CREATE POLICY "letters_public_insert"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'letters');

CREATE POLICY "letters_public_update"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'letters')
WITH CHECK (bucket_id = 'letters');

CREATE POLICY "letters_public_delete"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'letters');

-- =========================================
-- PART 3: letters 버킷이 public인지 확인
-- =========================================

-- letters 버킷을 public으로 설정
UPDATE storage.buckets
SET public = true
WHERE id = 'letters';

-- =========================================
-- PART 4: 확인
-- =========================================

-- 테이블 정책 확인
SELECT 
  'letters 테이블 정책' as category,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'letters';

-- Storage 버킷 확인
SELECT 
  'Storage 버킷' as category,
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'letters';

-- Storage 정책 확인
SELECT 
  'Storage 정책' as category,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE '%letters%';

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Storage 업로드 설정 완료!';
  RAISE NOTICE '';
  RAISE NOTICE '변경 사항:';
  RAISE NOTICE '  1. letters 테이블 RLS 정책: 모든 작업 허용';
  RAISE NOTICE '  2. letters Storage 버킷: public 설정';
  RAISE NOTICE '  3. Storage 객체 정책: 모든 사용자 업로드/읽기 가능';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  프로덕션 환경에서는 더 엄격한 정책을 사용하세요!';
  RAISE NOTICE '';
END $$;
