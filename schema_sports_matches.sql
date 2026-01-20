-- 스포츠 배팅 시스템용 sports_matches 테이블
-- Supabase SQL Editor에서 실행하세요

-- 기존 테이블 삭제 (깔끔한 재설치)
DROP TABLE IF EXISTS sports_matches CASCADE;

-- 새 sports_matches 테이블 생성
CREATE TABLE sports_matches (
    id TEXT PRIMARY KEY,                      -- API 제공 고유 ID (예: kleague_abc123)
    sport_key TEXT NOT NULL,                  -- 'K-LEAGUE', 'KOVO', 'KBL', 'WKBL' 등
    commence_time TIMESTAMP WITH TIME ZONE,   -- 경기 시작 시간
    home_team TEXT NOT NULL,                  -- 홈팀 이름 (표준화된 이름)
    away_team TEXT NOT NULL,                  -- 원정팀 이름 (표준화된 이름)
    odds_home FLOAT,                          -- 홈팀 승 배당
    odds_draw FLOAT,                          -- 무승부 배당 (축구만)
    odds_away FLOAT,                          -- 원정팀 승 배당
    home_score INTEGER DEFAULT NULL,          -- 홈팀 득점
    away_score INTEGER DEFAULT NULL,          -- 원정팀 득점
    is_finished BOOLEAN DEFAULT FALSE,        -- 경기 종료 여부
    betting_closed BOOLEAN DEFAULT FALSE,     -- 배팅 마감 여부
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_sports_matches_sport_key ON sports_matches(sport_key);
CREATE INDEX idx_sports_matches_teams ON sports_matches(home_team, away_team);
CREATE INDEX idx_sports_matches_commence_time ON sports_matches(commence_time);
CREATE INDEX idx_sports_matches_is_finished ON sports_matches(is_finished);
CREATE INDEX idx_sports_matches_betting_closed ON sports_matches(betting_closed);

-- updated_at 자동 업데이트 트리거
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

-- RLS 활성화
ALTER TABLE sports_matches ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 조회 가능
CREATE POLICY "경기 조회 허용" ON sports_matches
  FOR SELECT USING (true);

-- 인증된 사용자만 수정 가능
CREATE POLICY "경기 수정 허용" ON sports_matches
  FOR ALL USING (auth.role() = 'authenticated');

-- 테이블 생성 확인
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sports_matches' 
ORDER BY ordinal_position;
