-- 업무보고 시스템 스키마 (v2)
-- 2026-01-14
-- 출퇴근, 소모품 사용, 경비 지출, 전달사항 통합 관리

-- =====================================================
-- 1. 업무보고 메인 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_work_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  report_date DATE NOT NULL,
  
  -- 출퇴근 기록
  clock_in_time TIMESTAMP WITH TIME ZONE,
  clock_out_time TIMESTAMP WITH TIME ZONE,
  work_hours DECIMAL(4, 2), -- 근무 시간 (자동 계산)
  
  -- 소모품 사용 내역 (JSON 배열)
  supplies_used JSONB DEFAULT '[]'::jsonb,
  -- 예시: [{"code": "STAMP-001", "name": "우표 80원", "quantity": 10, "unit_price": 80}]
  
  -- 경비 지출 내역 (JSON 배열)
  expenses JSONB DEFAULT '[]'::jsonb,
  -- 예시: [{"category": "교통비", "item": "택시비", "amount": 15000, "receipt_url": "..."}]
  
  -- 전달사항
  handover_notes TEXT,
  
  -- 메타데이터
  total_supply_cost DECIMAL(10, 2) DEFAULT 0, -- 소모품 총액
  total_expense_amount DECIMAL(10, 2) DEFAULT 0, -- 경비 총액
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, report_date) -- 한 사람당 하루에 한 개의 보고서만
);

-- =====================================================
-- 2. 소모품 마스터 테이블 (관리자가 등록)
-- =====================================================
CREATE TABLE IF NOT EXISTS supply_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL, -- 예: STAMP-001, ENV-A4
  name VARCHAR(200) NOT NULL, -- 예: 우표 80원, A4 봉투
  category VARCHAR(100), -- 예: 우표, 봉투, 포장재, 문구류
  unit VARCHAR(20) DEFAULT '개', -- 단위: 개, 장, 박스 등
  unit_price DECIMAL(10, 2) NOT NULL, -- 단가
  current_stock INT DEFAULT 0, -- 현재 재고
  min_stock INT DEFAULT 0, -- 최소 재고 (알림용)
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. 인덱스
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_work_reports_user_date ON daily_work_reports(user_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_work_reports_date ON daily_work_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_work_reports_status ON daily_work_reports(status);
CREATE INDEX IF NOT EXISTS idx_work_reports_clock_in ON daily_work_reports(clock_in_time);
CREATE INDEX IF NOT EXISTS idx_supply_items_code ON supply_items(code);
CREATE INDEX IF NOT EXISTS idx_supply_items_category ON supply_items(category);
CREATE INDEX IF NOT EXISTS idx_supply_items_active ON supply_items(is_active);

-- =====================================================
-- 4. 자동 업데이트 트리거
-- =====================================================

-- 범용 updated_at 함수
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 업무보고 전용 함수 (근무 시간 계산 포함)
CREATE OR REPLACE FUNCTION update_work_report_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  
  -- 근무 시간 자동 계산
  IF NEW.clock_in_time IS NOT NULL AND NEW.clock_out_time IS NOT NULL THEN
    NEW.work_hours = EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_in_time)) / 3600;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_work_reports_timestamp
  BEFORE UPDATE ON daily_work_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_work_report_timestamp();

CREATE TRIGGER update_supply_items_timestamp
  BEFORE UPDATE ON supply_items
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();

-- =====================================================
-- 5. RLS (Row Level Security)
-- =====================================================
ALTER TABLE daily_work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_items ENABLE ROW LEVEL SECURITY;

-- 직원은 자신의 보고서만 조회/수정 가능
CREATE POLICY "Users can view own work reports"
  ON daily_work_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own work reports"
  ON daily_work_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own work reports"
  ON daily_work_reports FOR UPDATE
  USING (auth.uid() = user_id AND status = 'draft');

-- 관리자는 모든 보고서 조회 및 승인 가능
CREATE POLICY "Admins can view all work reports"
  ON daily_work_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'ceo', 'operator')
    )
  );

CREATE POLICY "Admins can update work reports"
  ON daily_work_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'ceo', 'operator')
    )
  );

-- 소모품 마스터: 모두 조회 가능, 관리자만 수정
CREATE POLICY "Everyone can view active supplies"
  ON supply_items FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage supplies"
  ON supply_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'ceo', 'operator')
    )
  );

-- =====================================================
-- 6. 초기 샘플 소모품 데이터
-- =====================================================
INSERT INTO supply_items (code, name, category, unit, unit_price, current_stock, min_stock, description)
VALUES
  ('STAMP-080', '우표 80원', '우표', '장', 80, 500, 100, '일반 우편 우표'),
  ('STAMP-430', '우표 430원', '우표', '장', 430, 200, 50, '등기 우편 우표'),
  ('ENV-A4', 'A4 봉투', '봉투', '장', 50, 1000, 200, 'A4 서류 봉투'),
  ('ENV-B5', 'B5 봉투', '봉투', '장', 40, 800, 150, 'B5 서류 봉투'),
  ('TAPE-PACK', '포장 테이프', '포장재', '개', 3000, 50, 10, '박스 포장용 테이프'),
  ('BOX-SMALL', '소형 박스', '포장재', '개', 1500, 100, 20, '소형 택배 박스'),
  ('BOX-MEDIUM', '중형 박스', '포장재', '개', 2000, 80, 15, '중형 택배 박스'),
  ('PEN-BLACK', '볼펜 (검정)', '문구류', '자루', 500, 100, 20, '일반 볼펜'),
  ('PAPER-A4', 'A4 용지', '문구류', '박스(500매)', 5000, 30, 5, 'A4 복사용지')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 7. 뷰: 오늘의 출퇴근 현황
-- =====================================================
CREATE OR REPLACE VIEW today_attendance AS
SELECT 
  u.id AS user_id,
  u.name AS user_name,
  u.username,
  u.role,
  dwr.clock_in_time,
  dwr.clock_out_time,
  dwr.work_hours,
  dwr.status,
  CASE 
    WHEN dwr.clock_in_time IS NULL THEN '미출근'
    WHEN dwr.clock_out_time IS NULL THEN '근무중'
    ELSE '퇴근완료'
  END AS attendance_status
FROM users u
LEFT JOIN daily_work_reports dwr ON u.id = dwr.user_id AND dwr.report_date = CURRENT_DATE
WHERE u.role IN ('staff', 'operator', 'admin')
ORDER BY dwr.clock_in_time NULLS LAST;

-- =====================================================
-- 8. 주석
-- =====================================================
COMMENT ON TABLE daily_work_reports IS '일일 업무보고서 (출퇴근, 소모품, 경비, 전달사항)';
COMMENT ON TABLE supply_items IS '소모품 마스터 (관리자가 등록한 소모품 코드)';
COMMENT ON COLUMN daily_work_reports.supplies_used IS 'JSON 배열: [{code, name, quantity, unit_price}]';
COMMENT ON COLUMN daily_work_reports.expenses IS 'JSON 배열: [{category, item, amount, receipt_url}]';
COMMENT ON COLUMN daily_work_reports.handover_notes IS '다음 근무자에게 전달할 사항';
COMMENT ON VIEW today_attendance IS '오늘의 출퇴근 현황 (관리자용)';
