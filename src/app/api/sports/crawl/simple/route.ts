import { NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"

/**
 * 크롤링된 경기 데이터
 */
interface CrawledGame {
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

/**
 * 방법 1: Cheerio를 사용한 간단한 HTML 파싱
 * Puppeteer보다 빠르고 가볍지만, JavaScript 렌더링이 필요한 페이지는 불가능
 */
async function crawlWithCheerio(url: string): Promise<CrawledGame[]> {
  try {
    console.log(`[CHEERIO-CRAWL] 크롤링 시작: ${url}`)

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const games: CrawledGame[] = []

    // 네이버 스포츠 일정 페이지 파싱 (예시)
    $(".sch_tb tbody tr").each((_, element) => {
      try {
        const $row = $(element)

        // 날짜
        const dateCell = $row.find(".date").text().trim()

        // 시간
        const timeCell = $row.find(".time").text().trim()

        // 팀 정보
        const awayTeam = $row.find(".team_lft .name").text().trim()
        const homeTeam = $row.find(".team_rgt .name").text().trim()

        // 점수
        const awayScoreText = $row.find(".team_lft .score").text().trim()
        const homeScoreText = $row.find(".team_rgt .score").text().trim()

        const awayScore = awayScoreText ? parseInt(awayScoreText) : undefined
        const homeScore = homeScoreText ? parseInt(homeScoreText) : undefined

        // 상태 판단
        let status: CrawledGame["status"] = "scheduled"
        if (homeScore !== undefined && awayScore !== undefined) {
          status = "finished"
        } else if (timeCell.includes("진행중")) {
          status = "live"
        }

        if (awayTeam && homeTeam) {
          games.push({
            league: "KBO",
            homeTeam,
            awayTeam,
            homeScore,
            awayScore,
            gameDate: dateCell || new Date().toISOString().split("T")[0],
            gameTime: timeCell,
            status,
          })
        }
      } catch (err) {
        console.warn("[CHEERIO-CRAWL] 행 파싱 실패:", err)
      }
    })

    console.log(`[CHEERIO-CRAWL] ${games.length}개 경기 크롤링 완료`)
    return games
  } catch (error) {
    console.error("[CHEERIO-CRAWL] 크롤링 오류:", error)
    throw error
  }
}

/**
 * 방법 2: 공개 스포츠 API 사용 (TheSportsDB 등)
 * 무료 API를 사용하여 경기 일정/결과 가져오기
 */
async function crawlWithPublicAPI(league: string = "KBO"): Promise<CrawledGame[]> {
  try {
    console.log(`[API-CRAWL] API 호출 시작: ${league}`)

    // TheSportsDB API (무료)
    // 한국 야구는 지원이 제한적이므로 대체 API 필요
    const apiUrl = `https://www.thesportsdb.com/api/v1/json/3/eventspastleague.php?id=4424`

    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }

    const data = await response.json()
    const games: CrawledGame[] = []

    if (data.events && Array.isArray(data.events)) {
      data.events.slice(0, 20).forEach((event: any) => {
        games.push({
          league: league,
          homeTeam: event.strHomeTeam || "Unknown",
          awayTeam: event.strAwayTeam || "Unknown",
          homeScore: event.intHomeScore ? parseInt(event.intHomeScore) : undefined,
          awayScore: event.intAwayScore ? parseInt(event.intAwayScore) : undefined,
          gameDate: event.dateEvent || new Date().toISOString().split("T")[0],
          gameTime: event.strTime || undefined,
          status: event.strStatus === "Match Finished" ? "finished" : "scheduled",
          location: event.strVenue || undefined,
        })
      })
    }

    console.log(`[API-CRAWL] ${games.length}개 경기 가져오기 완료`)
    return games
  } catch (error) {
    console.error("[API-CRAWL] API 호출 오류:", error)
    throw error
  }
}

/**
 * 방법 3: 더미 데이터 생성 (테스트/폴백용)
 */
function generateDummyGames(): CrawledGame[] {
  const teams = ["LG", "KT", "SSG", "NC", "두산", "KIA", "롯데", "삼성", "한화", "키움"]
  const games: CrawledGame[] = []

  const today = new Date()

  for (let i = 0; i < 5; i++) {
    const gameDate = new Date(today)
    gameDate.setDate(today.getDate() + i)

    const homeTeamIdx = Math.floor(Math.random() * teams.length)
    let awayTeamIdx = Math.floor(Math.random() * teams.length)
    while (awayTeamIdx === homeTeamIdx) {
      awayTeamIdx = Math.floor(Math.random() * teams.length)
    }

    games.push({
      league: "KBO",
      homeTeam: teams[homeTeamIdx],
      awayTeam: teams[awayTeamIdx],
      homeScore: Math.floor(Math.random() * 10),
      awayScore: Math.floor(Math.random() * 10),
      gameDate: gameDate.toISOString().split("T")[0],
      gameTime: "18:30",
      status: i === 0 ? "live" : i < 3 ? "scheduled" : "finished",
      location: `${teams[homeTeamIdx]} 홈구장`,
    })
  }

  console.log(`[DUMMY] ${games.length}개 더미 경기 생성`)
  return games
}

/**
 * POST /api/sports/crawl/simple
 * 간단한 크롤링 (Cheerio, API, 또는 더미 데이터)
 *
 * Request Body:
 * - method: "cheerio" | "api" | "dummy" (기본값: "cheerio")
 * - url?: string (cheerio 방식일 때만 필요)
 * - league?: string (api/dummy 방식일 때 리그 이름)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { method = "cheerio", url, league = "KBO" } = body as {
      method?: "cheerio" | "api" | "dummy"
      url?: string
      league?: string
    }

    let games: CrawledGame[] = []

    switch (method) {
      case "cheerio":
        if (!url) {
          return NextResponse.json(
            {
              success: false,
              error: "Cheerio 방식은 url이 필요합니다.",
            },
            { status: 400 }
          )
        }
        games = await crawlWithCheerio(url)
        break

      case "api":
        games = await crawlWithPublicAPI(league)
        break

      case "dummy":
        games = generateDummyGames()
        break

      default:
        return NextResponse.json(
          {
            success: false,
            error: "지원하지 않는 방식입니다. (cheerio, api, dummy 중 선택)",
          },
          { status: 400 }
        )
    }

    if (games.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "크롤링된 데이터가 없습니다.",
          method,
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${method} 방식으로 ${games.length}개의 경기를 가져왔습니다.`,
      method,
      data: games,
    })
  } catch (error) {
    console.error("[SIMPLE-CRAWL] 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "크롤링 중 오류가 발생했습니다.",
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sports/crawl/simple
 * 헬스체크 및 사용 가능한 방식 안내
 */
export async function GET() {
  return NextResponse.json({
    service: "Simple Sports Crawling API",
    methods: {
      cheerio: {
        description: "HTML 파싱 (빠름, 정적 페이지만 가능)",
        example: {
          method: "cheerio",
          url: "https://sports.news.naver.com/kbaseball/schedule/index",
        },
      },
      api: {
        description: "공개 스포츠 API 사용 (안정적)",
        example: {
          method: "api",
          league: "KBO",
        },
      },
      dummy: {
        description: "더미 데이터 생성 (테스트용)",
        example: {
          method: "dummy",
          league: "KBO",
        },
      },
    },
  })
}
