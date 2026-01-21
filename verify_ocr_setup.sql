-- Quick verification: Check if OCR is working properly

-- 1. Show all OCR-related columns
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'letters'
  AND (column_name LIKE 'ocr%' OR column_name IN ('file_path', 'file_name', 'status'))
ORDER BY column_name;

-- 2. Show recent letters with OCR data
SELECT 
  id,
  file_name,
  CASE 
    WHEN ocr_text IS NOT NULL AND LENGTH(ocr_text) > 0 THEN '✅ ' || LENGTH(ocr_text) || '자'
    ELSE '❌ 없음'
  END as ocr_text_status,
  CASE 
    WHEN ocr_summary IS NOT NULL AND LENGTH(ocr_summary) > 0 THEN '✅ ' || LENGTH(ocr_summary) || '자'
    ELSE '❌ 없음'
  END as ocr_summary_status,
  ocr_confidence,
  ocr_image_type,
  status,
  created_at
FROM letters
ORDER BY created_at DESC
LIMIT 10;

-- 3. Statistics
SELECT 
  COUNT(*) as total_letters,
  COUNT(CASE WHEN ocr_text IS NOT NULL AND LENGTH(ocr_text) > 0 THEN 1 END) as has_ocr_text,
  COUNT(CASE WHEN ocr_summary IS NOT NULL AND LENGTH(ocr_summary) > 0 THEN 1 END) as has_ocr_summary,
  ROUND(AVG(CASE WHEN ocr_confidence > 0 THEN ocr_confidence END)::numeric, 1) as avg_confidence
FROM letters;
