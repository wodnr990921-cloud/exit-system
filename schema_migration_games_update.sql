-- Games 테이블 컬럼 추가 (수기 경기 추가 기능 지원)

-- game_id 컬럼 추가 (unique identifier for external reference)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'game_id'
  ) THEN
    ALTER TABLE games ADD COLUMN game_id VARCHAR(255) UNIQUE;
  END IF;
END $$;

-- league 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'league'
  ) THEN
    ALTER TABLE games ADD COLUMN league VARCHAR(100);
  END IF;
END $$;

-- location 컬럼 추가 (경기장)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'location'
  ) THEN
    ALTER TABLE games ADD COLUMN location VARCHAR(255);
  END IF;
END $$;

-- home_odds 컬럼 추가 (홈팀 승리 배당률)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'home_odds'
  ) THEN
    ALTER TABLE games ADD COLUMN home_odds NUMERIC(10, 2);
  END IF;
END $$;

-- draw_odds 컬럼 추가 (무승부 배당률)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'draw_odds'
  ) THEN
    ALTER TABLE games ADD COLUMN draw_odds NUMERIC(10, 2);
  END IF;
END $$;

-- away_odds 컬럼 추가 (원정팀 승리 배당률)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'away_odds'
  ) THEN
    ALTER TABLE games ADD COLUMN away_odds NUMERIC(10, 2);
  END IF;
END $$;

-- created_by 컬럼 추가 (생성자 user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE games ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_games_game_id ON games(game_id);
CREATE INDEX IF NOT EXISTS idx_games_league ON games(league);
CREATE INDEX IF NOT EXISTS idx_games_created_by ON games(created_by);

-- 설명 코멘트 추가
COMMENT ON COLUMN games.game_id IS '외부 참조용 경기 고유 ID (예: 20260130-MAN-LIV-A3F2)';
COMMENT ON COLUMN games.league IS '리그명 (예: EPL, KBO, NBA 등)';
COMMENT ON COLUMN games.location IS '경기장명';
COMMENT ON COLUMN games.home_odds IS '홈팀 승리 배당률';
COMMENT ON COLUMN games.draw_odds IS '무승부 배당률';
COMMENT ON COLUMN games.away_odds IS '원정팀 승리 배당률';
COMMENT ON COLUMN games.created_by IS '경기 생성자 (수기 추가 시)';
