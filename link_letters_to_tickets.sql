-- Link letters to tickets based on ticket assignment
-- This ensures letter photos appear in QA ticket details

-- STEP 1: Add task_id column if not exists
ALTER TABLE letters 
ADD COLUMN IF NOT EXISTS task_id UUID;

-- STEP 2: Add foreign key constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'letters_task_id_fkey'
  ) THEN
    ALTER TABLE letters
    ADD CONSTRAINT letters_task_id_fkey 
    FOREIGN KEY (task_id) 
    REFERENCES tasks(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- STEP 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_letters_task_id ON letters(task_id);

-- STEP 4: Link existing letters to tasks based on timestamp
-- This connects letters that were uploaded but don't have task_id set
WITH letter_task_mapping AS (
  SELECT DISTINCT ON (l.id)
    l.id as letter_id,
    t.id as task_id,
    l.created_at as letter_time,
    t.created_at as task_time,
    ABS(EXTRACT(EPOCH FROM (t.created_at - l.created_at))) as time_diff_seconds
  FROM letters l
  CROSS JOIN tasks t
  WHERE l.task_id IS NULL
    AND l.status = 'processed'
    -- Match letters and tasks created within 10 minutes of each other
    AND ABS(EXTRACT(EPOCH FROM (t.created_at - l.created_at))) < 600
  ORDER BY l.id, time_diff_seconds ASC
)
UPDATE letters l
SET task_id = ltm.task_id
FROM letter_task_mapping ltm
WHERE l.id = ltm.letter_id
  AND l.task_id IS NULL;

-- STEP 5: Show results
SELECT 
  l.id as letter_id,
  l.file_name,
  l.task_id,
  t.ticket_no,
  t.title,
  c.name as customer_name,
  c.member_number
FROM letters l
LEFT JOIN tasks t ON l.task_id = t.id
LEFT JOIN customers c ON t.customer_id = c.id
WHERE l.created_at > NOW() - INTERVAL '24 hours'
ORDER BY l.created_at DESC
LIMIT 20;

-- Success message
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM letters
  WHERE task_id IS NOT NULL
    AND created_at > NOW() - INTERVAL '24 hours';
  
  RAISE NOTICE '✅ Letters table setup complete!';
  RAISE NOTICE '✅ task_id column added and indexed';
  RAISE NOTICE '✅ Existing letters linked to tasks';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Recent letters linked: % letters', updated_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Check the results above to verify letter-task connections';
END $$;
