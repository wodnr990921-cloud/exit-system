/**
 * 크롤링 유틸리티
 * - 재시도 로직
 * - 에러 처리
 * - Rate limiting
 */

export interface CrawlOptions {
  maxRetries?: number
  retryDelay?: number
  timeout?: number
  headers?: Record<string, string>
}

export interface CrawlResult<T> {
  success: boolean
  data?: T
  error?: string
  attempts?: number
}

/**
 * 기본 User-Agent 헤더
 */
export const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
}

/**
 * 지연 함수
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 재시도 로직이 포함된 fetch 함수
 */
export async function fetchWithRetry<T>(
  url: string,
  options: CrawlOptions = {}
): Promise<CrawlResult<string>> {
  const {
    maxRetries = 3,
    retryDelay = 2000,
    timeout = 10000,
    headers = DEFAULT_HEADERS,
  } = options

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const html = await response.text()

      return {
        success: true,
        data: html,
        attempts: attempt,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`Fetch attempt ${attempt}/${maxRetries} failed:`, lastError.message)

      // 마지막 시도가 아니면 대기 후 재시도
      if (attempt < maxRetries) {
        await delay(retryDelay * attempt) // 지수 백오프
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || "Unknown fetch error",
    attempts: maxRetries,
  }
}

/**
 * 날짜 파싱 헬퍼
 */
export function parseGameDate(dateStr: string, timeStr?: string): Date {
  const now = new Date()
  const date = new Date(now)

  // 날짜 파싱 (예: "01.14", "2026-01-14")
  if (dateStr.includes("-")) {
    date.setFullYear(parseInt(dateStr.split("-")[0]))
    date.setMonth(parseInt(dateStr.split("-")[1]) - 1)
    date.setDate(parseInt(dateStr.split("-")[2]))
  } else if (dateStr.includes(".")) {
    const [month, day] = dateStr.split(".").map((s) => parseInt(s))
    date.setMonth(month - 1)
    date.setDate(day)
  }

  // 시간 파싱 (예: "18:00", "오후 6:00")
  if (timeStr) {
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/)
    if (timeMatch) {
      let hours = parseInt(timeMatch[1])
      const minutes = parseInt(timeMatch[2])

      // 오후/오전 처리
      if (timeStr.includes("오후") && hours < 12) {
        hours += 12
      } else if (timeStr.includes("오전") && hours === 12) {
        hours = 0
      }

      date.setHours(hours, minutes, 0, 0)
    }
  }

  return date
}

/**
 * 점수 파싱 헬퍼
 */
export interface ParsedScore {
  home: number
  away: number
  isValid: boolean
}

export function parseScore(scoreText: string): ParsedScore {
  // "3:2", "3 : 2", "3-2" 등의 형식 지원
  const scoreMatch = scoreText.match(/(\d+)\s*[::\-]\s*(\d+)/)

  if (scoreMatch) {
    return {
      home: parseInt(scoreMatch[1]),
      away: parseInt(scoreMatch[2]),
      isValid: true,
    }
  }

  return {
    home: 0,
    away: 0,
    isValid: false,
  }
}

/**
 * 배당률 파싱 헬퍼
 */
export function parseOdds(oddsText: string): number {
  const oddsMatch = oddsText.match(/(\d+\.?\d*)/)
  if (oddsMatch) {
    return parseFloat(oddsMatch[1])
  }
  return 1.0
}

/**
 * 팀명 정규화 (공백, 특수문자 제거)
 */
export function normalizeTeamName(teamName: string): string {
  return teamName
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, "")
}

/**
 * 리그 코드를 리그명으로 변환
 */
export function getLeagueName(sport: string, league?: string): string {
  if (league) return league

  const leagueMap: Record<string, string> = {
    baseball: "KBO",
    soccer: "K-League",
    basketball: "KBL",
    football: "NFL",
  }

  return leagueMap[sport] || "Unknown"
}

/**
 * 스포츠 타입을 네이버 코드로 변환
 */
export function getSportCode(sport: string, source: "naver" | "daum" = "naver"): string {
  if (source === "naver") {
    const codeMap: Record<string, string> = {
      baseball: "kbaseball",
      soccer: "wfootball",
      basketball: "basketball",
      kbo: "kbaseball",
      mlb: "baseball",
      kbl: "basketball",
      nba: "basketball",
      "k-league": "wfootball",
      epl: "wfootball",
    }
    return codeMap[sport.toLowerCase()] || "kbaseball"
  } else {
    const codeMap: Record<string, string> = {
      baseball: "baseball",
      soccer: "football",
      basketball: "basketball",
      kbo: "baseball",
      mlb: "baseball",
      kbl: "basketball",
      nba: "basketball",
      "k-league": "football",
      epl: "football",
    }
    return codeMap[sport.toLowerCase()] || "baseball"
  }
}

/**
 * 경기 상태 판별
 */
export interface GameStatus {
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled"
  description: string
}

export function getGameStatus(statusText: string): GameStatus {
  const text = statusText.toLowerCase().trim()

  if (text.includes("종료") || text.includes("finished") || text.includes("final")) {
    return { status: "finished", description: "경기 종료" }
  }
  if (text.includes("진행") || text.includes("live") || text.includes("중")) {
    return { status: "live", description: "경기 중" }
  }
  if (text.includes("예정") || text.includes("scheduled") || text.match(/\d{2}:\d{2}/)) {
    return { status: "scheduled", description: "경기 예정" }
  }
  if (text.includes("연기") || text.includes("postponed")) {
    return { status: "postponed", description: "경기 연기" }
  }
  if (text.includes("취소") || text.includes("cancelled")) {
    return { status: "cancelled", description: "경기 취소" }
  }

  return { status: "scheduled", description: "상태 확인 필요" }
}

/**
 * Rate limiter 클래스
 */
export class RateLimiter {
  private queue: Array<() => void> = []
  private processing = false
  private lastRequestTime = 0

  constructor(
    private minInterval: number = 1000, // 최소 요청 간격 (ms)
    private maxConcurrent: number = 1 // 최대 동시 요청 수
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          // 최소 간격 대기
          const now = Date.now()
          const timeSinceLastRequest = now - this.lastRequestTime
          if (timeSinceLastRequest < this.minInterval) {
            await delay(this.minInterval - timeSinceLastRequest)
          }

          this.lastRequestTime = Date.now()
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          this.processNext()
        }
      })

      if (!this.processing) {
        this.processNext()
      }
    })
  }

  private processNext() {
    if (this.queue.length === 0) {
      this.processing = false
      return
    }

    this.processing = true
    const next = this.queue.shift()
    if (next) {
      next()
    }
  }
}

/**
 * 글로벌 Rate Limiter 인스턴스
 */
export const globalRateLimiter = new RateLimiter(2000, 1) // 2초 간격, 순차 처리
