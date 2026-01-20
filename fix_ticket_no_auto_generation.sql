-- ================================================================
-- Ticket Number Auto-Generation Fix
-- ================================================================
-- tasks 테이블에 ticket_no 자동 생성 기능 추가
-- "ticket_no is ambiguous" 오류 해결

-- ================================================================
-- PART 1: ticket_no 컬럼 추가
-- ================================================================

DO $$ 
BEGIN
  -- ticket_no: 티켓 고유 번호 (자동 생성)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'ticket_no'
  ) THEN
    ALTER TABLE tasks ADD COLUMN ticket_no VARCHAR(50) UNIQUE;
    RAISE NOTICE '✅ ticket_no 컬럼 추가 완료';
  ELSE
    RAISE NOTICE '✓ ticket_no 컬럼이 이미 존재합니다';
  END IF;

  -- UNIQUE constraint 추가 (없는 경우)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tasks_ticket_no_key' AND conrelid = 'tasks'::regclass
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_ticket_no_key UNIQUE (ticket_no);
    RAISE NOTICE '✅ ticket_no UNIQUE constraint 추가 완료';
  END IF;
END $$;

-- ================================================================
-- PART 2: 티켓 번호 자동 생성 함수
-- ================================================================

CREATE OR REPLACE FUNCTION generate_ticket_no()
RETURNS TEXT AS $$
DECLARE
  today TEXT;
  seq_num INTEGER;
  new_ticket_no TEXT;
  max_attempts INTEGER := 100;
  attempt INTEGER := 0;
BEGIN
  -- 오늘 날짜 형식: YYMMDD
  today := TO_CHAR(NOW(), 'YYMMDD');

  LOOP
    -- 오늘 날짜로 시작하는 티켓 중 가장 큰 번호 찾기
    SELECT COALESCE(MAX(
      CASE
        WHEN tasks.ticket_no ~ ('^' || today || '-[0-9]+$')
        THEN CAST(SUBSTRING(tasks.ticket_no FROM '[0-9]+$') AS INTEGER)
        ELSE 0
      END
    ), 0) + 1
    INTO seq_num
    FROM tasks
    WHERE tasks.ticket_no LIKE (today || '-%');

    -- 티켓 번호 생성: YYMMDD-NNNN (예: 260120-0001)
    new_ticket_no := today || '-' || LPAD(seq_num::TEXT, 4, '0');

    -- 중복 체크 (race condition 방지)
    IF NOT EXISTS (SELECT 1 FROM tasks WHERE tasks.ticket_no = new_ticket_no) THEN
      RETURN new_ticket_no;
    END IF;

    -- 무한 루프 방지
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION '티켓 번호 생성 실패: 최대 시도 횟수 초과';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- PART 3: 자동 생성 트리거
-- ================================================================

CREATE OR REPLACE FUNCTION auto_generate_ticket_no()
RETURNS TRIGGER AS $$
BEGIN
  -- ticket_no가 NULL이면 자동 생성
  IF NEW.ticket_no IS NULL THEN
    NEW.ticket_no := generate_ticket_no();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS trigger_auto_generate_ticket_no ON tasks;
CREATE TRIGGER trigger_auto_generate_ticket_no
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_ticket_no();

-- ================================================================
-- PART 4: 인덱스 생성
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_ticket_no ON tasks(ticket_no) WHERE ticket_no IS NOT NULL;

-- ================================================================
-- PART 5: 기존 티켓에 번호 부여
-- ================================================================

-- 기존 티켓 중 ticket_no가 없는 것들에 번호 자동 부여
DO $$
DECLARE
  task_record RECORD;
  new_ticket_no TEXT;
  updated_count INTEGER := 0;
BEGIN
  FOR task_record IN 
    SELECT id FROM tasks WHERE ticket_no IS NULL ORDER BY created_at
  LOOP
    new_ticket_no := generate_ticket_no();
    UPDATE tasks SET ticket_no = new_ticket_no WHERE id = task_record.id;
    updated_count := updated_count + 1;
  END LOOP;
  
  RAISE NOTICE '✅ 기존 티켓에 ticket_no 부여 완료 (% 개)', updated_count;
END $$;

-- ================================================================
-- PART 6: 확인 및 통계
-- ================================================================

DO $$
DECLARE
  ticket_count INTEGER;
  null_count INTEGER;
  today_count INTEGER;
  today_pattern TEXT;
BEGIN
  -- 전체 통계
  SELECT COUNT(*) INTO ticket_count FROM tasks WHERE ticket_no IS NOT NULL;
  SELECT COUNT(*) INTO null_count FROM tasks WHERE ticket_no IS NULL;
  
  -- 오늘 생성된 티켓 수
  today_pattern := TO_CHAR(NOW(), 'YYMMDD') || '-%';
  SELECT COUNT(*) INTO today_count FROM tasks WHERE ticket_no LIKE today_pattern;
  
  RAISE NOTICE '';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '✅ Ticket Number Auto-Generation 설정 완료!';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 통계:';
  RAISE NOTICE '  - ticket_no가 있는 티켓: % 개', ticket_count;
  RAISE NOTICE '  - ticket_no가 없는 티켓: % 개', null_count;
  RAISE NOTICE '  - 오늘 생성된 티켓: % 개', today_count;
  RAISE NOTICE '';
  RAISE NOTICE '⚙️  동작 방식:';
  RAISE NOTICE '  - 새 티켓 생성 시 자동으로 ticket_no 생성';
  RAISE NOTICE '  - 형식: YYMMDD-NNNN (예: 260120-0001)';
  RAISE NOTICE '  - 매일 0001부터 순차 증가';
  RAISE NOTICE '  - 트리거: trigger_auto_generate_ticket_no';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  "ticket_no is ambiguous" 오류 해결:';
  RAISE NOTICE '  - TypeScript 코드에서는 테이블명 명시 불필요';
  RAISE NOTICE '  - Supabase는 자동으로 기본 테이블 컬럼 인식';
  RAISE NOTICE '  - Raw SQL에서는 tasks.ticket_no 형태로 명시';
  RAISE NOTICE '';
  RAISE NOTICE '✅ 설정 완료! 이제 새 티켓 생성 시 자동으로 번호가 부여됩니다.';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '';
END $$;

-- ================================================================
-- PART 7: 최근 티켓 확인 (선택사항)
-- ================================================================

-- 주석을 해제하면 최근 티켓 5개를 확인할 수 있습니다
/*
SELECT 
  id,
  ticket_no,
  status,
  created_at
FROM tasks
ORDER BY created_at DESC
LIMIT 5;
*/
