import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

// 리그명 매핑 (DB의 sport_key → 한글명)
const LEAGUE_NAMES: Record<string, string> = {
  // 축구
  'soccer_korea_kleague_1': 'K리그1',
  'soccer_epl': 'EPL',
  'soccer_spain_la_liga': '라리가',
  'soccer_italy_serie_a': '세리에A',
  'soccer_germany_bundesliga': '분데스리가',
  'soccer_france_ligue_one': '리그앙',
  'soccer_uefa_champs_league': 'UEFA 챔피언스리그',
  'soccer_uefa_europa_league': 'UEFA 유로파리그',
  'soccer_netherlands_eredivisie': '에레디비시',
  'soccer_portugal_primeira_liga': '포르투갈 리그',
  'soccer_brazil_campeonato': '브라질 리그',
  'soccer_argentina_primera_division': '아르헨티나 리그',
  'soccer_usa_mls': 'MLS',
  // 농구
  'basketball_nba': 'NBA',
  'basketball_euroleague': '유로리그',
  // 야구
  'baseball_mlb': 'MLB',
  // 아이스하키
  'icehockey_nhl': 'NHL',
}

/**
 * 경기 일정 조회 API (통합)
 * - sports_matches 테이블에서 모든 리그의 예정된 경기 조회
 * - 리그별 필터링 지원
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const sportKey = searchParams.get('sport') // 특정 리그만 조회 (선택사항)
    const daysAhead = parseInt(searchParams.get('daysAhead') || '30')
    
    // 현재 시간 (KST)
    const now = new Date()
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

    // Supabase 쿼리 구성
    let query = supabase
      .from('sports_matches')
      .select('*')
      .eq('is_finished', false) // 종료되지 않은 경기만
      .gte('commence_time', now.toISOString()) // 현재 이후 경기
      .lte('commence_time', futureDate.toISOString()) // N일 이내 경기
      .order('commence_time', { ascending: true })

    // 특정 리그 필터
    if (sportKey) {
      query = query.eq('sport_key', sportKey)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    // 데이터 변환 및 그룹화
    const schedule = (data || []).map((match: any) => ({
      id: match.id,
      sportKey: match.sport_key,
      sportTitle: LEAGUE_NAMES[match.sport_key] || match.sport_key,
      commenceTime: match.commence_time,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      oddsHome: match.odds_home,
      oddsDraw: match.odds_draw,
      oddsAway: match.odds_away,
      bettingClosed: match.betting_closed || false,
    }))

    // 리그별 통계
    const leagueStats: Record<string, number> = {}
    schedule.forEach((game: any) => {
      leagueStats[game.sportTitle] = (leagueStats[game.sportTitle] || 0) + 1
    })

    console.log(`[Schedule] 조회 완료: 총 ${schedule.length}개 경기`)

    return NextResponse.json({
      success: true,
      sport: sportKey || 'all',
      count: schedule.length,
      schedule,
      stats: leagueStats,
      message: `${schedule.length}개의 예정된 경기를 찾았습니다`
    })

  } catch (error) {
    console.error("[Schedule] 오류:", error)
    return NextResponse.json(
      { 
        error: "경기 일정 조회 실패",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
