/**
 * 크롤링 헬퍼 함수
 * 간편하게 사용할 수 있는 크롤링 유틸리티
 */

export interface CrawledGame {
  league: string
  homeTeam: string
  awayTeam: string
  homeScore?: number
  awayScore?: number
  gameDate: string
  gameTime?: string
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled"
  location?: string
}

export type CrawlMethod = "dummy" | "api" | "cheerio"

/**
 * 간단한 크롤링 함수
 * @param method - 크롤링 방식 (dummy: 테스트용, api: API 사용, cheerio: HTML 파싱)
 * @param url - Cheerio 방식일 때만 필요
 * @param league - 리그 이름 (기본값: KBO)
 * @returns 크롤링된 경기 목록
 */
export async function simpleCrawl(
  method: CrawlMethod = "dummy",
  url?: string,
  league: string = "KBO"
): Promise<CrawledGame[]> {
  try {
    const response = await fetch("/api/sports/crawl/simple", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method,
        url: method === "cheerio" ? url : undefined,
        league,
      }),
    })

    const data = await response.json()

    if (data.success) {
      return data.data as CrawledGame[]
    } else {
      console.error("크롤링 실패:", data.error)
      return []
    }
  } catch (error) {
    console.error("크롤링 에러:", error)
    return []
  }
}

/**
 * 더미 데이터 생성 (테스트용)
 */
export async function getDummyGames(): Promise<CrawledGame[]> {
  return simpleCrawl("dummy")
}

/**
 * API를 통한 경기 정보 가져오기
 */
export async function getGamesFromAPI(league: string = "KBO"): Promise<CrawledGame[]> {
  return simpleCrawl("api", undefined, league)
}

/**
 * HTML 파싱을 통한 크롤링
 */
export async function crawlGamesFromHTML(url: string): Promise<CrawledGame[]> {
  return simpleCrawl("cheerio", url)
}
