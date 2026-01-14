-- Sports Games Master Data Migration
-- games 테이블 생성 (경기 기초 데이터)

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  game_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'active', 'finished', 'cancelled'
  result VARCHAR(255), -- 경기 결과 (예: 'home_win', 'away_win', 'draw')
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_game_date ON games(game_date);

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_games_updated_at ON games;
CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- task_items와 games를 연결하기 위한 game_id 컬럼 추가
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_items' AND column_name = 'game_id'
  ) THEN
    ALTER TABLE task_items ADD COLUMN game_id UUID REFERENCES games(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_task_items_game_id ON task_items(game_id) WHERE game_id IS NOT NULL;
