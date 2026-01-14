import { NextRequest, NextResponse } from "next/server"
import puppeteer, { Browser, Page } from "puppeteer"

/**
 * 크롤링된 경기 데이터 인터페이스
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
 * 랜덤 User-Agent 생성
 */
function getRandomUserAgent(): string {
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  ]
  return userAgents[Math.floor(Math.random() * userAgents.length)]
}

/**
 * Puppeteer로 네이버 스포츠 페이지 크롤링 (스텔스 모드)
 */
async function crawlWithPuppeteer(url: string, maxRetries = 3): Promise<CrawledGame[]> {
  let browser: Browser | null = null
  let retryCount = 0

  while (retryCount < maxRetries) {
    try {
      console.log(`[CRAWL] 시도 ${retryCount + 1}/${maxRetries}: ${url}`)

      // Puppeteer 브라우저 실행 (헤드리스 모드)
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--window-size=1920,1080",
        ],
      })

      const page: Page = await browser.newPage()

      // 스텔스 모드 설정
      await page.setUserAgent(getRandomUserAgent())

      // webdriver 속성 숨기기 (자동화 탐지 방지)
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "webdriver", {
          get: () => false,
        })
      })

      // 추가 스텔스 설정
      await page.evaluateOnNewDocument(() => {
        // Chrome 객체 추가 (일반 브라우저처럼 보이게)
        ;(window as any).chrome = {
          runtime: {},
        }

        // Permissions API 오버라이드
        const originalQuery = window.navigator.permissions.query
        window.navigator.permissions.query = (parameters: any) =>
          parameters.name === "notifications"
            ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
            : originalQuery(parameters)

        // Plugin 배열 길이 설정
        Object.defineProperty(navigator, "plugins", {
          get: () => [1, 2, 3, 4, 5],
        })

        // Languages 설정
        Object.defineProperty(navigator, "languages", {
          get: () => ["ko-KR", "ko", "en-US", "en"],
        })
      })

      // 페이지 로딩 및 대기 (networkidle2: 네트워크가 2개 이하 연결일 때까지 대기)
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      })

      console.log(`[CRAWL] 페이지 로딩 완료`)

      // 페이지에서 경기 데이터 추출
      const games = await page.evaluate(() => {
        const results: any[] = []

        // 여러 셀렉터 시도 (네이버 스포츠는 스포츠별로 구조가 다름)
        const selectors = [
          ".sch_tb tbody tr",
          ".tb_wrap table tbody tr",
          ".schedule_table tbody tr",
          ".ScheduleAllListArea_match_item__P_2F8",
        ]

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector)

          if (elements.length > 0) {
            elements.forEach((element) => {
              try {
                // 테이블 형식 파싱
                const cells = element.querySelectorAll("td")
                if (cells.length >= 3) {
                  const dateText = cells[0]?.textContent?.trim() || ""
                  const timeText = cells[1]?.textContent?.trim() || ""
                  const homeTeam = cells[2]?.textContent?.trim() || ""
                  const scoreOrStatus = cells[3]?.textContent?.trim() || ""
                  const awayTeam = cells[4]?.textContent?.trim() || ""
                  const location = cells[5]?.textContent?.trim() || ""

                  if (homeTeam && awayTeam) {
                    results.push({
                      homeTeam,
                      awayTeam,
                      scoreOrStatus,
                      timeText,
                      dateText,
                      location,
                    })
                  }
                }

                // 카드 형식 파싱
                const homeTeamCard = element.querySelector(
                  ".ScheduleAllListArea_team__1fo3_ .ScheduleAllListArea_name__g7FBN"
                )?.textContent?.trim()
                const awayTeamCard = element.querySelector(
                  ".ScheduleAllListArea_team__1fo3_:last-child .ScheduleAllListArea_name__g7FBN"
                )?.textContent?.trim()

                if (homeTeamCard && awayTeamCard) {
                  const homeScore =
                    element.querySelector(".ScheduleAllListArea_team__1fo3_ .ScheduleAllListArea_score__vBJPy")
                      ?.textContent?.trim() || ""
                  const awayScore =
                    element.querySelector(
                      ".ScheduleAllListArea_team__1fo3_:last-child .ScheduleAllListArea_score__vBJPy"
                    )?.textContent?.trim() || ""
                  const status = element.querySelector(".ScheduleAllListArea_state__d6vVx")?.textContent?.trim() || ""
                  const time = element.querySelector(".ScheduleAllListArea_time__ajKOY")?.textContent?.trim() || ""

                  results.push({
                    homeTeam: homeTeamCard,
                    awayTeam: awayTeamCard,
                    scoreOrStatus: homeScore && awayScore ? `${homeScore}:${awayScore}` : status,
                    timeText: time,
                    dateText: "",
                    location: "",
                  })
                }
              } catch (err) {
                console.error("행 파싱 오류:", err)
              }
            })

            if (results.length > 0) {
              break // 성공적으로 파싱했으면 다른 셀렉터 시도 안 함
            }
          }
        }

        return results
      })

      await browser.close()

      if (games.length === 0) {
        throw new Error("크롤링된 경기 데이터가 없습니다.")
      }

      console.log(`[CRAWL] ${games.length}개의 경기 데이터 추출 완료`)

      // 데이터 가공
      const processedGames: CrawledGame[] = games.map((game: any) => {
        const scoreMatch = game.scoreOrStatus.match(/(\d+)\s*[:：-]\s*(\d+)/)
        const hasScore = scoreMatch !== null

        return {
          league: "네이버스포츠",
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          homeScore: hasScore ? parseInt(scoreMatch[1]) : undefined,
          awayScore: hasScore ? parseInt(scoreMatch[2]) : undefined,
          gameDate: new Date().toISOString(),
          gameTime: game.timeText || undefined,
          status: hasScore ? "finished" : "scheduled",
          location: game.location || undefined,
        }
      })

      return processedGames
    } catch (error) {
      console.error(`[CRAWL] 시도 ${retryCount + 1} 실패:`, error)

      if (browser) {
        await browser.close()
      }

      retryCount++

      if (retryCount < maxRetries) {
        console.log(`[CRAWL] 2초 후 재시도...`)
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } else {
        throw new Error(`최대 재시도 횟수(${maxRetries})를 초과했습니다: ${error}`)
      }
    }
  }

  throw new Error("크롤링 실패")
}

/**
 * POST /api/naver-crawl
 * Puppeteer를 사용한 네이버 스포츠 크롤링 (강력한 우회 모드)
 *
 * Request Body:
 * - url: string (크롤링할 네이버 스포츠 URL)
 * - maxRetries?: number (최대 재시도 횟수, 기본값: 3)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, maxRetries = 3 } = body as {
      url: string
      maxRetries?: number
    }

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error: "URL이 필요합니다.",
        },
        { status: 400 }
      )
    }

    // Puppeteer로 크롤링 실행
    const games = await crawlWithPuppeteer(url, maxRetries)

    return NextResponse.json({
      success: true,
      message: `${games.length}개의 경기를 크롤링했습니다.`,
      data: games,
    })
  } catch (error) {
    console.error("[CRAWL] 크롤링 오류:", error)
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
 * GET /api/naver-crawl
 * 헬스체크
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Naver Sports Crawl API (Puppeteer)",
    features: [
      "Stealth Mode (User-Agent 랜덤, webdriver 숨김)",
      "네트워크 대기 (networkidle2)",
      "자동 재시도 (최대 3회, 2초 간격)",
      "정확한 데이터 추출 (경기 시간, 팀, 점수)",
    ],
  })
}
