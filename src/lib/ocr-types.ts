/**
 * OCR 시스템 타입 정의
 */

import { ProhibitedCategory } from "./content-filter"

// 이미지 타입
export enum ImageType {
  ENVELOPE = "envelope", // 편지봉투
  LETTER_CONTENT = "letter_content", // 편지 내용
  PRODUCT_PHOTO = "product_photo", // 물품 사진
  REMITTANCE_PROOF = "remittance_proof", // 송금 증빙
  UNKNOWN = "unknown", // 알 수 없음
}

// OCR 상태
export enum OcrStatus {
  PENDING = "pending", // 대기중
  PROCESSING = "processing", // 처리중
  COMPLETED = "completed", // 완료
  FAILED = "failed", // 실패
  GROUPED = "grouped", // 그룹핑됨
}

// 신뢰도 레벨
export enum ConfidenceLevel {
  HIGH = "high", // 90% 이상
  MEDIUM = "medium", // 70-90%
  LOW = "low", // 70% 미만
}

// 편지봉투 정보
export interface EnvelopeInfo {
  senderName?: string
  senderAddress?: string
  recipientName?: string
  recipientAddress?: string
  postalCode?: string
  confidence: number
}

// 편지 내용 정보
export interface LetterContentInfo {
  fullText: string
  paragraphs: string[]
  handwritten: boolean
  readabilityScore: number // 0-100
  confidence: number
}

// 물품 정보
export interface ProductInfo {
  productName?: string
  description?: string
  quantity?: number
  price?: number
  confidence: number
}

// 송금 증빙 정보
export interface RemittanceInfo {
  amount?: number
  accountNumber?: string
  bankName?: string
  senderName?: string
  recipientName?: string
  transactionDate?: string
  confidence: number
}

// OCR 결과
export interface OcrResult {
  id: string
  letterId: string
  imageType: ImageType
  status: OcrStatus
  confidence: number
  confidenceLevel: ConfidenceLevel
  rawText: string
  structuredData:
    | EnvelopeInfo
    | LetterContentInfo
    | ProductInfo
    | RemittanceInfo
    | null
  prohibitedContent?: {
    found: boolean
    score: number
    categories: ProhibitedCategory[]
    summary: string
  }
  processingTime: number // milliseconds
  createdAt: Date
  updatedAt: Date
}

// 이미지 그룹
export interface ImageGroup {
  id: string
  primaryImageId: string // 편지봉투 이미지 ID
  imageIds: string[]
  imageTypes: ImageType[]
  customerId?: string
  customerName?: string
  status: "pending" | "matched" | "created"
  confidence: number
  createdAt: Date
}

// OCR 처리 요청
export interface OcrRequest {
  image: File
  preprocess?: boolean
  detectImageType?: boolean
  detectProhibitedContent?: boolean
  extractHandwriting?: boolean
}

// OCR 처리 응답
export interface OcrResponse {
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
    handwriting?: {
      detected: boolean
      convertedText: string
      readabilityScore: number
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
  details?: string
}

// 배치 OCR 요청
export interface BatchOcrRequest {
  images: File[]
  options?: {
    autoGroup?: boolean
    autoMatch?: boolean
    preprocess?: boolean
  }
}

// 배치 OCR 응답
export interface BatchOcrResponse {
  success: boolean
  totalImages: number
  processedImages: number
  failedImages: number
  results: Array<{
    fileName: string
    success: boolean
    data?: OcrResponse["data"]
    error?: string
  }>
  groups?: ImageGroup[]
  processingTime: number
}

// 손글씨 인식 요청
export interface HandwritingRequest {
  image: File
  language?: "ko" | "en"
}

// 손글씨 인식 응답
export interface HandwritingResponse {
  success: boolean
  data?: {
    originalImage: string
    convertedText: string
    readabilityScore: number // 0-100
    confidence: number
    detectedLanguage: string
    processingTime: number
  }
  error?: string
}

// OCR 통계
export interface OcrStats {
  daily: {
    date: string
    totalProcessed: number
    successful: number
    failed: number
    averageConfidence: number
    averageProcessingTime: number
    imageTypeBreakdown: Record<ImageType, number>
    prohibitedContentCount: number
  }
  weekly: {
    startDate: string
    endDate: string
    totalProcessed: number
    successRate: number
    topSenders: Array<{
      name: string
      count: number
    }>
  }
  monthly: {
    month: string
    totalProcessed: number
    successRate: number
    averageConfidence: number
  }
}

// 고객 매칭 결과
export interface CustomerMatchResult {
  found: boolean
  customerId?: string
  customerName?: string
  memberNumber?: string
  matchScore: number // 0-100
  matchReasons: string[]
  confidence: ConfidenceLevel
}

// 티켓 생성 미리보기
export interface TicketPreview {
  title: string
  customerName: string
  customerId: string
  workType: string
  items: Array<{
    category: string
    description: string
    amount: number
  }>
  totalAmount: number
  assigneeId?: string
  assigneeName?: string
  aiSummary: string
  images: string[]
  prohibitedContentWarning?: boolean
}

// OCR 로그
export interface OcrLog {
  id: string
  letterId: string
  action: "upload" | "process" | "classify" | "group" | "match" | "error"
  status: "success" | "failure"
  details: any
  errorMessage?: string
  userId?: string
  timestamp: Date
}

// Tesseract.js 옵션
export interface TesseractOptions {
  lang: string
  tessedit_char_whitelist?: string
  tessedit_pageseg_mode?: number
  preserve_interword_spaces?: string
}

// GPT Vision 옵션
export interface GptVisionOptions {
  model: "gpt-4o" | "gpt-4o-mini"
  maxTokens: number
  temperature?: number
  prompt: string
}

// OCR 엔진 비교 결과
export interface OcrComparisonResult {
  tesseractResult: {
    text: string
    confidence: number
  }
  gptVisionResult: {
    text: string
    confidence: number
  }
  selectedResult: {
    text: string
    confidence: number
    engine: "tesseract" | "gpt-vision"
    reason: string
  }
}
