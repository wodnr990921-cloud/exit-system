-- Add "letter" category to task_items_category_check constraint

-- 1. Drop the existing constraint
ALTER TABLE task_items DROP CONSTRAINT IF EXISTS task_items_category_check;

-- 2. Add the new constraint with "letter" category included
ALTER TABLE task_items ADD CONSTRAINT task_items_category_check 
CHECK (category IN ('book', 'product', 'inquiry', 'order', 'return', 'point', 'letter'));

-- 3. Verify the constraint
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'task_items'::regclass
  AND contype = 'c'
  AND conname LIKE '%category%';

-- 4. Show current category usage
SELECT DISTINCT 
  category,
  COUNT(*) as count
FROM task_items
GROUP BY category
ORDER BY count DESC;
