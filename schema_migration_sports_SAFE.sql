-- 안전한 스포츠 경기 테이블 마이그레이션
-- 기존 데이터를 백업하고 새 구조로 전환

-- 1단계: 기존 테이블 백업 (데이터가 있다면)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sports_matches') THEN
        -- 백업 테이블 생성
        CREATE TABLE IF NOT EXISTS sports_matches_backup AS 
        SELECT * FROM sports_matches;
        
        RAISE NOTICE '기존 테이블을 sports_matches_backup으로 백업했습니다';
    END IF;
END $$;

-- 2단계: 기존 테이블 삭제
DROP TABLE IF EXISTS sports_matches CASCADE;

-- 3단계: 새로운 sports_matches 테이블 생성
CREATE TABLE sports_matches (
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
  
  -- 배팅 관련 추가 컬럼
  betting_closed BOOLEAN DEFAULT FALSE, -- 배당 마감 여부
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4단계: 인덱스 생성 (성능 향상)
CREATE INDEX idx_sports_matches_sport_key ON sports_matches(sport_key);
CREATE INDEX idx_sports_matches_commence_time ON sports_matches(commence_time);
CREATE INDEX idx_sports_matches_is_finished ON sports_matches(is_finished);
CREATE INDEX idx_sports_matches_teams ON sports_matches(home_team, away_team);
CREATE INDEX idx_sports_matches_betting_closed ON sports_matches(betting_closed);

-- 5단계: updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_sports_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6단계: 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_sports_matches_updated_at ON sports_matches;
CREATE TRIGGER trigger_update_sports_matches_updated_at
  BEFORE UPDATE ON sports_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_sports_matches_updated_at();

-- 7단계: RLS (Row Level Security) 활성화
ALTER TABLE sports_matches ENABLE ROW LEVEL SECURITY;

-- 8단계: RLS 정책 생성
-- 기존 정책 삭제
DROP POLICY IF EXISTS "모든 사용자가 경기 정보를 조회할 수 있습니다" ON sports_matches;
DROP POLICY IF EXISTS "인증된 사용자만 경기 정보를 수정할 수 있습니다" ON sports_matches;
DROP POLICY IF EXISTS "읽기 허용" ON sports_matches;
DROP POLICY IF EXISTS "쓰기 허용" ON sports_matches;

-- 새 정책 생성
CREATE POLICY "경기 조회 허용"
  ON sports_matches
  FOR SELECT
  USING (true);

CREATE POLICY "경기 수정 허용"
  ON sports_matches
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 9단계: 테이블 구조 확인
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sports_matches' 
ORDER BY ordinal_position;

-- 10단계: 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '스포츠 경기 테이블 마이그레이션 완료!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '새 테이블: sports_matches';
    RAISE NOTICE '백업 테이블: sports_matches_backup';
    RAISE NOTICE '';
    RAISE NOTICE '다음 단계:';
    RAISE NOTICE '1. API 동기화: http://localhost:3000/api/sync-sports';
    RAISE NOTICE '2. 대시보드: http://localhost:3000/dashboard/sports';
    RAISE NOTICE '========================================';
END $$;

-- 11단계: 샘플 데이터 조회 (비어있을 수 있음)
SELECT 
  COUNT(*) as total_matches,
  COUNT(CASE WHEN is_finished = false THEN 1 END) as upcoming,
  COUNT(CASE WHEN is_finished = true THEN 1 END) as completed
FROM sports_matches;
