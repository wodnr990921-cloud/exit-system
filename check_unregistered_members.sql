-- Check unregistered member patterns

-- 1. Show customers with member_numbers that look like temporary IDs
SELECT 
  id,
  name,
  member_number,
  created_at
FROM customers
WHERE 
  member_number LIKE 'TEMP%' OR
  member_number LIKE '미등록%' OR
  member_number LIKE 'UNREG%' OR
  member_number IS NULL OR
  name LIKE '미등록%' OR
  name = '미등록'
ORDER BY created_at DESC
LIMIT 20;

-- 2. Show tasks with unregistered customers
SELECT 
  t.id,
  t.ticket_no,
  t.customer_id,
  c.name as customer_name,
  c.member_number,
  t.created_at
FROM tasks t
LEFT JOIN customers c ON t.customer_id = c.id
WHERE 
  c.member_number LIKE 'TEMP%' OR
  c.member_number LIKE '미등록%' OR
  c.name LIKE '미등록%' OR
  c.name = '미등록'
ORDER BY t.created_at DESC
LIMIT 10;

-- 3. Show all unique member_number patterns
SELECT 
  SUBSTRING(member_number, 1, 4) as prefix,
  COUNT(*) as count
FROM customers
WHERE member_number IS NOT NULL
GROUP BY prefix
ORDER BY count DESC;
