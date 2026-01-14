-- ============================================
-- Books 테이블 생성 (도서 관리)
-- ============================================

CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  author VARCHAR(255),
  isbn VARCHAR(50),
  publisher VARCHAR(255),
  price INTEGER DEFAULT 0,
  category VARCHAR(100),
  description TEXT,
  cover_image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_books_title ON books USING GIN (to_tsvector('korean', title));
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_books_is_active ON books(is_active) WHERE is_active = TRUE;

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_books_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_books_updated_at ON books;
CREATE TRIGGER update_books_updated_at
  BEFORE UPDATE ON books
  FOR EACH ROW
  EXECUTE FUNCTION update_books_updated_at();

-- 샘플 데이터 (선택사항)
INSERT INTO books (title, author, isbn, publisher, price, category, description)
VALUES
  ('해리 포터와 마법사의 돌', 'J.K. 롤링', '9788983920683', '문학수첩', 12000, '소설', '해리 포터 시리즈 1권'),
  ('어린 왕자', '생텍쥐페리', '9788932917245', '문학동네', 9000, '소설', '프랑스 문학의 고전'),
  ('1984', '조지 오웰', '9788937460883', '민음사', 11000, '소설', '디스토피아 문학의 고전'),
  ('죄와 벌', '도스토옙스키', '9788937462726', '민음사', 15000, '소설', '러시아 문학의 걸작'),
  ('총, 균, 쇠', '재레드 다이아몬드', '9788934942900', '김영사', 23000, '역사', '문명의 발전을 다룬 역사서')
ON CONFLICT DO NOTHING;

-- 검증 쿼리
/*
SELECT * FROM books LIMIT 10;
*/
