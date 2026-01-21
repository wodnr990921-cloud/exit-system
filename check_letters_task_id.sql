-- Check if task_id column exists in letters table
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'letters' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- If task_id exists, check recent letters
SELECT 
  id,
  file_name,
  task_id,
  status,
  created_at
FROM letters
ORDER BY created_at DESC
LIMIT 10;

-- Check if the recently assigned task has letters linked
SELECT 
  t.id as task_id,
  t.ticket_no,
  t.title,
  t.created_at as task_created,
  COUNT(l.id) as letter_count
FROM tasks t
LEFT JOIN letters l ON l.task_id = t.id
WHERE t.created_at > NOW() - INTERVAL '1 hour'
GROUP BY t.id, t.ticket_no, t.title, t.created_at
ORDER BY t.created_at DESC
LIMIT 5;
