-- Add task_id column to letters table to link letters to tasks
-- This allows viewing letter photos in QA ticket details

-- Step 1: Add task_id column (nullable initially)
ALTER TABLE letters 
ADD COLUMN IF NOT EXISTS task_id UUID;

-- Step 2: Add foreign key constraint
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

-- Step 3: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_letters_task_id ON letters(task_id);

-- Step 4: Add comment
COMMENT ON COLUMN letters.task_id IS 'Links letter to a task for displaying in ticket details';

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'letters' 
  AND column_name = 'task_id';

-- Check foreign key
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'letters'
  AND kcu.column_name = 'task_id';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ task_id column added to letters table successfully!';
  RAISE NOTICE '✅ Foreign key constraint created';
  RAISE NOTICE '✅ Index created for performance';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Now letters can be linked to tasks:';
  RAISE NOTICE '   letters.task_id → tasks.id';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next steps:';
  RAISE NOTICE '   1. Existing letters have task_id = NULL (OK)';
  RAISE NOTICE '   2. New letter assignments will automatically set task_id';
  RAISE NOTICE '   3. QA ticket details can now display letter photos';
END $$;
