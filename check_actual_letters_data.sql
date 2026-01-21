-- Check if actual letter data exists and is properly stored
-- This will show real data, not just schema

-- PART 1: Show ALL letters in database
SELECT 
  id,
  file_name,
  file_path,
  task_id,
  status,
  created_at,
  CASE 
    WHEN task_id IS NOT NULL THEN '✅ task_id 있음'
    ELSE '❌ task_id 없음'
  END as connection_status
FROM letters
ORDER BY created_at DESC;

-- PART 2: Show letters from last 24 hours
SELECT 
  COUNT(*) as total_recent_letters,
  COUNT(CASE WHEN task_id IS NOT NULL THEN 1 END) as with_task_id,
  COUNT(CASE WHEN task_id IS NULL THEN 1 END) as without_task_id
FROM letters
WHERE created_at > NOW() - INTERVAL '24 hours';

-- PART 3: Show tasks from last 24 hours and their letters
SELECT 
  t.id as task_id,
  t.ticket_no,
  t.title,
  t.created_at as task_created,
  COUNT(l.id) as letter_count,
  string_agg(l.file_name, ', ') as letter_files
FROM tasks t
LEFT JOIN letters l ON l.task_id = t.id
WHERE t.created_at > NOW() - INTERVAL '24 hours'
GROUP BY t.id, t.ticket_no, t.title, t.created_at
ORDER BY t.created_at DESC;

-- PART 4: Find orphaned letters (no task_id)
SELECT 
  id,
  file_name,
  file_path,
  created_at,
  '⚠️ 이 편지는 티켓에 연결되지 않았습니다' as warning
FROM letters
WHERE task_id IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- Summary
DO $$
DECLARE
  total_letters INTEGER;
  letters_with_task INTEGER;
  letters_without_task INTEGER;
  total_tasks INTEGER;
  tasks_with_letters INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_letters FROM letters;
  SELECT COUNT(*) INTO letters_with_task FROM letters WHERE task_id IS NOT NULL;
  SELECT COUNT(*) INTO letters_without_task FROM letters WHERE task_id IS NULL;
  SELECT COUNT(*) INTO total_tasks FROM tasks;
  SELECT COUNT(DISTINCT task_id) INTO tasks_with_letters FROM letters WHERE task_id IS NOT NULL;
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 === 실제 데이터 현황 ===';
  RAISE NOTICE '';
  RAISE NOTICE '📝 전체 편지 수: %', total_letters;
  RAISE NOTICE '✅ 티켓에 연결된 편지: %', letters_with_task;
  RAISE NOTICE '❌ 연결 안 된 편지: %', letters_without_task;
  RAISE NOTICE '';
  RAISE NOTICE '🎫 전체 티켓 수: %', total_tasks;
  RAISE NOTICE '📎 편지가 있는 티켓: %', tasks_with_letters;
  RAISE NOTICE '';
  
  IF total_letters = 0 THEN
    RAISE NOTICE '🚨 편지가 하나도 없습니다! 우편실에서 업로드가 안 되고 있습니다.';
  ELSIF letters_without_task = total_letters THEN
    RAISE NOTICE '🚨 모든 편지가 티켓에 연결되지 않았습니다!';
  ELSIF letters_without_task > 0 THEN
    RAISE NOTICE '⚠️ 일부 편지(%)가 티켓에 연결되지 않았습니다.', letters_without_task;
  ELSE
    RAISE NOTICE '✅ 모든 편지가 티켓에 연결되어 있습니다!';
  END IF;
  
  RAISE NOTICE '';
END $$;
