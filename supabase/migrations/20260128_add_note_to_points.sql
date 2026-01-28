-- Migration: Add note column to points table
-- Created: 2026-01-28

-- Add note column
ALTER TABLE points ADD COLUMN IF NOT EXISTS note TEXT;

-- Add column comment
COMMENT ON COLUMN points.note IS 'Point transaction memo';

-- Create index
CREATE INDEX IF NOT EXISTS idx_points_note ON points(note) WHERE note IS NOT NULL;
