-- Task Comments 테이블에 comment_type 컬럼 추가
-- 직원 간 댓글(internal)과 고객용 답신(customer_reply) 구분

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_comments' AND column_name = 'comment_type'
  ) THEN
    ALTER TABLE task_comments ADD COLUMN comment_type VARCHAR(50) DEFAULT 'internal';
    -- 기존 데이터는 모두 internal로 설정
    UPDATE task_comments SET comment_type = 'internal' WHERE comment_type IS NULL;
    -- 기본값 설정
    ALTER TABLE task_comments ALTER COLUMN comment_type SET DEFAULT 'internal';
    -- 제약조건 추가
    ALTER TABLE task_comments ADD CONSTRAINT task_comments_comment_type_check 
      CHECK (comment_type IN ('internal', 'customer_reply'));
  END IF;
END $$;

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_task_comments_type ON task_comments(comment_type);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_type ON task_comments(task_id, comment_type);
