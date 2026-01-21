-- Check what categories are allowed in task_items table

-- 1. Show the CHECK constraint definition
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'task_items'::regclass
  AND contype = 'c'
  AND conname LIKE '%category%';

-- 2. Show existing categories in use
SELECT DISTINCT 
  category,
  COUNT(*) as count
FROM task_items
GROUP BY category
ORDER BY count DESC;
