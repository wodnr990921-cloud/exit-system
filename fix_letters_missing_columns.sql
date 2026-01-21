-- Add missing columns to letters table for OCR functionality
-- This will add ocr_summary and ocr_image_type columns

-- Step 1: Add ocr_summary column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'letters' AND column_name = 'ocr_summary'
  ) THEN
    ALTER TABLE letters ADD COLUMN ocr_summary TEXT;
    RAISE NOTICE '✅ Added ocr_summary column';
  ELSE
    RAISE NOTICE '⚠️ ocr_summary column already exists';
  END IF;
END $$;

-- Step 2: Add ocr_image_type column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'letters' AND column_name = 'ocr_image_type'
  ) THEN
    ALTER TABLE letters ADD COLUMN ocr_image_type TEXT;
    RAISE NOTICE '✅ Added ocr_image_type column';
  ELSE
    RAISE NOTICE '⚠️ ocr_image_type column already exists';
  END IF;
END $$;

-- Step 3: Copy existing ocr_text to ocr_summary (if ocr_text has data)
UPDATE letters 
SET ocr_summary = ocr_text 
WHERE ocr_text IS NOT NULL 
  AND (ocr_summary IS NULL OR ocr_summary = '');

-- Step 4: Set default ocr_image_type based on existing data
-- You can adjust this logic based on your needs
UPDATE letters 
SET ocr_image_type = 'LETTER_CONTENT'
WHERE ocr_image_type IS NULL;

-- Verification: Show updated structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'letters'
  AND column_name IN ('ocr_text', 'ocr_summary', 'ocr_image_type', 'task_id')
ORDER BY column_name;

-- Verification: Show sample data
SELECT 
  id,
  file_name,
  task_id,
  CASE 
    WHEN task_id IS NOT NULL THEN '✅ Connected'
    ELSE '❌ Not connected'
  END as task_status,
  LEFT(ocr_text, 50) as ocr_text_preview,
  LEFT(ocr_summary, 50) as ocr_summary_preview,
  ocr_image_type,
  created_at
FROM letters
ORDER BY created_at DESC
LIMIT 10;

-- Final summary
DO $$
DECLARE
  total_letters INTEGER;
  letters_with_task INTEGER;
  letters_with_ocr INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_letters FROM letters;
  SELECT COUNT(*) INTO letters_with_task FROM letters WHERE task_id IS NOT NULL;
  SELECT COUNT(*) INTO letters_with_ocr FROM letters WHERE ocr_summary IS NOT NULL;
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 === LETTERS TABLE UPDATE SUMMARY ===';
  RAISE NOTICE '📝 Total letters: %', total_letters;
  RAISE NOTICE '🔗 Letters with task_id: %', letters_with_task;
  RAISE NOTICE '📄 Letters with OCR data: %', letters_with_ocr;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Letters table structure updated successfully!';
  RAISE NOTICE '';
END $$;
