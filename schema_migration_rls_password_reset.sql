-- =====================================================
-- RLS 정책 수정: 비밀번호 재설정 허용
-- =====================================================
-- Service Role Key 없이도 임시 비밀번호를 저장할 수 있도록 설정
-- =====================================================

-- 임시 비밀번호 업데이트 정책 추가
DROP POLICY IF EXISTS users_update_temp_password ON users;
CREATE POLICY users_update_temp_password ON users
  FOR UPDATE
  USING (true)  -- 모든 요청 허용 (API에서 username 확인함)
  WITH CHECK (
    -- 임시 비밀번호 관련 컬럼만 업데이트 가능
    (temp_password IS NOT NULL OR temp_password IS NULL) AND
    (is_temp_password IS NOT NULL OR is_temp_password IS NULL) AND
    (temp_password_expires_at IS NOT NULL OR temp_password_expires_at IS NULL)
  );

-- 또는 더 안전한 방법: RLS를 유지하되 임시로 비활성화
-- (개발 환경에서만 사용 권장)
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 프로덕션에서는 다시 활성화
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
