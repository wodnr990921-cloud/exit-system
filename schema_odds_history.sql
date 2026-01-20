-- 배당 히스토리 테이블 (배당 변동 추적용)
-- Supabase SQL Editor에서 실행하세요

-- 기존 테이블 삭제 (깔끔한 재설치)
DROP TABLE IF EXISTS odds_history CASCADE;

-- 배당 변동 이력 테이블 생성
CREATE TABLE odds_history (
  id SERIAL PRIMARY KEY,
  match_id TEXT NOT NULL,                    -- sports_matches.id 참조
  sport_key TEXT NOT NULL,                   -- 리그 구분
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  
  -- 이전 배당
  prev_odds_home FLOAT,
  prev_odds_draw FLOAT,
  prev_odds_away FLOAT,
  
  -- 새로운 배당
  new_odds_home FLOAT,
  new_odds_draw FLOAT,
  new_odds_away FLOAT,
  
  -- 변동 정보
  change_home FLOAT,                         -- 홈 배당 변동폭
  change_draw FLOAT,                         -- 무승부 배당 변동폭
  change_away FLOAT,                         -- 원정 배당 변동폭
  change_type TEXT,                          -- 'increase', 'decrease', 'mixed'
  
  -- 메타 정보
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 외래키
  CONSTRAINT fk_match FOREIGN KEY (match_id) 
    REFERENCES sports_matches(id) 
    ON DELETE CASCADE
);

-- 인덱스 생성 (빠른 조회)
CREATE INDEX idx_odds_history_match_id ON odds_history(match_id);
CREATE INDEX idx_odds_history_sport_key ON odds_history(sport_key);
CREATE INDEX idx_odds_history_checked_at ON odds_history(checked_at DESC);
CREATE INDEX idx_odds_history_change_type ON odds_history(change_type);

-- RLS 활성화
ALTER TABLE odds_history ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 조회 가능
CREATE POLICY "배당 히스토리 조회 허용" ON odds_history
  FOR SELECT USING (true);

-- 인증된 사용자만 수정 가능
CREATE POLICY "배당 히스토리 수정 허용" ON odds_history
  FOR ALL USING (auth.role() = 'authenticated');

-- 테이블 설명
COMMENT ON TABLE odds_history IS '배당 변동 이력 추적 테이블';
COMMENT ON COLUMN odds_history.match_id IS '경기 ID (sports_matches 참조)';
COMMENT ON COLUMN odds_history.change_type IS '변동 유형: increase(상승), decrease(하락), mixed(혼합)';
COMMENT ON COLUMN odds_history.checked_at IS '배당 확인 시간 (KST)';

-- 최근 배당 변동 조회 뷰 생성
CREATE OR REPLACE VIEW recent_odds_changes AS
SELECT 
  oh.match_id,
  oh.sport_key,
  oh.home_team,
  oh.away_team,
  oh.prev_odds_home,
  oh.new_odds_home,
  oh.change_home,
  oh.prev_odds_draw,
  oh.new_odds_draw,
  oh.change_draw,
  oh.prev_odds_away,
  oh.new_odds_away,
  oh.change_away,
  oh.change_type,
  oh.checked_at,
  sm.commence_time,
  sm.is_finished
FROM odds_history oh
JOIN sports_matches sm ON oh.match_id = sm.id
WHERE oh.checked_at >= NOW() - INTERVAL '24 hours'
ORDER BY oh.checked_at DESC;

-- 배당 변동 통계 뷰
CREATE OR REPLACE VIEW odds_change_stats AS
SELECT 
  sport_key,
  COUNT(*) as total_changes,
  COUNT(CASE WHEN change_type = 'increase' THEN 1 END) as increase_count,
  COUNT(CASE WHEN change_type = 'decrease' THEN 1 END) as decrease_count,
  COUNT(CASE WHEN change_type = 'mixed' THEN 1 END) as mixed_count,
  AVG(ABS(change_home)) as avg_home_change,
  AVG(ABS(change_draw)) as avg_draw_change,
  AVG(ABS(change_away)) as avg_away_change,
  MAX(checked_at) as last_check
FROM odds_history
WHERE checked_at >= NOW() - INTERVAL '7 days'
GROUP BY sport_key
ORDER BY total_changes DESC;

-- 샘플 조회 쿼리
SELECT 
  '=== 최근 24시간 배당 변동 ===' as title;

SELECT * FROM recent_odds_changes LIMIT 10;

SELECT 
  '=== 리그별 배당 변동 통계 ===' as title;

SELECT * FROM odds_change_stats;
