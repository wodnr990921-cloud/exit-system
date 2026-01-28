-- ============================================================================
-- Audit Logs System
-- ============================================================================
-- Purpose: Track all critical actions in the system for compliance and debugging
-- Created: 2026-01-28
-- ============================================================================

-- Drop existing table if exists
DROP TABLE IF EXISTS audit_logs CASCADE;

-- Create audit_logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Action details
  action_type TEXT NOT NULL, -- e.g., 'point_charge', 'task_approve', 'betting_settle', 'user_create'
  action_category TEXT NOT NULL, -- e.g., 'finance', 'task', 'betting', 'user', 'system'
  description TEXT NOT NULL,

  -- Who performed the action
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  performed_by_role TEXT, -- Store role at time of action
  performed_by_name TEXT, -- Store name at time of action

  -- What was affected
  target_type TEXT, -- e.g., 'customer', 'task', 'betting', 'user'
  target_id UUID,
  target_identifier TEXT, -- Human-readable identifier (ticket_no, member_number, etc.)

  -- Additional context
  old_value JSONB, -- Previous state (for updates)
  new_value JSONB, -- New state (for updates/creates)
  metadata JSONB, -- Additional context data

  -- Request details
  ip_address TEXT,
  user_agent TEXT,

  -- Status
  status TEXT DEFAULT 'success', -- 'success', 'failed', 'partial'
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_audit_logs_performed_by ON audit_logs(performed_by);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_action_category ON audit_logs(action_category);
CREATE INDEX idx_audit_logs_target_type ON audit_logs(target_type);
CREATE INDEX idx_audit_logs_target_id ON audit_logs(target_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_status ON audit_logs(status);

-- Combined index for filtering by category and date
CREATE INDEX idx_audit_logs_category_date ON audit_logs(action_category, created_at DESC);

-- Combined index for filtering by user and date
CREATE INDEX idx_audit_logs_user_date ON audit_logs(performed_by, created_at DESC);

-- RLS Policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin and CEO can view all audit logs
CREATE POLICY "Admin and CEO can view all audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'ceo')
    )
  );

-- Operators can view logs in their categories
CREATE POLICY "Operators can view relevant audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'operator'
    )
    AND action_category IN ('task', 'finance', 'betting')
  );

-- Staff can view their own actions
CREATE POLICY "Staff can view their own audit logs"
  ON audit_logs FOR SELECT
  USING (
    performed_by = auth.uid()
  );

-- System can insert audit logs (no user restrictions)
CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- No one can update or delete audit logs (immutable)
-- This ensures audit trail integrity

-- ============================================================================
-- Helper Function: Create Audit Log
-- ============================================================================

CREATE OR REPLACE FUNCTION create_audit_log(
  p_action_type TEXT,
  p_action_category TEXT,
  p_description TEXT,
  p_performed_by UUID,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_target_identifier TEXT DEFAULT NULL,
  p_old_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_status TEXT DEFAULT 'success',
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
  v_user_role TEXT;
  v_user_name TEXT;
BEGIN
  -- Get user info
  SELECT role, name INTO v_user_role, v_user_name
  FROM users
  WHERE id = p_performed_by;

  -- Insert audit log
  INSERT INTO audit_logs (
    action_type,
    action_category,
    description,
    performed_by,
    performed_by_role,
    performed_by_name,
    target_type,
    target_id,
    target_identifier,
    old_value,
    new_value,
    metadata,
    status,
    error_message,
    created_at
  ) VALUES (
    p_action_type,
    p_action_category,
    p_description,
    p_performed_by,
    v_user_role,
    v_user_name,
    p_target_type,
    p_target_id,
    p_target_identifier,
    p_old_value,
    p_new_value,
    p_metadata,
    p_status,
    p_error_message,
    NOW()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ============================================================================
-- Sample Usage Examples (commented out)
-- ============================================================================

/*
-- Example 1: Log a point charge
SELECT create_audit_log(
  'point_charge',
  'finance',
  '회원에게 10000 포인트 충전',
  '123e4567-e89b-12d3-a456-426614174000', -- performed_by user_id
  'customer',
  '123e4567-e89b-12d3-a456-426614174001', -- target customer_id
  'M-0012',
  NULL, -- no old value for charge
  '{"amount": 10000, "category": "general", "balance_after": 50000}'::jsonb,
  '{"transaction_id": "tx_123", "note": "Initial deposit"}'::jsonb
);

-- Example 2: Log a task approval
SELECT create_audit_log(
  'task_approve',
  'task',
  '티켓 TK-0045 승인 완료',
  '123e4567-e89b-12d3-a456-426614174000',
  'task',
  '123e4567-e89b-12d3-a456-426614174002',
  'TK-0045',
  '{"status": "pending"}'::jsonb,
  '{"status": "approved"}'::jsonb,
  '{"total_amount": 15000, "approval_note": "Approved by manager"}'::jsonb
);

-- Example 3: Log a betting settlement
SELECT create_audit_log(
  'betting_settle',
  'betting',
  '베팅 BT-0089 정산 완료 (승리)',
  '123e4567-e89b-12d3-a456-426614174000',
  'betting',
  '123e4567-e89b-12d3-a456-426614174003',
  'BT-0089',
  '{"status": "pending", "result": null}'::jsonb,
  '{"status": "won", "result": "win", "payout": 25000}'::jsonb,
  '{"original_odds": 2.5, "adjusted_odds": 2.4, "bet_amount": 10000}'::jsonb
);

-- Query examples:

-- Get all finance-related logs from last 7 days
SELECT * FROM audit_logs
WHERE action_category = 'finance'
AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Get all actions by a specific user
SELECT * FROM audit_logs
WHERE performed_by = '123e4567-e89b-12d3-a456-426614174000'
ORDER BY created_at DESC;

-- Get all failed actions
SELECT * FROM audit_logs
WHERE status = 'failed'
ORDER BY created_at DESC;

-- Get audit trail for a specific customer
SELECT * FROM audit_logs
WHERE target_type = 'customer'
AND target_id = '123e4567-e89b-12d3-a456-426614174001'
ORDER BY created_at DESC;
*/

-- ============================================================================
-- Automatic Audit Logging Triggers (Optional)
-- ============================================================================

-- Trigger function to auto-log critical table changes
CREATE OR REPLACE FUNCTION auto_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_action_type TEXT;
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action_type := TG_TABLE_NAME || '_create';
  ELSIF TG_OP = 'UPDATE' THEN
    v_action_type := TG_TABLE_NAME || '_update';
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := TG_TABLE_NAME || '_delete';
  END IF;

  -- Log the action
  PERFORM create_audit_log(
    v_action_type,
    'system',
    format('%s %s on %s', TG_OP, TG_TABLE_NAME, COALESCE(NEW.id::text, OLD.id::text)),
    v_user_id,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    NULL,
    CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW)::jsonb ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the main operation if audit logging fails
    RAISE WARNING 'Audit log trigger failed: %', SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Optional: Add triggers to critical tables
-- Uncomment to enable automatic audit logging for these tables:

/*
-- Audit customers table changes (CEO only)
CREATE TRIGGER audit_customers_changes
  AFTER INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW EXECUTE FUNCTION auto_audit_trigger();

-- Audit users table changes (CEO only)
CREATE TRIGGER audit_users_changes
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION auto_audit_trigger();
*/

COMMENT ON TABLE audit_logs IS 'Immutable audit trail for all critical system actions';
COMMENT ON FUNCTION create_audit_log IS 'Helper function to create audit log entries with user context';
COMMENT ON FUNCTION auto_audit_trigger IS 'Trigger function for automatic audit logging of table changes';
