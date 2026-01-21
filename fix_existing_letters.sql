-- Fix existing letters that were assigned before task_id column was added
-- This updates letters.task_id based on when they were created and assigned

-- Step 1: Find letters that were created recently but have no task_id
SELECT 
  l.id as letter_id,
  l.file_name,
  l.created_at as letter_created,
  l.task_id as current_task_id,
  t.id as matching_task_id,
  t.ticket_no,
  t.title
FROM letters l
LEFT JOIN tasks t ON t.created_at::date = l.created_at::date
  AND l.task_id IS NULL
  AND l.status = 'processed'
WHERE l.created_at > NOW() - INTERVAL '24 hours'
  AND l.task_id IS NULL
ORDER BY l.created_at DESC;

-- Step 2: If you see matching tasks above, manually link them
-- Example: Update specific letter to link to a task
-- UPDATE letters 
-- SET task_id = 'YOUR-TASK-ID-HERE'
-- WHERE id = 'YOUR-LETTER-ID-HERE';

-- Step 3: Or automatically link recent letters to recent tasks
-- (ONLY RUN THIS IF YOU'RE SURE - it links by timestamp proximity)
/*
WITH recent_assignments AS (
  SELECT 
    l.id as letter_id,
    t.id as task_id,
    ROW_NUMBER() OVER (PARTITION BY l.id ORDER BY ABS(EXTRACT(EPOCH FROM (t.created_at - l.created_at)))) as rn
  FROM letters l
  CROSS JOIN tasks t
  WHERE l.task_id IS NULL
    AND l.status = 'processed'
    AND l.created_at > NOW() - INTERVAL '1 hour'
    AND t.created_at > NOW() - INTERVAL '1 hour'
    AND ABS(EXTRACT(EPOCH FROM (t.created_at - l.created_at))) < 300  -- within 5 minutes
)
UPDATE letters l
SET task_id = ra.task_id
FROM recent_assignments ra
WHERE l.id = ra.letter_id
  AND ra.rn = 1;
*/

-- Step 4: Verify the update
SELECT 
  l.id as letter_id,
  l.file_name,
  l.task_id,
  t.ticket_no,
  t.title,
  c.name as customer_name
FROM letters l
LEFT JOIN tasks t ON l.task_id = t.id
LEFT JOIN customers c ON t.customer_id = c.id
WHERE l.created_at > NOW() - INTERVAL '1 hour'
ORDER BY l.created_at DESC;
