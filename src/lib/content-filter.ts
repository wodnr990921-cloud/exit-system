/**
 * 금지어 필터링 및 하이라이팅 라이브러리
 * 계좌번호, 욕설, 은어 등 금지 콘텐츠를 탐지하고 관리합니다.
 */

// 금지어 카테고리
export enum ProhibitedCategory {
  ACCOUNT_NUMBER = "account_number",
  PROFANITY = "profanity",
  SLANG = "slang",
  PERSONAL_INFO = "personal_info",
  ILLEGAL = "illegal",
}

// 금지어 정의
export interface ProhibitedWord {
  pattern: RegExp
  category: ProhibitedCategory
  description: string
  severity: "low" | "medium" | "high"
}

// 탐지 결과
export interface DetectionResult {
  found: boolean
  matches: Array<{
    text: string
    category: ProhibitedCategory
    description: string
    severity: "low" | "medium" | "high"
    position: {
      start: number
      end: number
    }
  }>
  highlightedText: string
  score: number // 0-100, 높을수록 위험
}

// 금지어 사전
export const PROHIBITED_WORDS: ProhibitedWord[] = [
  // 계좌번호 패턴
  {
    pattern: /\d{3,4}[-\s]?\d{2,6}[-\s]?\d{2,7}/g,
    category: ProhibitedCategory.ACCOUNT_NUMBER,
    description: "계좌번호 의심",
    severity: "high",
  },
  {
    pattern: /계좌\s*[:：]?\s*\d+/gi,
    category: ProhibitedCategory.ACCOUNT_NUMBER,
    description: "계좌번호 명시",
    severity: "high",
  },
  {
    pattern: /(?:농협|국민|신한|하나|우리|기업|SC제일|씨티|카카오뱅크|토스뱅크|케이뱅크)\s*\d+/gi,
    category: ProhibitedCategory.ACCOUNT_NUMBER,
    description: "은행 계좌번호",
    severity: "high",
  },

  // 전화번호
  {
    pattern: /01[0-9][-\s]?\d{3,4}[-\s]?\d{4}/g,
    category: ProhibitedCategory.PERSONAL_INFO,
    description: "전화번호",
    severity: "medium",
  },

  // 주민등록번호
  {
    pattern: /\d{6}[-\s]?[1-4]\d{6}/g,
    category: ProhibitedCategory.PERSONAL_INFO,
    description: "주민등록번호",
    severity: "high",
  },

  // 욕설 (예시 - 실제로는 더 많은 패턴 추가 필요)
  {
    pattern: /[씨시][발빨][년놈]/gi,
    category: ProhibitedCategory.PROFANITY,
    description: "욕설",
    severity: "medium",
  },
  {
    pattern: /병[신씬]/gi,
    category: ProhibitedCategory.PROFANITY,
    description: "욕설",
    severity: "medium",
  },
  {
    pattern: /[개걔][새색][끼키]/gi,
    category: ProhibitedCategory.PROFANITY,
    description: "욕설",
    severity: "medium",
  },

  // 불법 거래 관련
  {
    pattern: /(?:마약|대마|필로폰|히로뽕|코카인|헤로인)/gi,
    category: ProhibitedCategory.ILLEGAL,
    description: "불법 약물",
    severity: "high",
  },
  {
    pattern: /(?:총기|권총|소총|화약|폭탄|폭발물)/gi,
    category: ProhibitedCategory.ILLEGAL,
    description: "불법 무기",
    severity: "high",
  },

  // 은어 및 의심 표현
  {
    pattern: /(?:현질|현금결제|현금으로)/gi,
    category: ProhibitedCategory.SLANG,
    description: "현금 거래 요청",
    severity: "medium",
  },
  {
    pattern: /(?:보내드릴게요|송금|입금)/gi,
    category: ProhibitedCategory.SLANG,
    description: "금전 거래 암시",
    severity: "low",
  },
]

/**
 * 텍스트에서 금지어를 탐지합니다.
 */
export function detectProhibitedContent(text: string): DetectionResult {
  if (!text || text.trim() === "") {
    return {
      found: false,
      matches: [],
      highlightedText: text,
      score: 0,
    }
  }

  const matches: DetectionResult["matches"] = []
  let processedText = text

  // 모든 금지어 패턴 검사
  for (const prohibited of PROHIBITED_WORDS) {
    const regex = new RegExp(prohibited.pattern.source, prohibited.pattern.flags)
    let match

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        text: match[0],
        category: prohibited.category,
        description: prohibited.description,
        severity: prohibited.severity,
        position: {
          start: match.index,
          end: match.index + match[0].length,
        },
      })
    }
  }

  // 중복 제거 및 정렬
  const uniqueMatches = matches
    .filter((match, index, self) =>
      index === self.findIndex(m =>
        m.position.start === match.position.start &&
        m.position.end === match.position.end
      )
    )
    .sort((a, b) => a.position.start - b.position.start)

  // 하이라이팅된 텍스트 생성
  let highlightedText = text
  let offset = 0

  for (const match of uniqueMatches) {
    const start = match.position.start + offset
    const end = match.position.end + offset
    const matchText = highlightedText.substring(start, end)

    // HTML 태그로 감싸기
    const highlighted = `<span class="prohibited-word" data-category="${match.category}" data-severity="${match.severity}" title="${match.description}">${matchText}</span>`

    highlightedText =
      highlightedText.substring(0, start) +
      highlighted +
      highlightedText.substring(end)

    offset += highlighted.length - matchText.length
  }

  // 위험도 점수 계산
  const score = calculateRiskScore(uniqueMatches)

  return {
    found: uniqueMatches.length > 0,
    matches: uniqueMatches,
    highlightedText,
    score,
  }
}

/**
 * 위험도 점수를 계산합니다 (0-100)
 */
function calculateRiskScore(matches: DetectionResult["matches"]): number {
  if (matches.length === 0) return 0

  const severityScores = {
    low: 10,
    medium: 30,
    high: 50,
  }

  let totalScore = 0
  for (const match of matches) {
    totalScore += severityScores[match.severity]
  }

  // 최대 100점으로 제한
  return Math.min(100, totalScore)
}

/**
 * 카테고리별 금지어 수를 반환합니다.
 */
export function getCategoryStats(result: DetectionResult): Record<ProhibitedCategory, number> {
  const stats: Record<ProhibitedCategory, number> = {
    [ProhibitedCategory.ACCOUNT_NUMBER]: 0,
    [ProhibitedCategory.PROFANITY]: 0,
    [ProhibitedCategory.SLANG]: 0,
    [ProhibitedCategory.PERSONAL_INFO]: 0,
    [ProhibitedCategory.ILLEGAL]: 0,
  }

  for (const match of result.matches) {
    stats[match.category]++
  }

  return stats
}

/**
 * 클라이언트에서 사용할 CSS 스타일
 */
export const PROHIBITED_WORD_STYLES = `
  .prohibited-word {
    background-color: rgba(239, 68, 68, 0.2);
    color: #dc2626;
    font-weight: 600;
    padding: 2px 4px;
    border-radius: 3px;
    cursor: help;
    border-bottom: 2px solid #dc2626;
  }

  .prohibited-word[data-severity="high"] {
    background-color: rgba(220, 38, 38, 0.3);
    border-bottom-color: #991b1b;
  }

  .prohibited-word[data-severity="medium"] {
    background-color: rgba(249, 115, 22, 0.2);
    color: #ea580c;
    border-bottom-color: #ea580c;
  }

  .prohibited-word[data-severity="low"] {
    background-color: rgba(234, 179, 8, 0.2);
    color: #ca8a04;
    border-bottom-color: #ca8a04;
  }
`

/**
 * 금지어 통계를 사람이 읽을 수 있는 형태로 변환
 */
export function formatDetectionSummary(result: DetectionResult): string {
  if (!result.found) return "금지어가 발견되지 않았습니다."

  const stats = getCategoryStats(result)
  const parts: string[] = []

  if (stats[ProhibitedCategory.ACCOUNT_NUMBER] > 0) {
    parts.push(`계좌번호 ${stats[ProhibitedCategory.ACCOUNT_NUMBER]}개`)
  }
  if (stats[ProhibitedCategory.PERSONAL_INFO] > 0) {
    parts.push(`개인정보 ${stats[ProhibitedCategory.PERSONAL_INFO]}개`)
  }
  if (stats[ProhibitedCategory.PROFANITY] > 0) {
    parts.push(`욕설 ${stats[ProhibitedCategory.PROFANITY]}개`)
  }
  if (stats[ProhibitedCategory.ILLEGAL] > 0) {
    parts.push(`불법 ${stats[ProhibitedCategory.ILLEGAL]}개`)
  }
  if (stats[ProhibitedCategory.SLANG] > 0) {
    parts.push(`의심표현 ${stats[ProhibitedCategory.SLANG]}개`)
  }

  return `금지어 발견: ${parts.join(", ")} (위험도: ${result.score}/100)`
}
