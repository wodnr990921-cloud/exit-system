-- 기존 테이블 및 관련 객체 삭제 (깔끔한 재설치)
DROP TABLE IF EXISTS team_mapping CASCADE;

-- 팀 이름 매핑 테이블 생성 (API 이름 → 표준 이름 변환)
CREATE TABLE team_mapping (
  id SERIAL PRIMARY KEY,
  league VARCHAR(50) NOT NULL, -- 'KOVO', 'KBL', 'WKBL', 'K-LEAGUE'
  api_source VARCHAR(100) NOT NULL, -- 'API-Volleyball', 'API-Basketball', 'The Odds API'
  api_name TEXT NOT NULL, -- API에서 제공하는 원본 팀 이름
  standard_name TEXT NOT NULL, -- 우리 시스템의 표준 팀 이름
  is_active BOOLEAN DEFAULT TRUE, -- 활성화 여부
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 같은 리그, API 소스, API 이름은 중복되지 않도록
  UNIQUE(league, api_source, api_name)
);

-- 인덱스 생성 (빠른 조회를 위해)
CREATE INDEX idx_team_mapping_lookup ON team_mapping(league, api_source, api_name) WHERE is_active = true;
CREATE INDEX idx_team_mapping_league ON team_mapping(league) WHERE is_active = true;

-- 업데이트 시간 자동 갱신 트리거 함수
CREATE FUNCTION update_team_mapping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 연결
CREATE TRIGGER team_mapping_updated_at
  BEFORE UPDATE ON team_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_team_mapping_updated_at();

-- 샘플 데이터 (K-리그 예시)
INSERT INTO team_mapping (league, api_source, api_name, standard_name) VALUES
  ('K-LEAGUE', 'The Odds API', 'FC Seoul', '서울 FC'),
  ('K-LEAGUE', 'The Odds API', 'Ulsan Hyundai', '울산 현대'),
  ('K-LEAGUE', 'The Odds API', 'Jeonbuk Hyundai Motors', '전북 현대'),
  ('K-LEAGUE', 'The Odds API', 'Pohang Steelers', '포항 스틸러스'),
  ('K-LEAGUE', 'The Odds API', 'Suwon Samsung Bluewings', '수원 삼성'),
  ('K-LEAGUE', 'The Odds API', 'Gangwon FC', '강원 FC'),
  ('K-LEAGUE', 'The Odds API', 'Daegu FC', '대구 FC'),
  ('K-LEAGUE', 'The Odds API', 'Incheon United', '인천 유나이티드'),
  ('K-LEAGUE', 'The Odds API', 'Jeju United', '제주 유나이티드'),
  ('K-LEAGUE', 'The Odds API', 'Gwangju FC', '광주 FC'),
  ('K-LEAGUE', 'The Odds API', 'Suwon FC', '수원 FC'),
  ('K-LEAGUE', 'The Odds API', 'Seongnam FC', '성남 FC')
ON CONFLICT (league, api_source, api_name) DO NOTHING;

-- KOVO 샘플 데이터 (배구)
INSERT INTO team_mapping (league, api_source, api_name, standard_name) VALUES
  ('KOVO', 'API-Volleyball', 'Incheon Korean Air Jumbos', '인천 대한항공'),
  ('KOVO', 'API-Volleyball', 'Seoul Woori Card Wibee', '서울 우리카드'),
  ('KOVO', 'API-Volleyball', 'Daejeon Samsung Fire Bluefangs', '대전 삼성화재'),
  ('KOVO', 'API-Volleyball', 'Suwon KEPCO Vixtorm', '수원 한국전력'),
  ('KOVO', 'API-Volleyball', 'Cheonan Hyundai Capital Skywalkers', '천안 현대캐피탈'),
  ('KOVO', 'API-Volleyball', 'Ansan OK Financial Group', '안산 OK금융그룹'),
  ('KOVO', 'API-Volleyball', 'Seoul GS Caltex', '서울 GS칼텍스'),
  ('KOVO', 'API-Volleyball', 'Incheon Heungkuk Life Pink Spiders', '인천 흥국생명'),
  ('KOVO', 'API-Volleyball', 'Suwon Hyundai E&C Hillstate', '수원 현대건설'),
  ('KOVO', 'API-Volleyball', 'Gwangju Pepper Savings Bank', '광주 페퍼저축은행'),
  ('KOVO', 'API-Volleyball', 'Daejeon KGC Ginseng Corporation', '대전 KGC인삼공사'),
  ('KOVO', 'API-Volleyball', 'Gimcheon Korea Expressway Corporation', '김천 한국도로공사')
ON CONFLICT (league, api_source, api_name) DO NOTHING;

-- KBL 샘플 데이터 (남자 농구)
INSERT INTO team_mapping (league, api_source, api_name, standard_name) VALUES
  ('KBL', 'API-Basketball', 'Seoul SK Knights', '서울 SK'),
  ('KBL', 'API-Basketball', 'Ulsan Hyundai Mobis Phoebus', '울산 모비스'),
  ('KBL', 'API-Basketball', 'Suwon KT Sonicboom', '수원 KT'),
  ('KBL', 'API-Basketball', 'Seoul Samsung Thunders', '서울 삼성'),
  ('KBL', 'API-Basketball', 'Busan KCC Egis', '부산 KCC'),
  ('KBL', 'API-Basketball', 'Goyang Carrot Jumpers', '고양 캐롯'),
  ('KBL', 'API-Basketball', 'Anyang KGC Ginseng Corporation', '안양 KGC'),
  ('KBL', 'API-Basketball', 'Changwon LG Sakers', '창원 LG'),
  ('KBL', 'API-Basketball', 'Daegu KOGAS Pegasus', '대구 가스공사'),
  ('KBL', 'API-Basketball', 'Jeonju KCC Egis', '전주 KCC')
ON CONFLICT (league, api_source, api_name) DO NOTHING;

-- WKBL 샘플 데이터 (여자 농구)
INSERT INTO team_mapping (league, api_source, api_name, standard_name) VALUES
  ('WKBL', 'API-Basketball', 'Bucheon Hana OneQ', '부천 하나원큐'),
  ('WKBL', 'API-Basketball', 'Asan Woori Bank Wibee', '아산 우리은행'),
  ('WKBL', 'API-Basketball', 'Yongin Samsung Life Bichumi', '용인 삼성생명'),
  ('WKBL', 'API-Basketball', 'Cheongju KB Stars', '청주 KB스타즈'),
  ('WKBL', 'API-Basketball', 'Incheon Shinhan Bank S-Birds', '인천 신한은행'),
  ('WKBL', 'API-Basketball', 'Busan BNK Sum', '부산 BNK썸')
ON CONFLICT (league, api_source, api_name) DO NOTHING;

-- RLS 정책 (읽기는 모두 허용, 쓰기는 인증된 사용자만)
ALTER TABLE team_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_mapping_read_all" ON team_mapping
  FOR SELECT USING (true);

CREATE POLICY "team_mapping_write_authenticated" ON team_mapping
  FOR ALL USING (auth.role() = 'authenticated');

COMMENT ON TABLE team_mapping IS '리그별 팀 이름 매핑 테이블 - API 이름을 표준 이름으로 변환';
COMMENT ON COLUMN team_mapping.league IS '리그 구분: KOVO, KBL, WKBL, K-LEAGUE';
COMMENT ON COLUMN team_mapping.api_source IS 'API 출처: API-Volleyball, API-Basketball, The Odds API';
COMMENT ON COLUMN team_mapping.api_name IS 'API에서 제공하는 원본 팀 이름';
COMMENT ON COLUMN team_mapping.standard_name IS '우리 시스템의 표준화된 팀 이름';
