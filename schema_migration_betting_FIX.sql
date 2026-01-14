-- 배팅 시스템 티켓 연동 마이그레이션 (안전 버전)
-- 기존 데이터를 보존하면서 새 컬럼 추가

-- 1단계: 기존 status 값 확인
DO $$
DECLARE
  existing_statuses TEXT;
BEGIN
  SELECT string_agg(DISTINCT status, ', ') INTO existing_statuses
  FROM task_items;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '기존 task_items status 값들: %', existing_statuses;
  RAISE NOTICE '========================================';
END $$;

-- 2단계: task_items 테이블에 배팅 관련 컬럼 추가
DO $$
BEGIN
  -- match_id 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_items' AND column_name = 'match_id'
  ) THEN
    ALTER TABLE task_items ADD COLUMN match_id TEXT;
    RAISE NOTICE '✓ match_id 컬럼 추가됨';
  ELSE
    RAISE NOTICE '○ match_id 컬럼 이미 존재';
  END IF;

  -- betting_choice 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_items' AND column_name = 'betting_choice'
  ) THEN
    ALTER TABLE task_items ADD COLUMN betting_choice TEXT;
    RAISE NOTICE '✓ betting_choice 컬럼 추가됨';
  ELSE
    RAISE NOTICE '○ betting_choice 컬럼 이미 존재';
  END IF;

  -- betting_odds 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_items' AND column_name = 'betting_odds'
  ) THEN
    ALTER TABLE task_items ADD COLUMN betting_odds FLOAT;
    RAISE NOTICE '✓ betting_odds 컬럼 추가됨';
  ELSE
    RAISE NOTICE '○ betting_odds 컬럼 이미 존재';
  END IF;

  -- potential_win 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_items' AND column_name = 'potential_win'
  ) THEN
    ALTER TABLE task_items ADD COLUMN potential_win INTEGER DEFAULT 0;
    RAISE NOTICE '✓ potential_win 컬럼 추가됨';
  ELSE
    RAISE NOTICE '○ potential_win 컬럼 이미 존재';
  END IF;

  -- settled_at 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_items' AND column_name = 'settled_at'
  ) THEN
    ALTER TABLE task_items ADD COLUMN settled_at TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE '✓ settled_at 컬럼 추가됨';
  ELSE
    RAISE NOTICE '○ settled_at 컬럼 이미 존재';
  END IF;

  -- match_result 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_items' AND column_name = 'match_result'
  ) THEN
    ALTER TABLE task_items ADD COLUMN match_result TEXT;
    RAISE NOTICE '✓ match_result 컬럼 추가됨';
  ELSE
    RAISE NOTICE '○ match_result 컬럼 이미 존재';
  END IF;

END $$;

-- 3단계: 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_task_items_match_id ON task_items(match_id);
CREATE INDEX IF NOT EXISTS idx_task_items_betting_choice ON task_items(betting_choice);

-- 4단계: sports_matches와의 외래키 제약조건 추가 (테이블이 있다면)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sports_matches') THEN
    -- 기존 제약조건 삭제
    ALTER TABLE task_items DROP CONSTRAINT IF EXISTS task_items_match_id_fkey;
    
    -- 새 제약조건 추가
    ALTER TABLE task_items 
      ADD CONSTRAINT task_items_match_id_fkey 
      FOREIGN KEY (match_id) 
      REFERENCES sports_matches(id) 
      ON DELETE SET NULL;
    
    RAISE NOTICE '✓ sports_matches 외래키 제약조건 추가됨';
  ELSE
    RAISE NOTICE '⚠ sports_matches 테이블이 없습니다. 먼저 schema_migration_sports_SAFE.sql을 실행하세요.';
  END IF;
END $$;

-- 5단계: 기존 CHECK 제약조건 삭제 (category와 status)
ALTER TABLE task_items DROP CONSTRAINT IF EXISTS task_items_category_check;
ALTER TABLE task_items DROP CONSTRAINT IF EXISTS task_items_status_check;

-- 6단계: 새로운 CHECK 제약조건 추가 (기존 값들 + 새 값들 모두 포함)
DO $$
DECLARE
  existing_categories TEXT[];
  existing_statuses TEXT[];
  category_list TEXT;
  status_list TEXT;
BEGIN
  -- 기존 category 값들 가져오기
  SELECT ARRAY_AGG(DISTINCT category) INTO existing_categories FROM task_items;
  
  -- 기존 status 값들 가져오기
  SELECT ARRAY_AGG(DISTINCT status) INTO existing_statuses FROM task_items;
  
  -- category 제약조건 (기존 값 + 새 값)
  category_list := '''book'', ''game'', ''goods'', ''inquiry'', ''complaint'', ''betting'', ''other'', ''complex''';
  
  -- 기존에 있는 카테고리 중 위에 없는 것들 추가
  IF existing_categories IS NOT NULL THEN
    FOR i IN 1..array_length(existing_categories, 1) LOOP
      IF existing_categories[i] NOT IN ('book', 'game', 'goods', 'inquiry', 'complaint', 'betting', 'other', 'complex') THEN
        category_list := category_list || ', ''' || existing_categories[i] || '''';
      END IF;
    END LOOP;
  END IF;
  
  -- status 제약조건 (기존 값 + 새 값)
  status_list := '''pending'', ''approved'', ''rejected'', ''won'', ''lost'', ''cancelled''';
  
  -- 기존에 있는 status 중 위에 없는 것들 추가
  IF existing_statuses IS NOT NULL THEN
    FOR i IN 1..array_length(existing_statuses, 1) LOOP
      IF existing_statuses[i] NOT IN ('pending', 'approved', 'rejected', 'won', 'lost', 'cancelled') THEN
        status_list := status_list || ', ''' || existing_statuses[i] || '''';
      END IF;
    END LOOP;
  END IF;
  
  -- category 제약조건 추가
  EXECUTE 'ALTER TABLE task_items ADD CONSTRAINT task_items_category_check CHECK (category IN (' || category_list || '))';
  RAISE NOTICE '✓ category CHECK 제약조건 추가됨: %', category_list;
  
  -- status 제약조건 추가
  EXECUTE 'ALTER TABLE task_items ADD CONSTRAINT task_items_status_check CHECK (status IN (' || status_list || '))';
  RAISE NOTICE '✓ status CHECK 제약조건 추가됨: %', status_list;
END $$;

-- 7단계: 자동 potential_win 계산 함수
CREATE OR REPLACE FUNCTION calculate_potential_win()
RETURNS TRIGGER AS $$
BEGIN
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

-- 8단계: 배팅 아이템 전용 뷰 생성
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

-- 9단계: 배팅 통계 뷰 생성
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

-- 10단계: 테이블 구조 확인
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'task_items' 
  AND column_name IN ('match_id', 'betting_choice', 'betting_odds', 'potential_win', 'settled_at', 'match_result', 'category', 'status')
ORDER BY ordinal_position;

-- 11단계: 제약조건 확인
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'task_items'::regclass
  AND conname LIKE '%check%'
ORDER BY conname;

-- 12단계: 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '배팅 시스템 티켓 연동 완료!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✓ 추가된 컬럼:';
    RAISE NOTICE '  - match_id: 경기 참조 (sports_matches)';
    RAISE NOTICE '  - betting_choice: 선택 (home/draw/away)';
    RAISE NOTICE '  - betting_odds: 배당률';
    RAISE NOTICE '  - potential_win: 예상 당첨금 (자동 계산)';
    RAISE NOTICE '  - settled_at: 정산 시각';
    RAISE NOTICE '  - match_result: 결과 스냅샷';
    RAISE NOTICE '';
    RAISE NOTICE '✓ 생성된 뷰:';
    RAISE NOTICE '  - betting_items: 배팅 아이템 조회';
    RAISE NOTICE '  - betting_stats: 경기별 배팅 통계';
    RAISE NOTICE '';
    RAISE NOTICE '✓ 제약조건:';
    RAISE NOTICE '  - category: 기존 값 + betting 포함';
    RAISE NOTICE '  - status: 기존 값 + won, lost 포함';
    RAISE NOTICE '';
    RAISE NOTICE '다음 단계:';
    RAISE NOTICE '1. 배팅 티켓 생성: POST /api/betting/create-ticket';
    RAISE NOTICE '2. 경기 일정 조회: GET /api/sports/schedule';
    RAISE NOTICE '3. 대시보드: http://localhost:3000/dashboard/sports';
    RAISE NOTICE '========================================';
END $$;
