-- 기존 사용자들에게 기본 비밀번호 설정
-- 비밀번호: "exit2026" (SHA256 해시)

-- 1. wodnr990921 계정에 기본 비밀번호 설정
UPDATE users 
SET password_hash = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'
WHERE username = 'wodnr990921';

-- 2. 모든 사용자 승인 (필요시)
UPDATE users 
SET is_approved = true
WHERE is_approved IS NULL OR is_approved = false;

-- 3. 임시 비밀번호 초기화
UPDATE users 
SET 
  temp_password = NULL,
  temp_password_expires_at = NULL,
  is_temp_password = false
WHERE is_temp_password = true;

-- 4. 확인 쿼리
SELECT 
  id,
  username, 
  email,
  role,
  is_approved,
  CASE 
    WHEN password_hash IS NOT NULL THEN '설정됨'
    ELSE '없음'
  END as password_status,
  is_temp_password
FROM users
ORDER BY created_at DESC;
