-- =====================================================
-- 출근하기 기능 긴급 수정 - work_reports 테이블 생성
-- =====================================================
-- Supabase SQL Editor에서 실행하세요!
-- =====================================================

-- work_reports 테이블 생성
CREATE TABLE IF NOT EXISTS work_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
    clock_out TIMESTAMP WITH TIME ZONE,
    consumables JSONB DEFAULT '[]'::jsonb,
    expenses JSONB DEFAULT '[]'::jsonb,
    message TEXT,
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_work_reports_employee_id ON work_reports(employee_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_clock_in ON work_reports(clock_in);
CREATE INDEX IF NOT EXISTS idx_work_reports_status ON work_reports(status);
CREATE INDEX IF NOT EXISTS idx_work_reports_employee_date ON work_reports(employee_id, clock_in DESC);

-- Trigger 생성
CREATE OR REPLACE FUNCTION update_work_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_work_reports_updated_at ON work_reports;
CREATE TRIGGER trigger_update_work_reports_updated_at
    BEFORE UPDATE ON work_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_work_reports_updated_at();

-- RLS 활성화
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 직원은 자신의 출근 기록만 조회/생성/수정 가능
DROP POLICY IF EXISTS work_reports_select_own ON work_reports;
CREATE POLICY work_reports_select_own ON work_reports
    FOR SELECT
    USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS work_reports_insert_own ON work_reports;
CREATE POLICY work_reports_insert_own ON work_reports
    FOR INSERT
    WITH CHECK (auth.uid() = employee_id);

DROP POLICY IF EXISTS work_reports_update_own ON work_reports;
CREATE POLICY work_reports_update_own ON work_reports
    FOR UPDATE
    USING (auth.uid() = employee_id);

-- RLS 정책: 관리자는 모든 출근 기록 조회/수정 가능
DROP POLICY IF EXISTS work_reports_select_admin ON work_reports;
CREATE POLICY work_reports_select_admin ON work_reports
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'operator', 'ceo')
        )
    );

DROP POLICY IF EXISTS work_reports_update_admin ON work_reports;
CREATE POLICY work_reports_update_admin ON work_reports
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'operator', 'ceo')
        )
    );

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ work_reports 테이블 생성 완료! 이제 출근하기가 작동합니다.';
END $$;
