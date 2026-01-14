-- 배팅 시스템 티켓 연동 마이그레이션
-- task_items에 배팅 관련 컬럼 추가

-- 1단계: task_items 테이블에 배팅 관련 컬럼 추가
DO $$
BEGIN
  -- match_id 컬럼 추가 (sports_matches 참조)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_items' AND column_name = 'match_id'
  ) THEN
    ALTER TABLE task_items ADD COLUMN match_id TEXT REFERENCES sports_matches(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_task_items_match_id ON task_items(match_id);
  END IF;

  -- betting_choice 컬럼 추가 (home, draw, away)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_items' AND column_name = 'betting_choice'
  ) THEN
    ALTER TABLE task_items ADD COLUMN betting_choice TEXT;
  END IF;

  -- betting_odds 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_items' AND column_name = 'betting_odds'
  ) THEN
    ALTER TABLE task_items ADD COLUMN betting_odds FLOAT;
  END IF;

  -- potential_win 컬럼 추가 (예상 당첨금)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_items' AND column_name = 'potential_win'
  ) THEN
    ALTER TABLE task_items ADD COLUMN potential_win INTEGER DEFAULT 0;
  END IF;

  -- settled_at 컬럼 추가 (정산 시각)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_items' AND column_name = 'settled_at'
  ) THEN
    ALTER TABLE task_items ADD COLUMN settled_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- match_result 컬럼 추가 (경기 결과 스냅샷)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_items' AND column_name = 'match_result'
  ) THEN
    ALTER TABLE task_items ADD COLUMN match_result TEXT;
  END IF;

END $$;

-- 2단계: 배팅 카테고리에 대한 CHECK 제약조건 업데이트
DO $$
BEGIN
  -- 기존 제약조건 삭제 (있다면)
  ALTER TABLE task_items DROP CONSTRAINT IF EXISTS task_items_category_check;
  
  -- 새로운 제약조건 추가 (betting 포함)
  ALTER TABLE task_items ADD CONSTRAINT task_items_category_check 
    CHECK (category IN ('book', 'game', 'goods', 'inquiry', 'complaint', 'betting', 'other', 'complex'));
END $$;

-- 3단계: 배팅 상태에 대한 CHECK 제약조건 업데이트
DO $$
BEGIN
  -- 기존 제약조건 삭제 (있다면)
  ALTER TABLE task_items DROP CONSTRAINT IF EXISTS task_items_status_check;
  
  -- 새로운 제약조건 추가 (won, lost 포함)
  ALTER TABLE task_items ADD CONSTRAINT task_items_status_check 
    CHECK (status IN ('pending', 'approved', 'rejected', 'won', 'lost', 'cancelled'));
END $$;

-- 4단계: 배팅 아이템 전용 뷰 생성
CREATE OR REPLACE VIEW betting_items AS
SELECT 
  ti.id,
  ti.task_id,
  t.ticket_no,
  t.member_id,
  c.member_number,
  c.name as customer_name,
  ti.match_id,
  sm.home_team,
  sm.away_team,
  sm.commence_time,
  sm.sport_key,
  ti.betting_choice,
  ti.betting_odds,
  ti.amount as bet_amount,
  ti.potential_win,
  ti.status as bet_status,
  ti.match_result,
  ti.settled_at,
  ti.created_at,
  sm.is_finished,
  sm.home_score,
  sm.away_score
FROM task_items ti
JOIN tasks t ON t.id = ti.task_id
LEFT JOIN customers c ON c.id = t.member_id
LEFT JOIN sports_matches sm ON sm.id = ti.match_id
WHERE ti.category = 'betting';

-- 5단계: 배팅 통계 뷰 생성
CREATE OR REPLACE VIEW betting_stats AS
SELECT 
  sm.id as match_id,
  sm.home_team,
  sm.away_team,
  sm.commence_time,
  sm.sport_key,
  sm.is_finished,
  COUNT(ti.id) as bet_count,
  SUM(ti.amount) as total_bet_amount,
  SUM(ti.potential_win) as total_potential_win,
  COUNT(CASE WHEN ti.status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN ti.status = 'won' THEN 1 END) as won_count,
  COUNT(CASE WHEN ti.status = 'lost' THEN 1 END) as lost_count,
  SUM(CASE WHEN ti.status = 'won' THEN ti.potential_win ELSE 0 END) as total_payout
FROM sports_matches sm
LEFT JOIN task_items ti ON ti.match_id = sm.id AND ti.category = 'betting'
GROUP BY sm.id, sm.home_team, sm.away_team, sm.commence_time, sm.sport_key, sm.is_finished;

-- 6단계: 자동 potential_win 계산 함수
CREATE OR REPLACE FUNCTION calculate_potential_win()
RETURNS TRIGGER AS $$
BEGIN
  -- betting 카테고리이고 amount와 odds가 있으면 자동 계산
  IF NEW.category = 'betting' AND NEW.amount IS NOT NULL AND NEW.betting_odds IS NOT NULL THEN
    NEW.potential_win = FLOOR(NEW.amount * NEW.betting_odds);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_calculate_potential_win ON task_items;
CREATE TRIGGER trigger_calculate_potential_win
  BEFORE INSERT OR UPDATE ON task_items
  FOR EACH ROW
  WHEN (NEW.category = 'betting')
  EXECUTE FUNCTION calculate_potential_win();

-- 7단계: 테이블 구조 확인
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'task_items' 
  AND column_name IN ('match_id', 'betting_choice', 'betting_odds', 'potential_win', 'settled_at', 'match_result')
ORDER BY ordinal_position;

-- 8단계: 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '배팅 시스템 티켓 연동 완료!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '추가된 컬럼:';
    RAISE NOTICE '  - match_id: 경기 참조';
    RAISE NOTICE '  - betting_choice: 선택 (home/draw/away)';
    RAISE NOTICE '  - betting_odds: 배당률';
    RAISE NOTICE '  - potential_win: 예상 당첨금 (자동 계산)';
    RAISE NOTICE '  - settled_at: 정산 시각';
    RAISE NOTICE '  - match_result: 결과 스냅샷';
    RAISE NOTICE '';
    RAISE NOTICE '생성된 뷰:';
    RAISE NOTICE '  - betting_items: 배팅 아이템 조회';
    RAISE NOTICE '  - betting_stats: 경기별 배팅 통계';
    RAISE NOTICE '========================================';
END $$;
