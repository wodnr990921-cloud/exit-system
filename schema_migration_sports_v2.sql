-- 스포츠 경기 테이블 V2 마이그레이션
-- The Odds API와 완벽하게 호환되는 새로운 스키마

-- 기존 테이블이 있다면 삭제 (주의: 기존 데이터 손실됨)
-- DROP TABLE IF EXISTS sports_matches;

-- 새로운 sports_matches 테이블 생성
CREATE TABLE IF NOT EXISTS sports_matches (
  id TEXT PRIMARY KEY,               -- API에서 제공하는 고유 경기 ID
  sport_key TEXT,                    -- 종목 (예: soccer_korea_kleague_1)
  commence_time TIMESTAMP WITH TIME ZONE, -- 경기 시작 시간
  home_team TEXT,                    -- 홈팀 이름
  away_team TEXT,                    -- 원정팀 이름
  
  -- 배당률 (가장 대표적인 업체 1곳 기준 또는 평균값)
  odds_home FLOAT,                   -- 홈팀 승 배당
  odds_draw FLOAT,                   -- 무승부 배당
  odds_away FLOAT,                   -- 원정팀 승 배당
  
  -- 경기 결과 (결과가 나오면 업데이트)
  home_score INTEGER DEFAULT NULL,
  away_score INTEGER DEFAULT NULL,
  is_finished BOOLEAN DEFAULT FALSE, -- 경기 종료 여부
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_sports_matches_sport_key ON sports_matches(sport_key);
CREATE INDEX IF NOT EXISTS idx_sports_matches_commence_time ON sports_matches(commence_time);
CREATE INDEX IF NOT EXISTS idx_sports_matches_is_finished ON sports_matches(is_finished);
CREATE INDEX IF NOT EXISTS idx_sports_matches_teams ON sports_matches(home_team, away_team);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_sports_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_sports_matches_updated_at ON sports_matches;
CREATE TRIGGER trigger_update_sports_matches_updated_at
  BEFORE UPDATE ON sports_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_sports_matches_updated_at();

-- RLS (Row Level Security) 활성화 (선택사항)
ALTER TABLE sports_matches ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "모든 사용자가 경기 정보를 조회할 수 있습니다"
  ON sports_matches
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- 인증된 사용자만 삽입/업데이트 가능 (API 서버용)
CREATE POLICY "인증된 사용자만 경기 정보를 수정할 수 있습니다"
  ON sports_matches
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 테이블 구조 확인
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sports_matches' 
ORDER BY ordinal_position;

-- 샘플 데이터 조회 (마이그레이션 후 확인용)
SELECT 
  id,
  sport_key,
  commence_time,
  home_team,
  away_team,
  odds_home,
  odds_draw,
  odds_away,
  is_finished,
  home_score,
  away_score
FROM sports_matches
ORDER BY commence_time DESC
LIMIT 5;
