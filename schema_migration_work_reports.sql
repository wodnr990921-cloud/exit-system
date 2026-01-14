-- =====================================================
-- WORK REPORTS SYSTEM
-- =====================================================

-- Work reports table for employee clock in/out and daily work tracking
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

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_work_reports_employee_id ON work_reports(employee_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_clock_in ON work_reports(clock_in);
CREATE INDEX IF NOT EXISTS idx_work_reports_status ON work_reports(status);
CREATE INDEX IF NOT EXISTS idx_work_reports_created_at ON work_reports(created_at);

-- Add index for date range queries
CREATE INDEX IF NOT EXISTS idx_work_reports_employee_date ON work_reports(employee_id, clock_in DESC);

-- Add trigger to update updated_at timestamp
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

-- Add comments for documentation
COMMENT ON TABLE work_reports IS 'Daily work reports for employees including clock in/out times, consumables used, expenses, and messages';
COMMENT ON COLUMN work_reports.employee_id IS 'Reference to the employee who created this work report';
COMMENT ON COLUMN work_reports.clock_in IS 'Time when employee clocked in';
COMMENT ON COLUMN work_reports.clock_out IS 'Time when employee clocked out';
COMMENT ON COLUMN work_reports.consumables IS 'Array of consumables used: [{item_code, item_name, quantity, unit}]';
COMMENT ON COLUMN work_reports.expenses IS 'Array of expenses: [{description, amount, category}]';
COMMENT ON COLUMN work_reports.message IS 'Notes or messages from the employee about their work day';
COMMENT ON COLUMN work_reports.status IS 'Status of work report: in_progress (clocked in) or completed (clocked out)';

-- Enable Row Level Security
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can view their own work reports
CREATE POLICY work_reports_select_own ON work_reports
    FOR SELECT
    USING (
        auth.uid() = employee_id
    );

-- Policy: Employees can insert their own work reports
CREATE POLICY work_reports_insert_own ON work_reports
    FOR INSERT
    WITH CHECK (
        auth.uid() = employee_id
    );

-- Policy: Employees can update their own work reports
CREATE POLICY work_reports_update_own ON work_reports
    FOR UPDATE
    USING (
        auth.uid() = employee_id
    );

-- Policy: Admins/operators can view all work reports
CREATE POLICY work_reports_select_admin ON work_reports
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'operator', 'ceo')
        )
    );

-- Policy: Admins/operators can update all work reports
CREATE POLICY work_reports_update_admin ON work_reports
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'operator', 'ceo')
        )
    );

-- Create a view for daily work report summaries
CREATE OR REPLACE VIEW work_reports_summary AS
SELECT
    wr.id,
    wr.employee_id,
    u.name as employee_name,
    u.username as employee_username,
    wr.clock_in,
    wr.clock_out,
    CASE
        WHEN wr.clock_out IS NOT NULL THEN
            EXTRACT(EPOCH FROM (wr.clock_out - wr.clock_in)) / 3600
        ELSE NULL
    END as hours_worked,
    jsonb_array_length(wr.consumables) as consumables_count,
    jsonb_array_length(wr.expenses) as expenses_count,
    (
        SELECT COALESCE(SUM((expense->>'amount')::numeric), 0)
        FROM jsonb_array_elements(wr.expenses) AS expense
    ) as total_expenses,
    wr.message,
    wr.status,
    wr.created_at,
    wr.updated_at
FROM work_reports wr
LEFT JOIN users u ON wr.employee_id = u.id;

COMMENT ON VIEW work_reports_summary IS 'Summary view of work reports with calculated fields and employee information';
