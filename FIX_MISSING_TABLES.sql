-- =====================================================
-- 누락된 테이블 및 컬럼 수정 스크립트
-- =====================================================
-- Supabase SQL Editor에서 실행하세요!
-- =====================================================

-- 1. work_reports 테이블 생성
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
CREATE INDEX IF NOT EXISTS idx_work_reports_created_at ON work_reports(created_at);
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

-- RLS 정책 생성
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

-- 2. inventory_items 테이블에 누락된 컬럼 추가 (만약 없다면)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_items' AND column_name = 'name'
    ) THEN
        ALTER TABLE inventory_items ADD COLUMN name VARCHAR(255);
        COMMENT ON COLUMN inventory_items.name IS '품목 이름';
    END IF;
END $$;

-- 3. system_config 테이블 생성 (만약 없다면)
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- 관리자만 접근 가능
DROP POLICY IF EXISTS system_config_admin_all ON system_config;
CREATE POLICY system_config_admin_all ON system_config
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'ceo')
        )
    );

-- 4. audit_logs 테이블에 누락된 컬럼 추가 (만약 없다면)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' AND column_name = 'table_name'
    ) THEN
        ALTER TABLE audit_logs ADD COLUMN table_name VARCHAR(100);
        COMMENT ON COLUMN audit_logs.table_name IS '변경된 테이블 이름';
    END IF;
END $$;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ 테이블 생성 및 컬럼 추가 완료!';
END $$;
