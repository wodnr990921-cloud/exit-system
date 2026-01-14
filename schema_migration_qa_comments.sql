-- 문의/답변 댓글/답글 구분 기능 추가
-- 2026-01-14

-- 1. task_comments 테이블에 comment_type 컬럼 추가
ALTER TABLE task_comments 
ADD COLUMN IF NOT EXISTS comment_type VARCHAR(20) DEFAULT 'internal' CHECK (comment_type IN ('internal', 'reply'));

-- 2. 회원에게 발송 여부 추적
ALTER TABLE task_comments 
ADD COLUMN IF NOT EXISTS sent_to_member BOOLEAN DEFAULT false;

-- 3. 발송 시간 추적
ALTER TABLE task_comments 
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;

-- 4. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_task_comments_type ON task_comments(comment_type);
CREATE INDEX IF NOT EXISTS idx_task_comments_sent ON task_comments(sent_to_member);

-- 5. 기존 댓글은 모두 internal로 설정
UPDATE task_comments 
SET comment_type = 'internal' 
WHERE comment_type IS NULL;

COMMENT ON COLUMN task_comments.comment_type IS '댓글 유형: internal(내부 소통용), reply(회원 발송용)';
COMMENT ON COLUMN task_comments.sent_to_member IS '회원에게 발송 완료 여부';
COMMENT ON COLUMN task_comments.sent_at IS '회원에게 발송된 시간';
