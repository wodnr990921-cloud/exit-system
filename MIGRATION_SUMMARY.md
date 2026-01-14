# 완전한 기능 마이그레이션 요약

## 파일 위치
`C:\Users\User\exit system\schema_migration_complete.sql`

## 구현된 기능

### 1. 수용자 관리 시스템
**테이블:**
- `inmates`: 수용자 정보 관리
  - 수용자 이름, 수용번호, 현재 교도소
  - 출소 예정일, 출소 여부
  - 관련 고객(가족) 연결

- `prison_restrictions`: 교도소별 금지 물품
  - 교도소별 금지 물품 배열
  - 특이사항 메모

**함수:**
- `check_restricted_items()`: 특정 교도소에서 물품이 금지되었는지 확인

**인덱스:**
- 수용번호, 고객ID, 교도소명, 출소여부, 출소예정일

---

### 2. 블랙리스트 시스템
**테이블:**
- `customer_flags`: 고객 플래그 관리
  - 플래그 타입: 'blacklist', 'warning', 'vip'
  - 사유, 담당자, 활성화 여부

**제약조건:**
- flag_type은 blacklist, warning, vip만 가능

**인덱스:**
- 고객ID, 플래그타입, 활성화여부, 플래그 일시

---

### 3. 정산 시스템 개선
**테이블 변경:**
- `task_items`에 추가된 컬럼:
  - `cost_price`: 원가
  - `selling_price`: 판매가
  - `shipping_cost`: 배송비

**새 테이블:**
- `monthly_settlements`: 월별 정산
  - 연도/월별 유일 제약
  - 총 매출, 총 원가, 총 배송비, 순이익

**함수:**
- `calculate_monthly_settlement()`: 월별 정산 자동 집계
  - 해당 월의 완료된 작업 기준
  - 매출, 원가, 배송비 자동 계산
  - 순이익 산출

---

### 4. 감사 로그 시스템
**테이블:**
- `audit_logs`: 모든 작업 기록
  - 사용자, 액션(SELECT/INSERT/UPDATE/DELETE)
  - 테이블명, 레코드ID
  - 변경 전/후 값 (JSONB)
  - IP 주소

**함수:**
- `log_audit()`: 감사 로그 기록 함수

**인덱스:**
- 사용자ID, 생성일시, 테이블명, 액션, 레코드ID

---

### 5. 포인트 거래 취소 시스템
**테이블 변경:**
- `points`에 추가된 컬럼:
  - `is_reversed`: 취소 여부
  - `reversed_by`: 취소한 사용자
  - `reversed_at`: 취소 일시
  - `reversal_reason`: 취소 사유
  - `original_transaction_id`: 원 거래 참조

**함수:**
- `reverse_point_transaction()`: 포인트 거래 취소
  - 원 거래 검증 (승인된 거래만 취소 가능)
  - 잔액 확인 (잔액 부족 시 취소 불가)
  - 반대 거래 자동 생성
  - 고객 잔액 자동 업데이트
  - 취소 플래그 설정

**거래 취소 로직:**
- 충전 취소 → 사용으로 처리 (잔액 차감)
- 사용 취소 → 환불로 처리 (잔액 증가)
- 환불 취소 → 사용으로 처리 (잔액 차감)

---

### 6. 소모품 재고 관리
**테이블:**
- `inventory_items`: 재고 항목
  - 품목명, 품목 타입(우표/봉투/용지/라벨)
  - 현재 수량, 최소 수량, 단위
  - 최근 입고 일시

- `inventory_transactions`: 재고 거래 내역
  - 수량 변동 (양수: 입고, 음수: 출고)
  - 거래 타입: restock(입고), use(사용), adjustment(조정)

**함수:**
- `use_inventory_item()`: 재고 사용 및 차감
  - 재고 부족 확인
  - 자동 거래 기록 생성
  - 최소 재고 미달 경고

**기본 데이터:**
- 우표(430원), 일반 봉투, A4 용지, 배송 라벨

---

### 7. 원본 파기 스케줄러
**테이블:**
- `document_retention`: 문서 보관 기록
  - 편지 ID 참조
  - 보관 기간 (기본 90일)
  - 파기 예정일
  - 파기 여부, 파기 일시, 파기자

**트리거:**
- `auto_set_document_retention()`: 편지 등록 시 자동 파기 일정 생성

**인덱스:**
- 편지ID, 파기예정일, 파기여부

---

### 8. 반송 처리 시스템
**테이블:**
- `returns`: 반송 처리
  - 반송 사유: 이감, 출소, 수취인불명, 금지물품, 기타
  - 반송 상태: pending(대기), resend(재발송), disposed(폐기)
  - 재발송 비용
  - 처리자

**인덱스:**
- 작업ID, 반송일, 상태, 반송사유

---

### 9. 환경 설정 관리
**테이블:**
- `system_config`: 시스템 설정
  - 설정 키 (유일)
  - 설정 값
  - 데이터 타입: string, number, boolean, json
  - 설명, 수정자

**기본 설정 값:**
- `stamp_price`: 430 (우표 가격)
- `service_fee`: 500 (기본 수수료)
- `company_account_number`: 회사 계좌번호
- `sms_template`: SMS 발송 기본 문구
- `retention_days`: 90 (문서 보관 기간)
- `min_stamp_quantity`: 100 (우표 최소 재고)
- `auto_matching_threshold`: 80 (자동 매칭 신뢰도)

**함수:**
- `get_config()`: 설정 값 조회

---

### 10. 휴면 포인트 관리
**테이블:**
- `dormant_points`: 휴면 포인트 기록
  - 고객 ID
  - 원래 포인트 잔액
  - 회수 금액
  - 휴면 시작일

**함수:**
- `confiscate_dormant_points()`: 휴면 계정 포인트 회수
  - 1년 이상 미활동 계정 자동 검색
  - 포인트 회수 및 기록
  - 포인트 거래 기록 자동 생성

---

## 공통 기능

### updated_at 자동 업데이트
모든 새 테이블에 `update_updated_at_column()` 트리거 적용:
- inmates
- prison_restrictions
- customer_flags
- inventory_items
- returns
- system_config

### 인덱스 전략
- 외래 키 컬럼에 인덱스
- 자주 검색되는 컬럼에 인덱스
- 날짜 컬럼은 DESC 인덱스 (최신순 조회 최적화)
- 조건부 인덱스 (WHERE 절 활용)

---

## 사용 방법

### 1. 마이그레이션 실행
```sql
-- Supabase SQL Editor에서 schema_migration_complete.sql 전체 실행
```

### 2. 검증
파일 하단의 검증 쿼리 주석을 해제하여 실행:
- 테이블 생성 확인
- 컬럼 추가 확인
- 함수 생성 확인
- 트리거 생성 확인
- 인덱스 생성 확인

### 3. 주요 함수 사용 예시

#### 포인트 거래 취소
```sql
SELECT reverse_point_transaction(
  '거래ID'::UUID,
  '고객 요청으로 취소',
  '관리자ID'::UUID
);
```

#### 휴면 포인트 회수
```sql
SELECT * FROM confiscate_dormant_points();
```

#### 재고 사용
```sql
SELECT use_inventory_item(
  '재고항목ID'::UUID,
  10,  -- 사용 수량
  '사용자ID'::UUID,
  '우편 발송에 사용'
);
```

#### 금지 물품 확인
```sql
SELECT * FROM check_restricted_items(
  '서울구치소',
  ARRAY['담배', '라이터', '책']
);
```

#### 월별 정산
```sql
SELECT calculate_monthly_settlement(
  2026,  -- 년도
  1,     -- 월
  '관리자ID'::UUID
);
```

#### 감사 로그 기록
```sql
SELECT log_audit(
  '사용자ID'::UUID,
  'UPDATE',
  'customers',
  '고객ID',
  '{"name": "홍길동"}'::JSONB,
  '{"name": "김철수"}'::JSONB,
  '192.168.1.1'
);
```

#### 시스템 설정 조회
```sql
SELECT get_config('stamp_price');
```

---

## 데이터베이스 다이어그램

### 주요 관계
```
customers (고객)
  ├── inmates (수용자 - 1:N)
  ├── customer_flags (플래그 - 1:N)
  ├── points (포인트 거래 - 1:N)
  ├── tasks (작업 - 1:N)
  └── dormant_points (휴면 포인트 - 1:N)

tasks (작업)
  ├── task_items (작업 항목 - 1:N)
  ├── returns (반송 - 1:N)
  └── letters (편지 - 1:1)

letters (편지)
  └── document_retention (문서 보관 - 1:1)

inventory_items (재고 항목)
  └── inventory_transactions (재고 거래 - 1:N)

points (포인트 거래)
  └── points (취소 거래 - 자기참조)

users (사용자)
  ├── audit_logs (감사 로그 - 1:N)
  ├── customer_flags (플래그 작성자 - 1:N)
  ├── inventory_transactions (재고 거래자 - 1:N)
  └── 기타 모든 작업 기록
```

---

## 주의사항

1. **포인트 거래 취소**
   - 승인된(approved) 거래만 취소 가능
   - 잔액이 부족하면 취소 불가
   - 취소는 한 번만 가능 (중복 취소 방지)

2. **휴면 포인트 회수**
   - 1년 기준은 마지막 포인트 거래 또는 계정 생성일
   - 이미 회수된 계정은 재회수 방지
   - 자동 포인트 거래 기록 생성

3. **재고 관리**
   - 재고 부족 시 사용 불가
   - 최소 재고 미달 시 경고 반환
   - 모든 거래 자동 기록

4. **문서 파기**
   - 편지 등록 시 자동 파기 일정 생성
   - 기본 90일 보관 (system_config에서 변경 가능)

5. **감사 로그**
   - JSONB 형식으로 변경 전/후 값 저장
   - 인덱스 최적화로 빠른 검색 지원

---

## 성능 최적화

1. **인덱스 전략**
   - 외래 키 자동 인덱싱
   - 조건부 인덱스로 저장 공간 절약
   - 복합 인덱스 활용 (year, month)

2. **JSONB 활용**
   - 감사 로그의 변경 내역
   - 유연한 데이터 구조
   - GIN 인덱스 지원

3. **트리거 최적화**
   - 필요한 경우에만 실행
   - 간단한 로직으로 성능 유지

4. **함수 보안**
   - SECURITY DEFINER로 권한 제어
   - 입력 검증 철저히

---

## 다음 단계

### 백엔드 API 구현 필요 항목
1. 수용자 CRUD API
2. 블랙리스트 관리 API
3. 월별 정산 API
4. 감사 로그 조회 API
5. 재고 관리 API
6. 문서 파기 스케줄러 (cron job)
7. 반송 처리 API
8. 시스템 설정 API
9. 휴면 포인트 회수 스케줄러 (월 1회 실행)

### 프론트엔드 화면 필요 항목
1. 수용자 관리 페이지
2. 블랙리스트 관리 페이지
3. 정산 대시보드
4. 감사 로그 뷰어
5. 재고 관리 페이지
6. 문서 파기 관리 페이지
7. 반송 처리 페이지
8. 시스템 설정 페이지
9. 휴면 계정 관리 페이지

---

## 문의사항
마이그레이션 또는 기능 사용 중 문제가 발생하면 검증 쿼리를 실행하여 테이블, 함수, 트리거가 정상적으로 생성되었는지 확인하세요.
