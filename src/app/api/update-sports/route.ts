import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// The Odds API에서 가져온 데이터 타입 정의
interface OddsApiGame {
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

interface ScoresApiGame {
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

// sports_matches 테이블 타입 정의
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

export async function GET(request: NextRequest) {
  try {
    const oddsApiKey = process.env.ODDS_API_KEY
    if (!oddsApiKey) {
      return NextResponse.json(
        { error: "ODDS_API_KEY가 설정되지 않았습니다" },
        { status: 500 }
      )
    }

    const sport = "soccer_korea_kleague_1"
    const baseUrl = "https://api.the-odds-api.com/v4/sports"
    
    // 1. 배당 및 일정 데이터 가져오기
    const oddsUrl = `${baseUrl}/${sport}/odds?apiKey=${oddsApiKey}&regions=kr&markets=h2h&oddsFormat=decimal`
    const oddsResponse = await fetch(oddsUrl)
    
    if (!oddsResponse.ok) {
      throw new Error(`Odds API error: ${oddsResponse.status} ${oddsResponse.statusText}`)
    }
    
    const oddsData: OddsApiGame[] = await oddsResponse.json()
    
    // 2. 경기 결과 데이터 가져오기
    const scoresUrl = `${baseUrl}/${sport}/scores?apiKey=${oddsApiKey}&daysFrom=3`
    const scoresResponse = await fetch(scoresUrl)
    
    if (!scoresResponse.ok) {
      throw new Error(`Scores API error: ${scoresResponse.status} ${scoresResponse.statusText}`)
    }
    
    const scoresData: ScoresApiGame[] = await scoresResponse.json()
    
    // 3. 데이터 변환 및 병합
    const matchesMap = new Map<string, SportsMatch>()
    
    // 배당 데이터 처리 (예정된 경기 + 배당률)
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
      
      matchesMap.set(game.id, {
        id: game.id,
        sport_key: game.sport_key,
        commence_time: game.commence_time,
        home_team: game.home_team,
        away_team: game.away_team,
        odds_home: oddsHome,
        odds_draw: oddsDraw,
        odds_away: oddsAway,
        is_finished: false
      })
    }
    
    // 경기 결과 데이터 처리 (완료된 경기 + 스코어)
    for (const game of scoresData) {
      if (game.completed && game.scores && game.scores.length >= 2) {
        const homeScoreObj = game.scores.find(s => s.name === game.home_team)
        const awayScoreObj = game.scores.find(s => s.name === game.away_team)
        
        // 이미 배당 데이터가 있으면 병합, 없으면 새로 생성
        const existingMatch = matchesMap.get(game.id)
        if (existingMatch) {
          existingMatch.home_score = homeScoreObj ? parseInt(homeScoreObj.score) : undefined
          existingMatch.away_score = awayScoreObj ? parseInt(awayScoreObj.score) : undefined
          existingMatch.is_finished = true
        } else {
          matchesMap.set(game.id, {
            id: game.id,
            sport_key: game.sport_key,
            commence_time: game.commence_time,
            home_team: game.home_team,
            away_team: game.away_team,
            home_score: homeScoreObj ? parseInt(homeScoreObj.score) : undefined,
            away_score: awayScoreObj ? parseInt(awayScoreObj.score) : undefined,
            is_finished: true
          })
        }
      }
    }
    
    const matches = Array.from(matchesMap.values())
    
    // 4. Supabase에 데이터 upsert
    const supabase = await createClient()
    
    if (matches.length === 0) {
      return NextResponse.json({
        success: true,
        message: "업데이트할 경기가 없습니다",
        updated: 0
      })
    }
    
    const { data, error } = await supabase
      .from('sports_matches')
      .upsert(matches, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
    
    if (error) {
      console.error("Supabase upsert error:", error)
      return NextResponse.json(
        { error: "데이터베이스 업데이트 실패", details: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: "스포츠 데이터가 성공적으로 업데이트되었습니다",
      updated: matches.length,
      scheduled: oddsData.length,
      completed: scoresData.filter(g => g.completed).length
    })
    
  } catch (error) {
    console.error("Update sports error:", error)
    return NextResponse.json(
      { 
        error: "스포츠 데이터 업데이트 중 오류 발생",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
