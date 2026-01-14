# OCR 시스템 개선 가이드

## 개요

교도소 편지 관리 시스템의 OCR(Optical Character Recognition) 기능을 대폭 개선했습니다. GPT-4o Vision API를 활용하여 이미지 타입 자동 감지, 금지어 필터링, 회원 자동 매칭 기능이 추가되었습니다.

## 주요 개선 사항

### 1. OCR API 개선 (`src/app/api/ocr/route.ts`)

#### 기능
- **GPT-4o Vision API 사용**: 더 정확한 텍스트 인식 (기존 gpt-4o-mini에서 업그레이드)
- **이미지 타입 자동 감지**: 편지봉투, 편지내용, 물품사진, 송금증빙 자동 분류
- **발신인 정보 자동 추출**: 편지봉투에서 발신인 이름, 주소 등 구조화된 데이터 추출
- **금지어 자동 탐지**: 계좌번호, 욕설, 불법 거래 관련 표현 자동 감지
- **회원 자동 매칭**: 발신인 이름을 기반으로 회원 DB에서 자동 매칭
- **손글씨 인식**: 손글씨 편지도 텍스트로 변환

#### API 사용법

```typescript
// FormData 생성
const formData = new FormData()
formData.append("image", imageFile)
formData.append("detectImageType", "true")
formData.append("detectProhibited", "true")
formData.append("extractHandwriting", "true")

// OCR API 호출
const response = await fetch("/api/ocr", {
  method: "POST",
  body: formData,
})

const result = await response.json()

if (result.success) {
  console.log("OCR 결과:", result.data)
  console.log("이미지 타입:", result.data.imageType)
  console.log("신뢰도:", result.data.confidence)
  console.log("추출된 텍스트:", result.data.rawText)
  console.log("금지어 발견:", result.data.prohibitedContent?.found)
  console.log("매칭된 회원:", result.data.customerMatch)
}
```

#### 응답 형식

```json
{
  "success": true,
  "data": {
    "imageType": "envelope",
    "confidence": 95,
    "confidenceLevel": "high",
    "rawText": "전체 텍스트...",
    "structuredData": {
      "senderName": "홍길동",
      "senderAddress": "서울시 강남구...",
      "confidence": 95
    },
    "prohibitedContent": {
      "found": true,
      "score": 50,
      "matches": [
        {
          "text": "계좌: 123-456-7890",
          "category": "account_number",
          "description": "계좌번호 명시",
          "severity": "high"
        }
      ],
      "summary": "금지어 발견: 계좌번호 1개 (위험도: 50/100)"
    },
    "customerMatch": {
      "found": true,
      "customerId": "uuid",
      "customerName": "홍길동",
      "memberNumber": "2025-001",
      "matchScore": 95
    },
    "processingTime": 2500
  }
}
```

### 2. 금지어 필터링 시스템 (`src/lib/content-filter.ts`)

#### 금지어 카테고리

1. **계좌번호** (`account_number`)
   - 계좌번호 패턴 감지: `123-456-7890`
   - 은행명과 함께 표시된 계좌번호
   - "계좌:" 키워드와 숫자 조합

2. **개인정보** (`personal_info`)
   - 전화번호: `010-1234-5678`
   - 주민등록번호 패턴

3. **욕설** (`profanity`)
   - 일반적인 욕설 패턴 감지

4. **불법 거래** (`illegal`)
   - 마약, 총기 등 불법 품목 키워드
   - 폭발물 관련 표현

5. **의심 표현** (`slang`)
   - 현금 거래 요청
   - 송금, 입금 등 금전 거래 암시

#### 사용법

```typescript
import { detectProhibitedContent, formatDetectionSummary } from "@/lib/content-filter"

const text = "편지 내용... 계좌: 123-456-7890"
const result = detectProhibitedContent(text)

if (result.found) {
  console.log("위험도:", result.score) // 0-100
  console.log("발견된 금지어:", result.matches)
  console.log("요약:", formatDetectionSummary(result))

  // 하이라이트된 HTML 텍스트
  console.log("하이라이트:", result.highlightedText)
}
```

#### 위험도 점수

- **low**: 10점 (의심 표현)
- **medium**: 30점 (욕설, 전화번호)
- **high**: 50점 (계좌번호, 주민등록번호, 불법 품목)

점수가 높을수록 위험한 내용입니다. 여러 금지어가 발견되면 점수가 누적됩니다.

### 3. 이미지 전처리 유틸리티 (`src/lib/image-utils.ts`)

OCR 정확도를 높이기 위한 이미지 전처리 기능들입니다.

#### 주요 함수

##### 1. 이미지 리사이즈

```typescript
import { resizeImage } from "@/lib/image-utils"

const resizedFile = await resizeImage(
  file,
  2000, // 최대 너비
  2000, // 최대 높이
  0.92  // JPEG 품질
)
```

##### 2. 이미지 회전

```typescript
import { rotateImage } from "@/lib/image-utils"

const rotatedFile = await rotateImage(file, 90) // 90도 회전
```

##### 3. 밝기/대비 조정

```typescript
import { adjustImageBrightnessContrast } from "@/lib/image-utils"

const adjustedFile = await adjustImageBrightnessContrast(
  file,
  10,  // 밝기 (-100 ~ 100)
  20   // 대비 (-100 ~ 100)
)
```

##### 4. 흑백 변환

```typescript
import { convertToGrayscale } from "@/lib/image-utils"

const grayscaleFile = await convertToGrayscale(file)
```

##### 5. 선명도 향상

```typescript
import { sharpenImage } from "@/lib/image-utils"

const sharpenedFile = await sharpenImage(file, 1.5)
```

##### 6. 종합 전처리 (OCR용 최적화)

```typescript
import { preprocessImageForOcr } from "@/lib/image-utils"

const processedFile = await preprocessImageForOcr(file, {
  maxWidth: 2000,
  maxHeight: 2000,
  quality: 0.92,
  grayscale: false,      // 흑백 변환
  sharpen: true,         // 선명도 향상
  contrast: 10,          // 대비 조정
  brightness: 5,         // 밝기 조정
  autoRotate: true       // EXIF 기반 자동 회전
})
```

##### 7. Base64 인코딩/디코딩

```typescript
import { fileToBase64, base64ToFile, base64ToBlob } from "@/lib/image-utils"

// File → Base64
const base64 = await fileToBase64(file)

// Base64 → File
const file = base64ToFile(base64, "image.jpg", "image/jpeg")

// Base64 → Blob
const blob = base64ToBlob(base64, "image/jpeg")
```

##### 8. 이미지 메타데이터 추출

```typescript
import { getImageMetadata } from "@/lib/image-utils"

const metadata = await getImageMetadata(file)
console.log("크기:", metadata.width, "x", metadata.height)
console.log("용량:", metadata.size, "bytes")
console.log("형식:", metadata.format)
```

##### 9. 이미지 품질 검증

```typescript
import { validateImageQuality } from "@/lib/image-utils"

const validation = await validateImageQuality(file)

if (!validation.valid) {
  console.log("경고:", validation.warnings)
}
```

##### 10. 배치 이미지 압축

```typescript
import { compressImages } from "@/lib/image-utils"

const compressedFiles = await compressImages(
  [file1, file2, file3],
  { maxWidth: 1600, quality: 0.85 },
  (current, total) => {
    console.log(`진행중: ${current}/${total}`)
  }
)
```

### 4. 우편실 페이지 개선 (`src/app/dashboard/mailroom/mailroom-client.tsx`)

#### 새로운 UI 기능

##### 1. OCR 실행 버튼
- 이미지 뷰어 상단에 "OCR 실행" 버튼 추가
- 클릭 시 GPT-4o Vision API로 이미지 분석
- 처리 중 진행 상태 표시 (로딩 스피너)

##### 2. OCR 결과 패널
- 이미지 타입 배지 표시 (편지봉투, 편지내용 등)
- 신뢰도 배지 표시 (색상으로 구분)
  - 90% 이상: 파란색 (높음)
  - 70-90%: 회색 (중간)
  - 70% 미만: 빨간색 (낮음)
- 금지어 발견 시 경고 배지 (빨간색, 애니메이션)

##### 3. 텍스트 표시 및 수정
- "보기" 버튼으로 OCR 텍스트 토글
- "수정" 버튼으로 텍스트 직접 수정 가능
- 수정 후 DB에 자동 저장

##### 4. 금지어 상세 정보
- 금지어 발견 시 상세 카드 표시
- 위험도 점수 표시 (0-100)
- 발견된 금지어 목록 (최대 3개 + 더보기)
- 각 금지어의 설명과 원문 표시

##### 5. 편지 목록 개선
- 각 편지 카드에 OCR 신뢰도 배지 표시
- 금지어 발견 시 빨간 점 표시 (애니메이션)
- 이미지 타입 배지 표시

##### 6. 자동 회원 매칭
- OCR로 발신인 이름 추출 시 자동으로 회원 검색
- 매칭 점수가 높은 회원을 자동 선택
- 수동 수정 가능

#### 사용 흐름

1. **편지 선택**: 왼쪽 목록에서 편지 클릭
2. **OCR 실행**: "OCR 실행" 버튼 클릭
3. **자동 처리**:
   - 이미지 타입 감지
   - 텍스트 추출
   - 금지어 검색
   - 회원 자동 매칭
4. **결과 확인**: OCR 결과 패널에서 확인
5. **수정**: 필요시 텍스트 수정
6. **티켓 생성**: 회원 선택 후 업무 입력하고 "저장 후 다음"

### 5. OCR 타입 정의 (`src/lib/ocr-types.ts`)

TypeScript 타입 정의가 모두 포함되어 있어 타입 안전성이 보장됩니다.

#### 주요 타입

```typescript
// 이미지 타입
enum ImageType {
  ENVELOPE = "envelope",           // 편지봉투
  LETTER_CONTENT = "letter_content", // 편지 내용
  PRODUCT_PHOTO = "product_photo",   // 물품 사진
  REMITTANCE_PROOF = "remittance_proof", // 송금 증빙
  UNKNOWN = "unknown"               // 알 수 없음
}

// 신뢰도 레벨
enum ConfidenceLevel {
  HIGH = "high",      // 90% 이상
  MEDIUM = "medium",  // 70-90%
  LOW = "low"        // 70% 미만
}

// OCR 응답
interface OcrResponse {
  success: boolean
  data?: {
    imageType: ImageType
    confidence: number
    confidenceLevel: ConfidenceLevel
    rawText: string
    structuredData: any
    prohibitedContent?: {
      found: boolean
      score: number
      matches: any[]
      summary: string
    }
    customerMatch?: {
      found: boolean
      customerId?: string
      customerName?: string
      matchScore: number
    }
    processingTime: number
  }
  error?: string
}
```

## 데이터베이스 스키마

OCR 기능을 위해 `letters` 테이블에 다음 컬럼을 추가해야 합니다:

```sql
ALTER TABLE letters
ADD COLUMN ocr_text TEXT,
ADD COLUMN ocr_confidence INTEGER,
ADD COLUMN ocr_image_type TEXT,
ADD COLUMN ocr_prohibited_content JSONB;
```

## 환경 변수 설정

`.env.local` 파일에 OpenAI API 키를 추가하세요:

```bash
OPENAI_API_KEY=sk-...your-api-key...
```

## 성능 최적화 팁

### 1. 이미지 전처리
- 큰 이미지는 리사이즈하여 API 호출 시간 단축
- 흑백 변환으로 파일 크기 감소
- 대비/밝기 조정으로 OCR 정확도 향상

### 2. API 호출 최적화
- 배치 처리 시 Promise.all() 사용
- 캐싱으로 중복 호출 방지
- 에러 처리로 실패 시 재시도

### 3. 사용자 경험
- 로딩 스피너로 진행 상태 표시
- 토스트 알림으로 결과 피드백
- 자동 저장으로 데이터 손실 방지

## 보안 고려사항

### 1. 금지어 필터링
- 계좌번호, 전화번호 등 민감 정보 자동 탐지
- 위험도 점수로 우선순위 관리
- 관리자 알림 기능 (추가 개발 가능)

### 2. API 키 보안
- 환경 변수로 관리
- 서버 사이드에서만 사용
- 클라이언트에 노출 금지

### 3. 데이터 보안
- HTTPS 통신 필수
- 이미지 업로드 시 파일 크기/형식 검증
- 금지어 발견 시 로그 기록

## 문제 해결

### OCR이 실행되지 않을 때
1. OpenAI API 키 확인
2. 이미지 파일 형식 확인 (JPG, PNG, HEIC만 지원)
3. 파일 크기 확인 (10MB 이하)
4. 네트워크 연결 확인

### 금지어가 제대로 감지되지 않을 때
1. `content-filter.ts`의 패턴 확인
2. 정규표현식 테스트
3. 새로운 패턴 추가

### 회원 자동 매칭이 실패할 때
1. DB에 회원 데이터 확인
2. 이름 철자 확인
3. 유사도 계산 알고리즘 조정

## 향후 개선 계획

### 1. 기능 추가
- [ ] 배치 OCR 처리 (여러 이미지 동시 처리)
- [ ] OCR 결과 히스토리 관리
- [ ] 금지어 사전 관리 UI
- [ ] 자동 번역 (외국어 편지)
- [ ] 손글씨 개선 학습

### 2. 성능 개선
- [ ] 이미지 캐싱
- [ ] OCR 결과 캐싱
- [ ] 병렬 처리 최적화
- [ ] GPU 가속 (Tesseract.js)

### 3. UI/UX 개선
- [ ] OCR 결과 미리보기
- [ ] 드래그 앤 드롭 업로드
- [ ] 이미지 편집 도구 통합
- [ ] 키보드 단축키 확장

## 참고 자료

- [OpenAI Vision API 문서](https://platform.openai.com/docs/guides/vision)
- [GPT-4o 모델 정보](https://platform.openai.com/docs/models/gpt-4o)
- [Supabase Storage 가이드](https://supabase.com/docs/guides/storage)

## 지원

문의사항이나 버그 리포트는 프로젝트 관리자에게 연락하세요.

---

마지막 업데이트: 2026-01-14
