-- 베트맨/라이브스코어 크롤링용 테이블 생성
-- Supabase SQL Editor에서 실행하세요

-- sports_matches 테이블 생성
CREATE TABLE IF NOT EXISTS sports_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_time TEXT,
    sport TEXT,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    odds_home FLOAT,
    odds_draw FLOAT,
    odds_away FLOAT,
    home_score INTEGER,
    away_score INTEGER,
    status TEXT DEFAULT 'scheduled',
    source TEXT DEFAULT 'betman',
    match_score FLOAT DEFAULT 0,
    scraped_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(home_team, away_team, match_time)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sports_matches_teams ON sports_matches(home_team, away_team);
CREATE INDEX IF NOT EXISTS idx_sports_matches_status ON sports_matches(status);
CREATE INDEX IF NOT EXISTS idx_sports_matches_time ON sports_matches(match_time);

-- 테이블 생성 확인
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'sports_matches' 
ORDER BY ordinal_position;
