-- =====================================================
-- Complete Database Migration for Exit System
-- =====================================================
-- This migration includes all tables, functions, triggers, and indexes
-- for the complete exit system implementation
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. INMATE MANAGEMENT SYSTEM
-- =====================================================

-- Inmates table (수용자 정보)
CREATE TABLE IF NOT EXISTS inmates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inmate_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    prison_name VARCHAR(100) NOT NULL,
    cell_number VARCHAR(50),
    admission_date DATE,
    expected_release_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'released', 'transferred')),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prison restrictions table (교도소별 금지물품)
CREATE TABLE IF NOT EXISTS prison_restrictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prison_name VARCHAR(100) NOT NULL,
    restriction_type VARCHAR(50) NOT NULL CHECK (restriction_type IN ('prohibited_item', 'quantity_limit', 'size_limit', 'category_restriction')),
    restriction_value TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(prison_name, restriction_type, restriction_value)
);

-- =====================================================
-- 2. BLACKLIST SYSTEM
-- =====================================================

-- Customer flags table (고객 플래그)
CREATE TABLE IF NOT EXISTS customer_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    flag_type VARCHAR(50) NOT NULL CHECK (flag_type IN ('blacklist', 'warning', 'vip', 'fraudulent', 'suspended')),
    reason TEXT NOT NULL,
    flagged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    flagged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    expiry_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. SETTLEMENT SYSTEM
-- =====================================================

-- Add cost columns to task_items table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'task_items' AND column_name = 'cost_price') THEN
        ALTER TABLE task_items ADD COLUMN cost_price DECIMAL(10, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'task_items' AND column_name = 'selling_price') THEN
        ALTER TABLE task_items ADD COLUMN selling_price DECIMAL(10, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'task_items' AND column_name = 'shipping_cost') THEN
        ALTER TABLE task_items ADD COLUMN shipping_cost DECIMAL(10, 2) DEFAULT 0;
    END IF;
END $$;

-- Monthly settlements table (월별 정산)
CREATE TABLE IF NOT EXISTS monthly_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_month DATE NOT NULL UNIQUE,
    total_revenue DECIMAL(12, 2) DEFAULT 0,
    total_cost DECIMAL(12, 2) DEFAULT 0,
    total_shipping_cost DECIMAL(12, 2) DEFAULT 0,
    total_profit DECIMAL(12, 2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'reviewed')),
    calculated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    calculated_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. AUDIT LOG SYSTEM
-- =====================================================

-- Audit logs table (모든 사용자 활동 기록)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'error')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. POINT TRANSACTION REVERSAL
-- =====================================================

-- Add reversal columns to points table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'points' AND column_name = 'is_reversed') THEN
        ALTER TABLE points ADD COLUMN is_reversed BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'points' AND column_name = 'reversed_by') THEN
        ALTER TABLE points ADD COLUMN reversed_by UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'points' AND column_name = 'reversed_at') THEN
        ALTER TABLE points ADD COLUMN reversed_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'points' AND column_name = 'reversal_reason') THEN
        ALTER TABLE points ADD COLUMN reversal_reason TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'points' AND column_name = 'original_transaction_id') THEN
        ALTER TABLE points ADD COLUMN original_transaction_id UUID REFERENCES points(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Reverse point transaction function
CREATE OR REPLACE FUNCTION reverse_point_transaction(
    p_transaction_id UUID,
    p_reversed_by UUID,
    p_reason TEXT
)
RETURNS JSON AS $$
DECLARE
    v_transaction RECORD;
    v_customer_id UUID;
    v_reversal_id UUID;
    v_current_balance INTEGER;
BEGIN
    -- Get original transaction
    SELECT * INTO v_transaction
    FROM points
    WHERE id = p_transaction_id;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Transaction not found'
        );
    END IF;

    -- Check if already reversed
    IF v_transaction.is_reversed THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Transaction already reversed'
        );
    END IF;

    -- Get customer_id
    v_customer_id := v_transaction.customer_id;

    -- Check current balance
    SELECT balance INTO v_current_balance
    FROM customers
    WHERE id = v_customer_id;

    -- For earned points, check if customer has enough balance
    IF v_transaction.transaction_type = 'earned' AND v_current_balance < v_transaction.points THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Insufficient balance to reverse transaction'
        );
    END IF;

    -- Mark original transaction as reversed
    UPDATE points
    SET is_reversed = true,
        reversed_by = p_reversed_by,
        reversed_at = NOW(),
        reversal_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_transaction_id;

    -- Create reversal transaction
    INSERT INTO points (
        customer_id,
        points,
        transaction_type,
        description,
        original_transaction_id,
        created_at,
        updated_at
    ) VALUES (
        v_customer_id,
        -v_transaction.points,
        CASE
            WHEN v_transaction.transaction_type = 'earned' THEN 'reversal_earned'
            WHEN v_transaction.transaction_type = 'used' THEN 'reversal_used'
            ELSE 'reversal'
        END,
        'Reversal: ' || COALESCE(p_reason, 'No reason provided'),
        p_transaction_id,
        NOW(),
        NOW()
    ) RETURNING id INTO v_reversal_id;

    -- Update customer balance
    UPDATE customers
    SET balance = balance - v_transaction.points,
        updated_at = NOW()
    WHERE id = v_customer_id;

    RETURN json_build_object(
        'success', true,
        'reversal_id', v_reversal_id,
        'reversed_amount', v_transaction.points
    );

END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. INVENTORY MANAGEMENT
-- =====================================================

-- Inventory items table (소모품 재고)
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_code VARCHAR(50) UNIQUE NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    current_stock INTEGER DEFAULT 0,
    minimum_stock INTEGER DEFAULT 0,
    unit_cost DECIMAL(10, 2) DEFAULT 0,
    location VARCHAR(100),
    supplier VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory transactions table (재고 거래)
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('in', 'out', 'adjustment', 'return')),
    quantity INTEGER NOT NULL,
    unit_cost DECIMAL(10, 2),
    total_cost DECIMAL(10, 2),
    reference_type VARCHAR(50),
    reference_id UUID,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 7. DOCUMENT RETENTION
-- =====================================================

-- Document retention table (원본 파기)
CREATE TABLE IF NOT EXISTS document_retention (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('order', 'invoice', 'receipt', 'contract', 'photo', 'other')),
    reference_id UUID NOT NULL,
    retention_period_days INTEGER DEFAULT 1825,
    document_date DATE NOT NULL,
    destruction_date DATE,
    status VARCHAR(20) DEFAULT 'retained' CHECK (status IN ('retained', 'pending_destruction', 'destroyed')),
    destroyed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    destroyed_at TIMESTAMP WITH TIME ZONE,
    destruction_method VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 8. RETURNS MANAGEMENT
-- =====================================================

-- Returns table (반송 처리)
CREATE TABLE IF NOT EXISTS returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    return_reason VARCHAR(50) NOT NULL CHECK (return_reason IN ('refused', 'address_unknown', 'moved', 'restricted_item', 'other')),
    return_date DATE NOT NULL,
    return_notes TEXT,
    refund_amount DECIMAL(10, 2) DEFAULT 0,
    refund_status VARCHAR(20) DEFAULT 'pending' CHECK (refund_status IN ('pending', 'approved', 'completed', 'rejected')),
    refund_processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    refund_processed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 9. SYSTEM CONFIGURATION
-- =====================================================

-- System config table (환경 설정)
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    value_type VARCHAR(20) DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
    category VARCHAR(50) NOT NULL,
    description TEXT,
    is_editable BOOLEAN DEFAULT true,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration values
INSERT INTO system_config (config_key, config_value, value_type, category, description, is_editable)
VALUES
    ('point_per_won', '1', 'number', 'points', '1원당 적립되는 포인트', true),
    ('dormant_period_days', '365', 'number', 'points', '휴면 포인트 기간 (일)', true),
    ('confiscation_period_days', '730', 'number', 'points', '포인트 소멸 기간 (일)', true),
    ('document_retention_days', '1825', 'number', 'documents', '문서 보관 기간 (5년)', true),
    ('min_order_amount', '10000', 'number', 'orders', '최소 주문 금액', true),
    ('max_order_amount', '500000', 'number', 'orders', '최대 주문 금액', true),
    ('default_shipping_cost', '3000', 'number', 'shipping', '기본 배송비', true),
    ('free_shipping_threshold', '30000', 'number', 'shipping', '무료 배송 기준 금액', true),
    ('inventory_alert_threshold', '10', 'number', 'inventory', '재고 부족 알림 기준', true),
    ('auto_backup_enabled', 'true', 'boolean', 'system', '자동 백업 활성화', true),
    ('maintenance_mode', 'false', 'boolean', 'system', '유지보수 모드', true),
    ('max_upload_size_mb', '10', 'number', 'system', '최대 업로드 파일 크기 (MB)', true)
ON CONFLICT (config_key) DO NOTHING;

-- =====================================================
-- 10. DORMANT POINTS MANAGEMENT
-- =====================================================

-- Dormant points table (휴면 포인트)
CREATE TABLE IF NOT EXISTS dormant_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    dormant_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'dormant' CHECK (status IN ('dormant', 'confiscated', 'restored')),
    confiscation_date DATE,
    confiscated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    restoration_date DATE,
    restored_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 11. NOTICES AND ANNOUNCEMENTS
-- =====================================================

-- Notices table (공지사항)
CREATE TABLE IF NOT EXISTS notices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    is_popup BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    priority INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to notices if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'notices' AND column_name = 'is_popup') THEN
        ALTER TABLE notices ADD COLUMN is_popup BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'notices' AND column_name = 'start_date') THEN
        ALTER TABLE notices ADD COLUMN start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'notices' AND column_name = 'end_date') THEN
        ALTER TABLE notices ADD COLUMN end_date TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'notices' AND column_name = 'priority') THEN
        ALTER TABLE notices ADD COLUMN priority INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'notices' AND column_name = 'created_by') THEN
        ALTER TABLE notices ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Notice dismissals table (공지사항 "다시 보지 않기" 기록)
CREATE TABLE IF NOT EXISTS notice_dismissals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notice_id UUID NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, notice_id)
);

-- Indexes for notices
CREATE INDEX IF NOT EXISTS idx_notices_active ON notices(is_active, start_date, end_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_notices_popup ON notices(is_popup, is_active) WHERE is_popup = true AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_notice_dismissals_user ON notice_dismissals(user_id);
CREATE INDEX IF NOT EXISTS idx_notice_dismissals_notice ON notice_dismissals(notice_id);

-- Trigger for notices updated_at
DROP TRIGGER IF EXISTS update_notices_updated_at ON notices;
CREATE TRIGGER update_notices_updated_at
    BEFORE UPDATE ON notices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Confiscate dormant points function
CREATE OR REPLACE FUNCTION confiscate_dormant_points(
    p_confiscation_date DATE DEFAULT CURRENT_DATE,
    p_confiscated_by UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_confiscation_period INTEGER;
    v_cutoff_date DATE;
    v_affected_count INTEGER := 0;
    v_total_points INTEGER := 0;
    v_record RECORD;
BEGIN
    -- Get confiscation period from system config
    SELECT config_value::INTEGER INTO v_confiscation_period
    FROM system_config
    WHERE config_key = 'confiscation_period_days';

    -- Default to 730 days (2 years) if not configured
    IF v_confiscation_period IS NULL THEN
        v_confiscation_period := 730;
    END IF;

    -- Calculate cutoff date
    v_cutoff_date := p_confiscation_date - v_confiscation_period;

    -- Process dormant points that need to be confiscated
    FOR v_record IN
        SELECT *
        FROM dormant_points
        WHERE status = 'dormant'
        AND dormant_date <= v_cutoff_date
    LOOP
        -- Update dormant_points record
        UPDATE dormant_points
        SET status = 'confiscated',
            confiscation_date = p_confiscation_date,
            confiscated_by = p_confiscated_by,
            updated_at = NOW()
        WHERE id = v_record.id;

        -- Create a point transaction record
        INSERT INTO points (
            customer_id,
            points,
            transaction_type,
            description,
            created_at,
            updated_at
        ) VALUES (
            v_record.customer_id,
            -v_record.points,
            'confiscated',
            'Dormant points confiscated after ' || v_confiscation_period || ' days',
            NOW(),
            NOW()
        );

        -- Update customer balance
        UPDATE customers
        SET balance = balance - v_record.points,
            updated_at = NOW()
        WHERE id = v_record.customer_id;

        v_affected_count := v_affected_count + 1;
        v_total_points := v_total_points + v_record.points;
    END LOOP;

    RETURN json_build_object(
        'success', true,
        'affected_customers', v_affected_count,
        'total_points_confiscated', v_total_points,
        'cutoff_date', v_cutoff_date
    );

END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INDEXES
-- =====================================================

-- Inmates indexes
CREATE INDEX IF NOT EXISTS idx_inmates_inmate_number ON inmates(inmate_number);
CREATE INDEX IF NOT EXISTS idx_inmates_prison_name ON inmates(prison_name);
CREATE INDEX IF NOT EXISTS idx_inmates_status ON inmates(status);

-- Prison restrictions indexes
CREATE INDEX IF NOT EXISTS idx_prison_restrictions_prison_name ON prison_restrictions(prison_name);
CREATE INDEX IF NOT EXISTS idx_prison_restrictions_is_active ON prison_restrictions(is_active);

-- Customer flags indexes
CREATE INDEX IF NOT EXISTS idx_customer_flags_customer_id ON customer_flags(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_flags_flag_type ON customer_flags(flag_type);
CREATE INDEX IF NOT EXISTS idx_customer_flags_is_active ON customer_flags(is_active);

-- Monthly settlements indexes
CREATE INDEX IF NOT EXISTS idx_monthly_settlements_settlement_month ON monthly_settlements(settlement_month);
CREATE INDEX IF NOT EXISTS idx_monthly_settlements_status ON monthly_settlements(status);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Points indexes for reversal
CREATE INDEX IF NOT EXISTS idx_points_is_reversed ON points(is_reversed);
CREATE INDEX IF NOT EXISTS idx_points_original_transaction_id ON points(original_transaction_id);

-- Inventory items indexes
CREATE INDEX IF NOT EXISTS idx_inventory_items_item_code ON inventory_items(item_code);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_is_active ON inventory_items(is_active);

-- Inventory transactions indexes
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_id ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_transaction_type ON inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON inventory_transactions(created_at DESC);

-- Document retention indexes
CREATE INDEX IF NOT EXISTS idx_document_retention_reference_id ON document_retention(reference_id);
CREATE INDEX IF NOT EXISTS idx_document_retention_status ON document_retention(status);
CREATE INDEX IF NOT EXISTS idx_document_retention_destruction_date ON document_retention(destruction_date);

-- Returns indexes
CREATE INDEX IF NOT EXISTS idx_returns_task_id ON returns(task_id);
CREATE INDEX IF NOT EXISTS idx_returns_refund_status ON returns(refund_status);
CREATE INDEX IF NOT EXISTS idx_returns_return_date ON returns(return_date);

-- System config indexes
CREATE INDEX IF NOT EXISTS idx_system_config_category ON system_config(category);

-- Dormant points indexes
CREATE INDEX IF NOT EXISTS idx_dormant_points_customer_id ON dormant_points(customer_id);
CREATE INDEX IF NOT EXISTS idx_dormant_points_status ON dormant_points(status);
CREATE INDEX IF NOT EXISTS idx_dormant_points_dormant_date ON dormant_points(dormant_date);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables with updated_at column
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND column_name = 'updated_at'
        AND table_name IN (
            'inmates', 'prison_restrictions', 'customer_flags',
            'monthly_settlements', 'inventory_items', 'document_retention',
            'returns', 'system_config', 'dormant_points'
        )
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
            CREATE TRIGGER update_%I_updated_at
                BEFORE UPDATE ON %I
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END $$;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) - Optional
-- =====================================================

-- Enable RLS on sensitive tables
ALTER TABLE customer_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_settlements ENABLE ROW LEVEL SECURITY;

-- Create policies (examples - adjust based on your auth setup)
-- Note: These are placeholder policies. Adjust based on your authentication system.

-- Customer flags policy
DROP POLICY IF EXISTS customer_flags_policy ON customer_flags;
CREATE POLICY customer_flags_policy ON customer_flags
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Audit logs policy (read-only for most users)
DROP POLICY IF EXISTS audit_logs_policy ON audit_logs;
CREATE POLICY audit_logs_policy ON audit_logs
    FOR SELECT
    TO authenticated
    USING (true);

-- Monthly settlements policy (restricted access)
DROP POLICY IF EXISTS monthly_settlements_policy ON monthly_settlements;
CREATE POLICY monthly_settlements_policy ON monthly_settlements
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- VIEWS FOR REPORTING
-- =====================================================

-- Active inmates view
CREATE OR REPLACE VIEW v_active_inmates AS
SELECT
    i.*,
    COUNT(DISTINCT t.id) as total_orders,
    COALESCE(SUM(t.total_amount), 0) as total_spent
FROM inmates i
LEFT JOIN customers c ON c.id = i.customer_id
LEFT JOIN tasks t ON t.member_id = c.id
WHERE i.status = 'active'
GROUP BY i.id;

-- Settlement summary view
CREATE OR REPLACE VIEW v_settlement_summary AS
SELECT
    TO_CHAR(settlement_month, 'YYYY-MM') as month,
    total_revenue,
    total_cost,
    total_shipping_cost,
    total_profit,
    total_orders,
    total_items,
    CASE
        WHEN total_revenue > 0 THEN ROUND((total_profit / total_revenue * 100)::NUMERIC, 2)
        ELSE 0
    END as profit_margin,
    status
FROM monthly_settlements
ORDER BY settlement_month DESC;

-- Inventory alert view (low stock items)
CREATE OR REPLACE VIEW v_inventory_alerts AS
SELECT
    item_code,
    item_name,
    category,
    current_stock,
    minimum_stock,
    (minimum_stock - current_stock) as shortage,
    location,
    supplier
FROM inventory_items
WHERE current_stock <= minimum_stock
AND is_active = true
ORDER BY (minimum_stock - current_stock) DESC;

-- Customer risk view
CREATE OR REPLACE VIEW v_customer_risk AS
SELECT
    c.id,
    c.member_number,
    c.name,
    c.institution,
    COUNT(DISTINCT cf.id) as flag_count,
    STRING_AGG(DISTINCT cf.flag_type, ', ') as flag_types,
    MAX(cf.flagged_at) as latest_flag_date
FROM customers c
INNER JOIN customer_flags cf ON cf.customer_id = c.id
WHERE cf.is_active = true
GROUP BY c.id, c.member_number, c.name, c.institution
ORDER BY flag_count DESC;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE inmates IS 'Stores inmate information for prison order management';
COMMENT ON TABLE prison_restrictions IS 'Defines prohibited items and restrictions per prison';
COMMENT ON TABLE customer_flags IS 'Tracks customer flags including blacklists and warnings';
COMMENT ON TABLE monthly_settlements IS 'Monthly financial settlement records';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail of all system activities';
COMMENT ON TABLE inventory_items IS 'Inventory management for consumable supplies';
COMMENT ON TABLE inventory_transactions IS 'Tracks all inventory movements';
COMMENT ON TABLE document_retention IS 'Manages document lifecycle and destruction';
COMMENT ON TABLE returns IS 'Handles order returns and refunds';
COMMENT ON TABLE system_config IS 'System-wide configuration parameters';
COMMENT ON TABLE dormant_points IS 'Tracks dormant and confiscated customer points';

COMMENT ON FUNCTION reverse_point_transaction IS 'Reverses a point transaction and creates a reversal entry';
COMMENT ON FUNCTION confiscate_dormant_points IS 'Confiscates dormant points after the specified period';

-- =====================================================
-- GRANTS (Optional - adjust based on your roles)
-- =====================================================

-- Grant permissions to authenticated users
-- Note: Adjust these based on your actual role structure

-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'Database migration completed successfully!';
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'Created tables:';
    RAISE NOTICE '  - inmates';
    RAISE NOTICE '  - prison_restrictions';
    RAISE NOTICE '  - customer_flags';
    RAISE NOTICE '  - monthly_settlements';
    RAISE NOTICE '  - audit_logs';
    RAISE NOTICE '  - inventory_items';
    RAISE NOTICE '  - inventory_transactions';
    RAISE NOTICE '  - document_retention';
    RAISE NOTICE '  - returns';
    RAISE NOTICE '  - system_config';
    RAISE NOTICE '  - dormant_points';
    RAISE NOTICE '  - notices';
    RAISE NOTICE '  - notice_dismissals';
    RAISE NOTICE '';
    RAISE NOTICE 'Created functions:';
    RAISE NOTICE '  - reverse_point_transaction()';
    RAISE NOTICE '  - confiscate_dormant_points()';
    RAISE NOTICE '';
    RAISE NOTICE 'Created views:';
    RAISE NOTICE '  - v_active_inmates';
    RAISE NOTICE '  - v_settlement_summary';
    RAISE NOTICE '  - v_inventory_alerts';
    RAISE NOTICE '  - v_customer_risk';
    RAISE NOTICE '=======================================================';
END $$;
