-- =========================================
-- Storage 업로드 오류 해결 (V2)
-- =========================================
-- 기존 정책이 있어도 안전하게 재생성

-- =========================================
-- PART 1: 기존 정책 모두 제거
-- =========================================

DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- letters 테이블의 모든 정책 삭제
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'letters'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON letters', policy_record.policyname);
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
    
    -- Storage 객체의 letters 관련 정책 모두 삭제
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects'
        AND (policyname LIKE '%letters%' OR policyname LIKE '%letter%')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_record.policyname);
        RAISE NOTICE 'Dropped storage policy: %', policy_record.policyname;
    END LOOP;
    
    RAISE NOTICE '✅ 기존 정책 삭제 완료';
END $$;

-- =========================================
-- PART 2: letters 테이블 RLS 정책 설정
-- =========================================

-- RLS 활성화
ALTER TABLE IF EXISTS letters ENABLE ROW LEVEL SECURITY;

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
-- PART 3: Storage 버킷 RLS 정책 설정
-- =========================================

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
-- PART 4: letters 버킷 public 설정
-- =========================================

-- letters 버킷을 public으로 설정
UPDATE storage.buckets
SET public = true
WHERE id = 'letters';

-- =========================================
-- PART 5: 확인
-- =========================================

-- 테이블 정책 확인
DO $$
DECLARE
    policy_count INTEGER;
    storage_policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'letters';
    
    SELECT COUNT(*) INTO storage_policy_count
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname LIKE '%letters%';
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Storage 업로드 설정 완료!';
    RAISE NOTICE '';
    RAISE NOTICE '변경 사항:';
    RAISE NOTICE '  1. letters 테이블 RLS 정책: % 개', policy_count;
    RAISE NOTICE '  2. Storage 객체 RLS 정책: % 개', storage_policy_count;
    RAISE NOTICE '  3. letters 버킷: public 설정';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  프로덕션 환경에서는 더 엄격한 정책을 사용하세요!';
    RAISE NOTICE '';
END $$;

-- 정책 목록 표시
SELECT 
  'letters 테이블' as category,
  policyname,
  cmd as operation,
  permissive
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'letters'
ORDER BY policyname;

SELECT 
  'Storage 객체' as category,
  policyname,
  cmd as operation,
  permissive
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
AND policyname LIKE '%letters%'
ORDER BY policyname;

-- Storage 버킷 상태 확인
SELECT 
  'letters 버킷' as category,
  id,
  name,
  public,
  CASE WHEN public THEN '✅ Public' ELSE '❌ Private' END as status
FROM storage.buckets
WHERE id = 'letters';
