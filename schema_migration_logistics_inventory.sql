-- Logistics Inventory System Migration
-- books 테이블에 stock_quantity 컬럼 추가

-- books 테이블에 stock_quantity 컬럼 추가
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'books' AND column_name = 'stock_quantity'
  ) THEN
    ALTER TABLE books ADD COLUMN stock_quantity INTEGER DEFAULT 0;
  END IF;
END $$;

-- 인덱스 생성 (재고 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_books_stock_quantity ON books(stock_quantity) WHERE stock_quantity > 0;
