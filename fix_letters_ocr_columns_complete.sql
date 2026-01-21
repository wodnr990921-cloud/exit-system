-- Add ALL missing OCR-related columns to letters table
-- Run this to ensure complete OCR functionality

-- Step 1: Add ocr_summary column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'letters' AND column_name = 'ocr_summary'
  ) THEN
    ALTER TABLE letters ADD COLUMN ocr_summary TEXT;
    RAISE NOTICE '✅ Added ocr_summary column';
  ELSE
    RAISE NOTICE '⚠️ ocr_summary already exists';
  END IF;
END $$;

-- Step 2: Add ocr_image_type column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'letters' AND column_name = 'ocr_image_type'
  ) THEN
    ALTER TABLE letters ADD COLUMN ocr_image_type TEXT;
    RAISE NOTICE '✅ Added ocr_image_type column';
  ELSE
    RAISE NOTICE '⚠️ ocr_image_type already exists';
  END IF;
END $$;

-- Step 3: Add ocr_confidence column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'letters' AND column_name = 'ocr_confidence'
  ) THEN
    ALTER TABLE letters ADD COLUMN ocr_confidence INTEGER DEFAULT 0;
    RAISE NOTICE '✅ Added ocr_confidence column';
  ELSE
    RAISE NOTICE '⚠️ ocr_confidence already exists';
  END IF;
END $$;

-- Step 4: Add ocr_prohibited_content column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'letters' AND column_name = 'ocr_prohibited_content'
  ) THEN
    ALTER TABLE letters ADD COLUMN ocr_prohibited_content TEXT;
    RAISE NOTICE '✅ Added ocr_prohibited_content column';
  ELSE
    RAISE NOTICE '⚠️ ocr_prohibited_content already exists';
  END IF;
END $$;

-- Step 5: Copy existing ocr_text to ocr_summary (if available)
UPDATE letters 
SET ocr_summary = LEFT(ocr_text, 200)
WHERE ocr_text IS NOT NULL 
  AND ocr_text != ''
  AND (ocr_summary IS NULL OR ocr_summary = '');

-- Step 6: Set default values for existing records
UPDATE letters 
SET ocr_image_type = 'LETTER_CONTENT'
WHERE ocr_image_type IS NULL;

UPDATE letters 
SET ocr_confidence = 50
WHERE ocr_confidence IS NULL OR ocr_confidence = 0;

-- Verify: Show updated column structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'letters'
  AND column_name LIKE 'ocr%'
ORDER BY column_name;

-- Verify: Show sample data
SELECT 
  id,
  file_name,
  LEFT(ocr_text, 40) as ocr_text_preview,
  LEFT(ocr_summary, 40) as ocr_summary_preview,
  ocr_confidence,
  ocr_image_type,
  created_at
FROM letters
ORDER BY created_at DESC
LIMIT 10;

-- Summary
DO $$
DECLARE
  total_letters INTEGER;
  letters_with_ocr INTEGER;
  letters_with_summary INTEGER;
  avg_confidence NUMERIC;
BEGIN
  SELECT COUNT(*) INTO total_letters FROM letters;
  SELECT COUNT(*) INTO letters_with_ocr FROM letters WHERE ocr_text IS NOT NULL AND ocr_text != '';
  SELECT COUNT(*) INTO letters_with_summary FROM letters WHERE ocr_summary IS NOT NULL AND ocr_summary != '';
  SELECT ROUND(AVG(ocr_confidence)::numeric, 1) INTO avg_confidence FROM letters WHERE ocr_confidence > 0;
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 === OCR COLUMNS UPDATE COMPLETE ===';
  RAISE NOTICE '📝 Total letters: %', total_letters;
  RAISE NOTICE '🔤 Letters with OCR text: %', letters_with_ocr;
  RAISE NOTICE '📄 Letters with summary: %', letters_with_summary;
  RAISE NOTICE '📈 Average confidence: %', COALESCE(avg_confidence, 0);
  RAISE NOTICE '';
  RAISE NOTICE '✅ All OCR columns are now ready!';
  RAISE NOTICE '';
END $$;
