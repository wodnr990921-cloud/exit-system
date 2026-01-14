  `-- Supabase Database Schema
  -- Users, Books, Points, Tasks, Senders 테이블 생성

  -- Users 테이블 생성
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- username 컬럼 추가
  DO $$ 
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'username'
    ) THEN
      ALTER TABLE users ADD COLUMN username VARCHAR(255);
    END IF;
  END $$;

  -- role 컬럼 추가
  DO $$ 
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
      ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'operator';
    END IF;
  END $$;

  -- role 제약조건 추가
  ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role;
  DO $$ 
  BEGIN
    PERFORM 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'role';
    
    IF FOUND THEN
      ALTER TABLE users ADD CONSTRAINT valid_role CHECK (role IN ('ceo', 'operator', 'staff', 'admin', 'employee'));
    END IF;
  EXCEPTION
    WHEN undefined_column THEN NULL;
    WHEN duplicate_object THEN NULL;
  END $$;

  -- 기존 사용자에게 username 설정 (없는 경우)
  UPDATE users SET username = SPLIT_PART(email, '@', 1) WHERE username IS NULL;

  -- username 제약조건 추가
  DO $$ 
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'username'
    ) THEN
      BEGIN
        ALTER TABLE users ALTER COLUMN username SET NOT NULL;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
      
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key'
      ) THEN
        ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
      END IF;
    END IF;
  END $$;

  -- 사용자 계정을 위한 트리거 (Supabase Auth와 연동)
  -- auth.users 테이블에 새 사용자가 생성될 때 users 테이블에 레코드 자동 생성
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER AS $$
  BEGIN
    INSERT INTO public.users (id, username, email, name, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', ''),
      COALESCE(NEW.raw_user_meta_data->>'role', 'operator')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  -- auth.users에 새 사용자가 생성될 때 트리거 실행
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

  -- Books 테이블
  CREATE TABLE IF NOT EXISTS books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    isbn VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Points 테이블
  CREATE TABLE IF NOT EXISTS points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL DEFAULT 0,
    reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- points 테이블에 포인트 관리 컬럼들 추가
  DO $$ 
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'points' AND column_name = 'customer_id'
    ) THEN
      ALTER TABLE points ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'points' AND column_name = 'category'
    ) THEN
      ALTER TABLE points ADD COLUMN category VARCHAR(50) DEFAULT 'general';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'points' AND column_name = 'type'
    ) THEN
      ALTER TABLE points ADD COLUMN type VARCHAR(50) DEFAULT 'charge';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'points' AND column_name = 'status'
    ) THEN
      ALTER TABLE points ADD COLUMN status VARCHAR(50) DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'points' AND column_name = 'related_transaction_id'
    ) THEN
      ALTER TABLE points ADD COLUMN related_transaction_id UUID REFERENCES points(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'points' AND column_name = 'requested_by'
    ) THEN
      ALTER TABLE points ADD COLUMN requested_by UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'points' AND column_name = 'approved_by'
    ) THEN
      ALTER TABLE points ADD COLUMN approved_by UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END $$;

  -- Tasks 테이블
  CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(50) DEFAULT 'medium',
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- tasks 테이블에 추가 컬럼들 (업무 프로세스용)
  DO $$ 
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'customer_id'
    ) THEN
      ALTER TABLE tasks ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'work_type'
    ) THEN
      ALTER TABLE tasks ADD COLUMN work_type VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'point_category'
    ) THEN
      ALTER TABLE tasks ADD COLUMN point_category VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'amount'
    ) THEN
      ALTER TABLE tasks ADD COLUMN amount INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'image_url'
    ) THEN
      ALTER TABLE tasks ADD COLUMN image_url TEXT;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'assigned_to'
    ) THEN
      ALTER TABLE tasks ADD COLUMN assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'approved_by'
    ) THEN
      ALTER TABLE tasks ADD COLUMN approved_by UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END $$;

  -- Senders 테이블
  CREATE TABLE IF NOT EXISTS senders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Letters 테이블 (OCR 편지 저장)
  CREATE TABLE IF NOT EXISTS letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(100),
    ocr_text TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- employee_id 컬럼 추가
  DO $$ 
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'letters' AND column_name = 'employee_id'
    ) THEN
      ALTER TABLE letters ADD COLUMN employee_id UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END $$;

  -- employee_id 제약조건은 CHECK 제약조건에서 서브쿼리를 사용할 수 없으므로 제거
  -- 대신 애플리케이션 레벨이나 트리거에서 검증하거나, 별도의 함수를 사용해야 합니다

  -- Customers 테이블 (회원 관리)
  CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    institution VARCHAR(255),
    prison_number VARCHAR(50),
    normal_points INTEGER DEFAULT 0,
    betting_points INTEGER DEFAULT 0,
    depositor_name VARCHAR(255),
    total_deposit INTEGER DEFAULT 0,
    total_usage INTEGER DEFAULT 0,
    total_betting INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- customers 테이블에 포인트 잔액 컬럼 추가
  DO $$ 
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'customers' AND column_name = 'total_point_general'
    ) THEN
      ALTER TABLE customers ADD COLUMN total_point_general INTEGER DEFAULT 0;
      UPDATE customers SET total_point_general = COALESCE(normal_points, 0) WHERE total_point_general IS NULL;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'customers' AND column_name = 'total_point_betting'
    ) THEN
      ALTER TABLE customers ADD COLUMN total_point_betting INTEGER DEFAULT 0;
      UPDATE customers SET total_point_betting = COALESCE(betting_points, 0) WHERE total_point_betting IS NULL;
    END IF;
  END $$;

  -- Task Comments 테이블 (티켓 댓글)
  CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- 인덱스 생성
  CREATE INDEX IF NOT EXISTS idx_points_user_id ON points(user_id);
  CREATE INDEX IF NOT EXISTS idx_letters_user_id ON letters(user_id);
  CREATE INDEX IF NOT EXISTS idx_letters_employee_id ON letters(employee_id);
  CREATE INDEX IF NOT EXISTS idx_letters_created_at ON letters(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
  CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
  CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id);
  CREATE INDEX IF NOT EXISTS idx_senders_user_id ON senders(user_id);
  CREATE INDEX IF NOT EXISTS idx_customers_member_number ON customers(member_number);
  CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
  CREATE INDEX IF NOT EXISTS idx_points_customer_id ON points(customer_id);
  CREATE INDEX IF NOT EXISTS idx_points_status ON points(status);
  CREATE INDEX IF NOT EXISTS idx_points_created_at ON points(created_at DESC);

  -- users 테이블 인덱스는 나중에 수동으로 생성 가능 (선택사항)
  -- CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  -- CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

  -- updated_at 자동 업데이트를 위한 트리거 함수
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- 각 테이블에 updated_at 트리거 적용
  DROP TRIGGER IF EXISTS update_users_updated_at ON users;
  CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_books_updated_at ON books;
  CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON books
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_points_updated_at ON points;
  CREATE TRIGGER update_points_updated_at BEFORE UPDATE ON points
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
  CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_senders_updated_at ON senders;
  CREATE TRIGGER update_senders_updated_at BEFORE UPDATE ON senders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_letters_updated_at ON letters;
  CREATE TRIGGER update_letters_updated_at BEFORE UPDATE ON letters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
  CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_task_comments_updated_at ON task_comments;
  CREATE TRIGGER update_task_comments_updated_at BEFORE UPDATE ON task_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  -- 포인트 거래 승인 RPC 함수
  CREATE OR REPLACE FUNCTION approve_point_transaction(
    transaction_id UUID,
    approver_id UUID
  )
  RETURNS JSON
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  DECLARE
    point_record RECORD;
    customer_record RECORD;
    new_balance_general INTEGER;
    new_balance_betting INTEGER;
  BEGIN
    -- 거래 정보 조회
    SELECT * INTO point_record
    FROM points
    WHERE id = transaction_id;

    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', '거래를 찾을 수 없습니다.');
    END IF;

    IF point_record.status != 'pending' THEN
      RETURN json_build_object('success', false, 'error', '이미 처리된 거래입니다.');
    END IF;

    IF point_record.customer_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', '회원 정보가 없습니다.');
    END IF;

    -- 회원 정보 조회
    SELECT * INTO customer_record
    FROM customers
    WHERE id = point_record.customer_id;

    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', '회원을 찾을 수 없습니다.');
    END IF;

    -- 거래 승인 처리
    UPDATE points
    SET status = 'approved',
        approved_by = approver_id,
        updated_at = NOW()
    WHERE id = transaction_id;

    -- 잔액 계산 및 업데이트
    new_balance_general := COALESCE(customer_record.total_point_general, 0);
    new_balance_betting := COALESCE(customer_record.total_point_betting, 0);

    CASE point_record.type
      WHEN 'charge' THEN
        -- 충전: 잔액 증가
        IF point_record.category = 'general' THEN
          new_balance_general := new_balance_general + point_record.amount;
        ELSE
          new_balance_betting := new_balance_betting + point_record.amount;
        END IF;
      
      WHEN 'use' THEN
        -- 사용: 잔액 감소
        IF point_record.category = 'general' THEN
          new_balance_general := new_balance_general - point_record.amount;
          IF new_balance_general < 0 THEN
            RAISE EXCEPTION '일반 포인트 잔액이 부족합니다. 현재 잔액: %', COALESCE(customer_record.total_point_general, 0);
          END IF;
        ELSE
          new_balance_betting := new_balance_betting - point_record.amount;
          IF new_balance_betting < 0 THEN
            RAISE EXCEPTION '배팅 포인트 잔액이 부족합니다. 현재 잔액: %', COALESCE(customer_record.total_point_betting, 0);
          END IF;
        END IF;
      
      WHEN 'refund' THEN
        -- 환불: 잔액 증가
        IF point_record.category = 'general' THEN
          new_balance_general := new_balance_general + point_record.amount;
        ELSE
          new_balance_betting := new_balance_betting + point_record.amount;
        END IF;
      
      WHEN 'exchange' THEN
        -- 전환: 한쪽 감소, 반대쪽 증가
        IF point_record.category = 'general' THEN
          -- 일반 -> 배팅 전환
          new_balance_general := new_balance_general - point_record.amount;
          new_balance_betting := new_balance_betting + point_record.amount;
          IF new_balance_general < 0 THEN
            RAISE EXCEPTION '일반 포인트 잔액이 부족합니다. 현재 잔액: %', COALESCE(customer_record.total_point_general, 0);
          END IF;
        ELSE
          -- 배팅 -> 일반 전환
          new_balance_betting := new_balance_betting - point_record.amount;
          new_balance_general := new_balance_general + point_record.amount;
          IF new_balance_betting < 0 THEN
            RAISE EXCEPTION '배팅 포인트 잔액이 부족합니다. 현재 잔액: %', COALESCE(customer_record.total_point_betting, 0);
          END IF;
        END IF;
    END CASE;

    -- 회원 잔액 업데이트
    UPDATE customers
    SET total_point_general = new_balance_general,
        total_point_betting = new_balance_betting,
        updated_at = NOW()
    WHERE id = point_record.customer_id;

    RETURN json_build_object(
      'success', true,
      'message', '거래가 승인되었습니다.',
      'new_balance_general', new_balance_general,
      'new_balance_betting', new_balance_betting
    );

  EXCEPTION
    WHEN OTHERS THEN
      RETURN json_build_object('success', false, 'error', SQLERRM);
  END;
  $$;
`