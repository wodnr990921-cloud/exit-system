-- 데이터베이스에 있는 모든 사용자 확인
SELECT id, username, email, role, is_approved, created_at
FROM users
ORDER BY created_at DESC;

-- username으로 특정 사용자 찾기
SELECT id, username, email, role, is_approved
FROM users
WHERE username = 'wodnr990921';

-- email로 사용자 찾기 (혹시 username이 없을 경우)
SELECT id, username, email, role, is_approved
FROM users
WHERE email LIKE '%wodnr990921%';
