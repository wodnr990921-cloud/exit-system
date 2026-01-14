-- 1️⃣ password_hash 컬럼 추가 (DB 기반 인증용)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- 2️⃣ 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_users_password_hash 
ON users(password_hash);

-- 3️⃣ 컬럼 코멘트 추가
COMMENT ON COLUMN users.password_hash IS 'SHA256 해시된 비밀번호 (DB 기반 인증용)';

-- 4️⃣ 확인
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND column_name IN ('password_hash', 'temp_password', 'is_temp_password')
ORDER BY ordinal_position;
