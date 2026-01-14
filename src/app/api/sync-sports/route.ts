import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// The Odds API 응답 타입
interface OddsGame {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers?: Array<{
    key: string
    title: string
    markets: Array<{
      key: string
      outcomes: Array<{
        name: string
        price: number
      }>
    }>
  }>
}

interface ScoresGame {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  scores?: Array<{
    name: string
    score: string
  }>
  completed: boolean
  last_update?: string
}

// Supabase sports_matches 테이블 타입
interface SportsMatch {
  id: string
  sport_key: string
  commence_time: string
  home_team: string
  away_team: string
  odds_home?: number
  odds_draw?: number
  odds_away?: number
  home_score?: number
  away_score?: number
  is_finished: boolean
}

/**
 * 스포츠 데이터 동기화 API
 * - The Odds API에서 K리그1 데이터 가져오기
 * - 배당률(odds)과 경기 결과(scores) 동기화
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // 1. 환경 변수 확인
    const oddsApiKey = process.env.ODDS_API_KEY
    if (!oddsApiKey) {
      return NextResponse.json(
        { error: "ODDS_API_KEY가 설정되지 않았습니다" },
        { status: 500 }
      )
    }

    const sport = "soccer_korea_kleague_1"
    const baseUrl = "https://api.the-odds-api.com/v4/sports"
    
    console.log(`[Sync Sports] 동기화 시작: ${sport}`)
    
    // 2. 배당률 데이터 가져오기 (odds)
    const oddsUrl = `${baseUrl}/${sport}/odds?apiKey=${oddsApiKey}&regions=kr&markets=h2h&oddsFormat=decimal`
    console.log(`[Sync Sports] 배당률 API 호출...`)
    
    const oddsResponse = await fetch(oddsUrl)
    if (!oddsResponse.ok) {
      throw new Error(`Odds API 오류: ${oddsResponse.status} ${oddsResponse.statusText}`)
    }
    const oddsData: OddsGame[] = await oddsResponse.json()
    console.log(`[Sync Sports] 배당률 데이터: ${oddsData.length}개 경기`)
    
    // 3. 경기 결과 데이터 가져오기 (scores)
    const scoresUrl = `${baseUrl}/${sport}/scores?apiKey=${oddsApiKey}&daysFrom=3`
    console.log(`[Sync Sports] 결과 API 호출...`)
    
    const scoresResponse = await fetch(scoresUrl)
    if (!scoresResponse.ok) {
      throw new Error(`Scores API 오류: ${scoresResponse.status} ${scoresResponse.statusText}`)
    }
    const scoresData: ScoresGame[] = await scoresResponse.json()
    console.log(`[Sync Sports] 결과 데이터: ${scoresData.length}개 경기`)
    
    // 4. 데이터 변환 및 병합
    const matchesMap = new Map<string, SportsMatch>()
    
    // 4-1. 배당률 데이터 처리
    for (const game of oddsData) {
      let oddsHome: number | undefined
      let oddsDraw: number | undefined
      let oddsAway: number | undefined
      
      // 첫 번째 북메이커의 h2h 마켓에서 배당률 추출
      if (game.bookmakers && game.bookmakers.length > 0) {
        const h2hMarket = game.bookmakers[0].markets.find(m => m.key === 'h2h')
        if (h2hMarket) {
          const homeOutcome = h2hMarket.outcomes.find(o => o.name === game.home_team)
          const awayOutcome = h2hMarket.outcomes.find(o => o.name === game.away_team)
          const drawOutcome = h2hMarket.outcomes.find(o => o.name === 'Draw')
          
          oddsHome = homeOutcome?.price
          oddsAway = awayOutcome?.price
          oddsDraw = drawOutcome?.price
        }
      }
      
      // KST 시간으로 변환 (UTC+9)
      const commenceTime = new Date(game.commence_time).toISOString()
      
      matchesMap.set(game.id, {
        id: game.id,
        sport_key: game.sport_key,
        commence_time: commenceTime,
        home_team: game.home_team,
        away_team: game.away_team,
        odds_home: oddsHome,
        odds_draw: oddsDraw,
        odds_away: oddsAway,
        is_finished: false
      })
    }
    
    // 4-2. 경기 결과 데이터 처리 및 병합
    let completedCount = 0
    for (const game of scoresData) {
      if (game.completed && game.scores && game.scores.length >= 2) {
        const homeScoreObj = game.scores.find(s => s.name === game.home_team)
        const awayScoreObj = game.scores.find(s => s.name === game.away_team)
        
        const homeScore = homeScoreObj ? parseInt(homeScoreObj.score) : undefined
        const awayScore = awayScoreObj ? parseInt(awayScoreObj.score) : undefined
        
        // 기존 경기 데이터가 있으면 결과만 추가
        const existingMatch = matchesMap.get(game.id)
        if (existingMatch) {
          existingMatch.home_score = homeScore
          existingMatch.away_score = awayScore
          existingMatch.is_finished = true
        } else {
          // 없으면 새로 생성
          const commenceTime = new Date(game.commence_time).toISOString()
          
          matchesMap.set(game.id, {
            id: game.id,
            sport_key: game.sport_key,
            commence_time: commenceTime,
            home_team: game.home_team,
            away_team: game.away_team,
            home_score: homeScore,
            away_score: awayScore,
            is_finished: true
          })
        }
        completedCount++
      }
    }
    
    const matches = Array.from(matchesMap.values())
    
    if (matches.length === 0) {
      return NextResponse.json({
        success: true,
        message: "동기화할 경기가 없습니다",
        data: {
          total: 0,
          scheduled: 0,
          completed: 0,
          duration: Date.now() - startTime
        }
      })
    }
    
    // 5. Supabase에 upsert
    console.log(`[Sync Sports] Supabase에 ${matches.length}개 경기 저장 중...`)
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('sports_matches')
      .upsert(matches, {
        onConflict: 'id'
      })
    
    if (error) {
      console.error("[Sync Sports] Supabase 오류:", error)
      return NextResponse.json(
        { 
          error: "데이터베이스 저장 실패",
          details: error.message 
        },
        { status: 500 }
      )
    }
    
    const duration = Date.now() - startTime
    console.log(`[Sync Sports] 완료! (${duration}ms)`)
    
    // 6. 성공 응답
    return NextResponse.json({
      success: true,
      message: "스포츠 데이터 동기화 완료",
      data: {
        total: matches.length,
        scheduled: matches.filter(m => !m.is_finished).length,
        completed: completedCount,
        duration
      },
      timestamp: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    console.error("[Sync Sports] 오류:", error)
    
    return NextResponse.json(
      { 
        error: "스포츠 데이터 동기화 실패",
        details: error instanceof Error ? error.message : String(error),
        duration
      },
      { status: 500 }
    )
  }
}
