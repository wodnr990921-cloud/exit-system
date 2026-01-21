-- Check if letters are being stored properly in Supabase
-- This will verify letter uploads, file paths, and task connections

-- PART 1: Check recent letter uploads
SELECT 
  l.id,
  l.file_name,
  l.file_path,
  l.task_id,
  l.status,
  l.created_at,
  l.user_id,
  -- Check if file exists in storage
  CASE 
    WHEN l.file_path IS NOT NULL THEN '✅ Path exists'
    ELSE '❌ No path'
  END as storage_check,
  -- Check task connection
  CASE 
    WHEN l.task_id IS NOT NULL THEN '✅ Connected'
    ELSE '❌ Not connected'
  END as task_connection
FROM letters l
ORDER BY l.created_at DESC
LIMIT 20;

-- PART 2: Check letters with task connections
SELECT 
  l.id as letter_id,
  l.file_name,
  l.file_path,
  l.created_at as letter_created,
  t.id as task_id,
  t.ticket_no,
  t.title,
  t.created_at as task_created,
  c.name as customer_name,
  c.member_number
FROM letters l
LEFT JOIN tasks t ON l.task_id = t.id
LEFT JOIN customers c ON t.customer_id = c.id
WHERE l.created_at > NOW() - INTERVAL '24 hours'
ORDER BY l.created_at DESC;

-- PART 3: Check specific task and its letters
-- Replace 'YOUR-TASK-ID-HERE' with actual task ID from QA page
/*
SELECT 
  t.id as task_id,
  t.ticket_no,
  t.title,
  t.created_at,
  json_agg(
    json_build_object(
      'letter_id', l.id,
      'file_name', l.file_name,
      'file_path', l.file_path,
      'created_at', l.created_at
    )
  ) as letters
FROM tasks t
LEFT JOIN letters l ON l.task_id = t.id
WHERE t.id = 'YOUR-TASK-ID-HERE'
GROUP BY t.id, t.ticket_no, t.title, t.created_at;
*/

-- PART 4: Count letters by status
SELECT 
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN task_id IS NOT NULL THEN 1 END) as connected_count,
  COUNT(CASE WHEN task_id IS NULL THEN 1 END) as unconnected_count
FROM letters
GROUP BY status
ORDER BY status;

-- PART 5: Check if file_path format is correct
SELECT 
  l.id,
  l.file_name,
  l.file_path,
  -- Check if path starts correctly
  CASE 
    WHEN l.file_path LIKE 'letters/%' THEN '✅ Correct format'
    WHEN l.file_path IS NULL THEN '❌ NULL path'
    ELSE '⚠️ Wrong format: ' || l.file_path
  END as path_check,
  l.created_at
FROM letters l
ORDER BY l.created_at DESC
LIMIT 10;

-- PART 6: Check storage bucket
SELECT 
  name,
  id,
  created_at,
  updated_at
FROM storage.buckets
WHERE name = 'letters';

-- Summary
DO $$
DECLARE
  total_letters INTEGER;
  connected_letters INTEGER;
  recent_letters INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_letters FROM letters;
  SELECT COUNT(*) INTO connected_letters FROM letters WHERE task_id IS NOT NULL;
  SELECT COUNT(*) INTO recent_letters FROM letters WHERE created_at > NOW() - INTERVAL '24 hours';
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 === LETTERS STORAGE SUMMARY ===';
  RAISE NOTICE '📝 Total letters in database: %', total_letters;
  RAISE NOTICE '🔗 Letters connected to tasks: % (%.1f%%)', 
    connected_letters, 
    CASE WHEN total_letters > 0 THEN (connected_letters::float / total_letters * 100) ELSE 0 END;
  RAISE NOTICE '🆕 Letters uploaded in last 24h: %', recent_letters;
  RAISE NOTICE '';
  
  IF total_letters = 0 THEN
    RAISE NOTICE '❌ NO LETTERS FOUND! Letters are not being saved to database.';
  ELSIF connected_letters = 0 THEN
    RAISE NOTICE '⚠️ Letters exist but NONE are connected to tasks!';
  ELSE
    RAISE NOTICE '✅ Letters are being saved and connected properly.';
  END IF;
  RAISE NOTICE '';
END $$;
