-- ============================================
-- 스포츠 배팅 시스템 완전 통합 마이그레이션
-- 이 파일 하나만 실행하면 모든 설정 완료
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '스포츠 배팅 시스템 마이그레이션 시작';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- ============================================
-- PART 1: sports_matches 테이블 생성
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE 'PART 1: sports_matches 테이블 생성';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

-- 1-1. 기존 테이블 백업
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sports_matches') THEN
        DROP TABLE IF EXISTS sports_matches_backup CASCADE;
        CREATE TABLE sports_matches_backup AS SELECT * FROM sports_matches;
        RAISE NOTICE '✓ 기존 테이블을 sports_matches_backup으로 백업';
    ELSE
        RAISE NOTICE '○ 기존 테이블 없음 (새로 생성)';
    END IF;
END $$;

-- 1-2. 기존 테이블 삭제
DROP TABLE IF EXISTS sports_matches CASCADE;

-- 1-3. 새로운 sports_matches 테이블 생성
CREATE TABLE sports_matches (
  id TEXT PRIMARY KEY,
  sport_key TEXT,
  commence_time TIMESTAMP WITH TIME ZONE,
  home_team TEXT,
  away_team TEXT,
  odds_home FLOAT,
  odds_draw FLOAT,
  odds_away FLOAT,
  home_score INTEGER DEFAULT NULL,
  away_score INTEGER DEFAULT NULL,
  is_finished BOOLEAN DEFAULT FALSE,
  betting_closed BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    RAISE NOTICE '✓ sports_matches 테이블 생성 완료';
END $$;

-- 1-4. 인덱스 생성
CREATE INDEX idx_sports_matches_sport_key ON sports_matches(sport_key);
CREATE INDEX idx_sports_matches_commence_time ON sports_matches(commence_time);
CREATE INDEX idx_sports_matches_is_finished ON sports_matches(is_finished);
CREATE INDEX idx_sports_matches_teams ON sports_matches(home_team, away_team);
CREATE INDEX idx_sports_matches_betting_closed ON sports_matches(betting_closed);

DO $$
BEGIN
    RAISE NOTICE '✓ 인덱스 생성 완료';
END $$;

-- 1-5. updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_sports_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_sports_matches_updated_at ON sports_matches;
CREATE TRIGGER trigger_update_sports_matches_updated_at
  BEFORE UPDATE ON sports_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_sports_matches_updated_at();

DO $$
BEGIN
    RAISE NOTICE '✓ 트리거 생성 완료';
END $$;

-- 1-6. RLS 활성화 및 정책 설정
ALTER TABLE sports_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "경기 조회 허용" ON sports_matches;
DROP POLICY IF EXISTS "경기 수정 허용" ON sports_matches;

CREATE POLICY "경기 조회 허용"
  ON sports_matches FOR SELECT
  USING (true);

CREATE POLICY "경기 수정 허용"
  ON sports_matches FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
    RAISE NOTICE '✓ RLS 정책 설정 완료';
END $$;

-- ============================================
-- PART 2: task_items 테이블에 배팅 컬럼 추가
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE 'PART 2: task_items 배팅 컬럼 추가';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

-- 2-1. 기존 status 값 확인
DO $$
DECLARE
  existing_statuses TEXT;
BEGIN
  SELECT string_agg(DISTINCT status, ', ') INTO existing_statuses
  FROM task_items;
  RAISE NOTICE '현재 status 값: %', COALESCE(existing_statuses, '(없음)');
END $$;

-- 2-2. 배팅 관련 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_items' AND column_name = 'match_id') THEN
    ALTER TABLE task_items ADD COLUMN match_id TEXT;
    RAISE NOTICE '✓ match_id 컬럼 추가';
  ELSE
    RAISE NOTICE '○ match_id 이미 존재';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_items' AND column_name = 'betting_choice') THEN
    ALTER TABLE task_items ADD COLUMN betting_choice TEXT;
    RAISE NOTICE '✓ betting_choice 컬럼 추가';
  ELSE
    RAISE NOTICE '○ betting_choice 이미 존재';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_items' AND column_name = 'betting_odds') THEN
    ALTER TABLE task_items ADD COLUMN betting_odds FLOAT;
    RAISE NOTICE '✓ betting_odds 컬럼 추가';
  ELSE
    RAISE NOTICE '○ betting_odds 이미 존재';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_items' AND column_name = 'potential_win') THEN
    ALTER TABLE task_items ADD COLUMN potential_win INTEGER DEFAULT 0;
    RAISE NOTICE '✓ potential_win 컬럼 추가';
  ELSE
    RAISE NOTICE '○ potential_win 이미 존재';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_items' AND column_name = 'settled_at') THEN
    ALTER TABLE task_items ADD COLUMN settled_at TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE '✓ settled_at 컬럼 추가';
  ELSE
    RAISE NOTICE '○ settled_at 이미 존재';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_items' AND column_name = 'match_result') THEN
    ALTER TABLE task_items ADD COLUMN match_result TEXT;
    RAISE NOTICE '✓ match_result 컬럼 추가';
  ELSE
    RAISE NOTICE '○ match_result 이미 존재';
  END IF;
END $$;

-- 2-3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_task_items_match_id ON task_items(match_id);
CREATE INDEX IF NOT EXISTS idx_task_items_betting_choice ON task_items(betting_choice);

DO $$
BEGIN
    RAISE NOTICE '✓ task_items 인덱스 생성 완료';
END $$;

-- 2-4. 외래키 제약조건 추가
ALTER TABLE task_items DROP CONSTRAINT IF EXISTS task_items_match_id_fkey;
ALTER TABLE task_items 
  ADD CONSTRAINT task_items_match_id_fkey 
  FOREIGN KEY (match_id) 
  REFERENCES sports_matches(id) 
  ON DELETE SET NULL;

DO $$
BEGIN
    RAISE NOTICE '✓ sports_matches 외래키 추가 완료';
END $$;

-- 2-5. CHECK 제약조건 업데이트
ALTER TABLE task_items DROP CONSTRAINT IF EXISTS task_items_category_check;
ALTER TABLE task_items DROP CONSTRAINT IF EXISTS task_items_status_check;

DO $$
DECLARE
  existing_categories TEXT[];
  existing_statuses TEXT[];
  category_list TEXT;
  status_list TEXT;
BEGIN
  -- 기존 category 값들
  SELECT ARRAY_AGG(DISTINCT category) INTO existing_categories FROM task_items;
  category_list := '''book'', ''game'', ''goods'', ''inquiry'', ''complaint'', ''betting'', ''other'', ''complex''';
  
  IF existing_categories IS NOT NULL THEN
    FOR i IN 1..array_length(existing_categories, 1) LOOP
      IF existing_categories[i] NOT IN ('book', 'game', 'goods', 'inquiry', 'complaint', 'betting', 'other', 'complex') THEN
        category_list := category_list || ', ''' || existing_categories[i] || '''';
      END IF;
    END LOOP;
  END IF;
  
  -- 기존 status 값들
  SELECT ARRAY_AGG(DISTINCT status) INTO existing_statuses FROM task_items;
  status_list := '''pending'', ''approved'', ''rejected'', ''won'', ''lost'', ''cancelled''';
  
  IF existing_statuses IS NOT NULL THEN
    FOR i IN 1..array_length(existing_statuses, 1) LOOP
      IF existing_statuses[i] NOT IN ('pending', 'approved', 'rejected', 'won', 'lost', 'cancelled') THEN
        status_list := status_list || ', ''' || existing_statuses[i] || '''';
      END IF;
    END LOOP;
  END IF;
  
  EXECUTE 'ALTER TABLE task_items ADD CONSTRAINT task_items_category_check CHECK (category IN (' || category_list || '))';
  EXECUTE 'ALTER TABLE task_items ADD CONSTRAINT task_items_status_check CHECK (status IN (' || status_list || '))';
  
  RAISE NOTICE '✓ CHECK 제약조건 추가 완료';
END $$;

-- ============================================
-- PART 3: 함수 및 트리거 생성
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE 'PART 3: 함수 및 트리거 생성';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

-- 3-1. 자동 potential_win 계산 함수
CREATE OR REPLACE FUNCTION calculate_potential_win()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.category = 'betting' AND NEW.amount IS NOT NULL AND NEW.betting_odds IS NOT NULL THEN
    NEW.potential_win = FLOOR(NEW.amount * NEW.betting_odds);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_potential_win ON task_items;
CREATE TRIGGER trigger_calculate_potential_win
  BEFORE INSERT OR UPDATE ON task_items
  FOR EACH ROW
  WHEN (NEW.category = 'betting')
  EXECUTE FUNCTION calculate_potential_win();

DO $$
BEGIN
    RAISE NOTICE '✓ potential_win 자동 계산 트리거 생성';
END $$;

-- ============================================
-- PART 4: 뷰 생성
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE 'PART 4: 뷰 생성';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

-- 4-1. betting_items 뷰
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

DO $$
BEGIN
    RAISE NOTICE '✓ betting_items 뷰 생성';
END $$;

-- 4-2. betting_stats 뷰
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

DO $$
BEGIN
    RAISE NOTICE '✓ betting_stats 뷰 생성';
END $$;

-- ============================================
-- PART 5: 검증 및 완료
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE 'PART 5: 검증';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

-- 5-1. sports_matches 테이블 확인
DO $$
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'sports_matches';
  
  RAISE NOTICE '✓ sports_matches: % 개 컬럼', col_count;
END $$;

-- 5-2. task_items 배팅 컬럼 확인
DO $$
DECLARE
  betting_cols TEXT;
BEGIN
  SELECT string_agg(column_name, ', ') INTO betting_cols
  FROM information_schema.columns
  WHERE table_name = 'task_items'
    AND column_name IN ('match_id', 'betting_choice', 'betting_odds', 'potential_win', 'settled_at', 'match_result');
  
  RAISE NOTICE '✓ task_items 배팅 컬럼: %', betting_cols;
END $$;

-- 5-3. 뷰 확인
DO $$
DECLARE
  view_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_name IN ('betting_items', 'betting_stats');
  
  RAISE NOTICE '✓ 생성된 뷰: % 개', view_count;
END $$;

-- ============================================
-- 완료 메시지
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🎉 마이그레이션 완료!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ 생성된 테이블:';
    RAISE NOTICE '   - sports_matches (경기 데이터)';
    RAISE NOTICE '';
    RAISE NOTICE '✅ 추가된 컬럼 (task_items):';
    RAISE NOTICE '   - match_id: 경기 참조';
    RAISE NOTICE '   - betting_choice: 선택 (home/draw/away)';
    RAISE NOTICE '   - betting_odds: 배당률';
    RAISE NOTICE '   - potential_win: 예상 당첨금 (자동 계산)';
    RAISE NOTICE '   - settled_at: 정산 시각';
    RAISE NOTICE '   - match_result: 결과 스냅샷';
    RAISE NOTICE '';
    RAISE NOTICE '✅ 생성된 뷰:';
    RAISE NOTICE '   - betting_items: 배팅 아이템 조회';
    RAISE NOTICE '   - betting_stats: 경기별 배팅 통계';
    RAISE NOTICE '';
    RAISE NOTICE '📋 다음 단계:';
    RAISE NOTICE '   1. 경기 동기화: http://localhost:3000/api/sync-sports';
    RAISE NOTICE '   2. 경기 일정: http://localhost:3000/api/sports/schedule';
    RAISE NOTICE '   3. 대시보드: http://localhost:3000/dashboard/sports';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- 샘플 데이터 확인
SELECT 
  'sports_matches' as table_name,
  COUNT(*) as row_count
FROM sports_matches
UNION ALL
SELECT 
  'task_items (betting)' as table_name,
  COUNT(*) as row_count
FROM task_items
WHERE category = 'betting';
