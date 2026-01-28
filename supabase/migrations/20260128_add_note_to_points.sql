-- Migration: Add note column to points table
-- Created: 2026-01-28
-- Description: 포인트 거래에 메모를 추가할 수 있도록 note 컬럼 추가

-- Add note column to points table
ALTER TABLE points
ADD COLUMN IF NOT EXISTS note TEXT;

-- Add comment to the column
COMMENT ON COLUMN points.note IS '포인트 지급/차감 사유 또는 메모';

-- Create index for better search performance (optional)
CREATE INDEX IF NOT EXISTS idx_points_note ON points(note) WHERE note IS NOT NULL;

-- Example usage:
-- INSERT INTO points (customer_id, amount, type, category, status, note)
-- VALUES ('uuid-here', 10000, 'charge', 'general', 'pending', '월 정산 지급');
