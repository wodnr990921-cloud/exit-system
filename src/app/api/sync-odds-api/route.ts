import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4/sports';

// 멀티 리그 설정 (확장판)
const LEAGUES = [
  // 한국 리그
  { key: 'soccer_korea_kleague_1', name: 'K리그1', category: '국내축구' },
  
  // 유럽 5대 리그
  { key: 'soccer_epl', name: 'EPL', category: '유럽축구' },
  { key: 'soccer_spain_la_liga', name: '라리가', category: '유럽축구' },
  { key: 'soccer_italy_serie_a', name: '세리에A', category: '유럽축구' },
  { key: 'soccer_germany_bundesliga', name: '분데스리가', category: '유럽축구' },
  { key: 'soccer_france_ligue_one', name: '리그앙', category: '유럽축구' },
  
  // 유럽 대회
  { key: 'soccer_uefa_champs_league', name: 'UEFA 챔피언스리그', category: '유럽대회' },
  { key: 'soccer_uefa_europa_league', name: 'UEFA 유로파리그', category: '유럽대회' },
  
  // 기타 유럽
  { key: 'soccer_netherlands_eredivisie', name: '에레디비시', category: '유럽축구' },
  { key: 'soccer_portugal_primeira_liga', name: '포르투갈리그', category: '유럽축구' },
  
  // 남미
  { key: 'soccer_brazil_campeonato', name: '브라질리그', category: '남미축구' },
  { key: 'soccer_argentina_primera_division', name: '아르헨티나리그', category: '남미축구' },
  
  // 미국
  { key: 'soccer_usa_mls', name: 'MLS', category: '미국축구' },
  
  // 농구 (추가)
  { key: 'basketball_nba', name: 'NBA', category: '농구' },
  { key: 'basketball_euroleague', name: '유로리그', category: '농구' },
  
  // 야구 (추가)
  { key: 'baseball_mlb', name: 'MLB', category: '야구' },
  
  // 아이스하키 (추가)
  { key: 'icehockey_nhl', name: 'NHL', category: '아이스하키' },
];

interface OddsData {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: Array<{
        name: string;
        price: number;
      }>;
    }>;
  }>;
}

interface ScoreData {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  completed: boolean;
  scores?: Array<{
    name: string;
    score: string | number;
  }>;
}

interface MatchData {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  odds_home?: number;
  odds_draw?: number;
  odds_away?: number;
  home_score?: number;
  away_score?: number;
  is_finished: boolean;
}

/**
 * 사장님 특별 룰: 평균 배당에서 0.1 차감
 */
function applyBossRule(odds: number): number {
  return Math.max(1.01, Number((odds - 0.1).toFixed(2)));
}

/**
 * 여러 북메이커의 배당률 평균 계산 후 사장님 룰 적용
 */
function calculateAverageOdds(bookmakers: any[], homeTeam: string, awayTeam: string) {
  if (!bookmakers || bookmakers.length === 0) {
    return { home: undefined, draw: undefined, away: undefined };
  }

  const homeOdds: number[] = [];
  const drawOdds: number[] = [];
  const awayOdds: number[] = [];

  bookmakers.forEach((bookmaker) => {
    const h2hMarket = bookmaker.markets?.find((m: any) => m.key === 'h2h');
    if (h2hMarket && h2hMarket.outcomes) {
      h2hMarket.outcomes.forEach((outcome: any) => {
        if (outcome.name === homeTeam) {
          homeOdds.push(outcome.price);
        } else if (outcome.name === awayTeam) {
          awayOdds.push(outcome.price);
        } else if (outcome.name === 'Draw') {
          drawOdds.push(outcome.price);
        }
      });
    }
  });

  const avgHome = homeOdds.length > 0 
    ? homeOdds.reduce((a, b) => a + b, 0) / homeOdds.length 
    : undefined;
  
  const avgDraw = drawOdds.length > 0 
    ? drawOdds.reduce((a, b) => a + b, 0) / drawOdds.length 
    : undefined;
  
  const avgAway = awayOdds.length > 0 
    ? awayOdds.reduce((a, b) => a + b, 0) / awayOdds.length 
    : undefined;

  return {
    home: avgHome ? applyBossRule(avgHome) : undefined,
    draw: avgDraw ? applyBossRule(avgDraw) : undefined,
    away: avgAway ? applyBossRule(avgAway) : undefined,
  };
}

/**
 * UTC 시간을 KST로 변환
 */
function toKST(utcTime: string): string {
  const date = new Date(utcTime);
  // KST는 UTC+9
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString();
}

/**
 * 경기가 종료된 지 오래되었는지 확인 (7일 이상 지난 경기는 제외)
 */
function shouldSkipOldMatch(commenceTime: string): boolean {
  const matchDate = new Date(commenceTime);
  const now = new Date();
  const daysDiff = (now.getTime() - matchDate.getTime()) / (1000 * 60 * 60 * 24);
  
  // 경기 시작 시간이 7일 이상 지났으면 스킵
  return daysDiff > 7;
}

/**
 * 특정 리그의 배당 데이터 가져오기
 */
async function fetchOddsForLeague(leagueKey: string): Promise<OddsData[]> {
  const url = `${ODDS_API_BASE}/${leagueKey}/odds?apiKey=${ODDS_API_KEY}&regions=eu,kr&markets=h2h&oddsFormat=decimal`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ [${leagueKey}] 배당 데이터: ${data.length}개 경기`);
    return data;
  } catch (error: any) {
    console.error(`❌ [${leagueKey}] 배당 데이터 가져오기 실패:`, error.message);
    return [];
  }
}

/**
 * 특정 리그의 점수 데이터 가져오기
 */
async function fetchScoresForLeague(leagueKey: string): Promise<ScoreData[]> {
  // daysFrom=3: 최근 3일간의 경기 결과 조회
  const url = `${ODDS_API_BASE}/${leagueKey}/scores?apiKey=${ODDS_API_KEY}&daysFrom=3`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ [${leagueKey}] 점수 데이터: ${data.length}개 경기`);
    return data;
  } catch (error: any) {
    console.error(`❌ [${leagueKey}] 점수 데이터 가져오기 실패:`, error.message);
    return [];
  }
}

/**
 * 리그별 데이터 통합 처리
 */
async function processLeague(leagueKey: string, leagueName: string) {
  console.log(`\n━━━ [${leagueName}] 동기화 시작 ━━━`);

  // 1. 배당 및 점수 데이터 병렬로 가져오기
  const [oddsData, scoresData] = await Promise.all([
    fetchOddsForLeague(leagueKey),
    fetchScoresForLeague(leagueKey),
  ]);

  // 2. 점수 데이터를 Map으로 변환 (빠른 조회)
  const scoresMap = new Map<string, ScoreData>();
  scoresData.forEach((score) => {
    scoresMap.set(score.id, score);
  });

  // 3. 배당 데이터를 기반으로 경기 정보 생성
  const matches: MatchData[] = [];
  let skippedCount = 0;

  for (const game of oddsData) {
    // 오래된 경기는 스킵
    if (shouldSkipOldMatch(game.commence_time)) {
      skippedCount++;
      continue;
    }

    const scoreData = scoresMap.get(game.id);
    const isFinished = scoreData?.completed || false;

    // 배당률 계산 (평균 - 0.1)
    const odds = calculateAverageOdds(game.bookmakers || [], game.home_team, game.away_team);

    // 점수 추출
    let homeScore: number | undefined;
    let awayScore: number | undefined;

    if (isFinished && scoreData?.scores) {
      const homeScoreData = scoreData.scores.find((s) => s.name === game.home_team);
      const awayScoreData = scoreData.scores.find((s) => s.name === game.away_team);

      homeScore = homeScoreData ? Number(homeScoreData.score) : undefined;
      awayScore = awayScoreData ? Number(awayScoreData.score) : undefined;
    }

    matches.push({
      id: `${leagueKey}_${game.id}`,
      sport_key: leagueKey,
      commence_time: toKST(game.commence_time),
      home_team: game.home_team,
      away_team: game.away_team,
      odds_home: odds.home,
      odds_draw: odds.draw,
      odds_away: odds.away,
      home_score: homeScore,
      away_score: awayScore,
      is_finished: isFinished,
    });
  }

  console.log(`📊 [${leagueName}] 처리 완료: ${matches.length}개 저장, ${skippedCount}개 스킵`);

  return matches;
}

/**
 * 배당 변동 감지 및 히스토리 저장
 */
async function trackOddsChanges(newMatches: MatchData[]) {
  if (newMatches.length === 0) return { tracked: 0, changes: 0 };

  const matchIds = newMatches.map(m => m.id);
  
  // 기존 경기 데이터 조회
  const { data: existingMatches, error } = await supabase
    .from('sports_matches')
    .select('id, odds_home, odds_draw, odds_away, home_team, away_team, sport_key')
    .in('id', matchIds);

  if (error) {
    console.error('⚠️  기존 배당 조회 실패:', error);
    return { tracked: 0, changes: 0 };
  }

  if (!existingMatches || existingMatches.length === 0) {
    console.log('📝 신규 경기 - 배당 히스토리 없음');
    return { tracked: 0, changes: 0 };
  }

  // 기존 배당을 Map으로 변환
  const existingOddsMap = new Map(
    existingMatches.map(m => [m.id, m])
  );

  const oddsChanges: any[] = [];

  // 배당 변동 감지
  for (const newMatch of newMatches) {
    const existing = existingOddsMap.get(newMatch.id);
    if (!existing) continue;

    const homeChanged = existing.odds_home !== newMatch.odds_home;
    const drawChanged = existing.odds_draw !== newMatch.odds_draw;
    const awayChanged = existing.odds_away !== newMatch.odds_away;

    // 배당이 하나라도 변경되었으면 기록
    if (homeChanged || drawChanged || awayChanged) {
      const changeHome = newMatch.odds_home && existing.odds_home
        ? Number((newMatch.odds_home - existing.odds_home).toFixed(2))
        : null;
      
      const changeDraw = newMatch.odds_draw && existing.odds_draw
        ? Number((newMatch.odds_draw - existing.odds_draw).toFixed(2))
        : null;
      
      const changeAway = newMatch.odds_away && existing.odds_away
        ? Number((newMatch.odds_away - existing.odds_away).toFixed(2))
        : null;

      // 변동 유형 판정
      const changes = [changeHome, changeDraw, changeAway].filter(c => c !== null);
      let changeType = 'mixed';
      
      if (changes.every(c => c && c > 0)) {
        changeType = 'increase'; // 모든 배당 상승
      } else if (changes.every(c => c && c < 0)) {
        changeType = 'decrease'; // 모든 배당 하락
      }

      oddsChanges.push({
        match_id: newMatch.id,
        sport_key: newMatch.sport_key,
        home_team: newMatch.home_team,
        away_team: newMatch.away_team,
        prev_odds_home: existing.odds_home,
        prev_odds_draw: existing.odds_draw,
        prev_odds_away: existing.odds_away,
        new_odds_home: newMatch.odds_home,
        new_odds_draw: newMatch.odds_draw,
        new_odds_away: newMatch.odds_away,
        change_home: changeHome,
        change_draw: changeDraw,
        change_away: changeAway,
        change_type: changeType,
      });
    }
  }

  // 배당 변동 이력 저장
  if (oddsChanges.length > 0) {
    const { error: insertError } = await supabase
      .from('odds_history')
      .insert(oddsChanges);

    if (insertError) {
      console.error('⚠️  배당 히스토리 저장 실패:', insertError);
    } else {
      console.log(`📊 배당 변동 감지: ${oddsChanges.length}건 기록됨`);
      
      // 변동 상세 로그
      oddsChanges.forEach(change => {
        const homeChange = change.change_home ? `홈: ${change.change_home > 0 ? '+' : ''}${change.change_home}` : '';
        const drawChange = change.change_draw ? `무: ${change.change_draw > 0 ? '+' : ''}${change.change_draw}` : '';
        const awayChange = change.change_away ? `원정: ${change.change_away > 0 ? '+' : ''}${change.change_away}` : '';
        
        console.log(`   • ${change.home_team} vs ${change.away_team}: ${[homeChange, drawChange, awayChange].filter(Boolean).join(', ')}`);
      });
    }
  } else {
    console.log('✓ 배당 변동 없음');
  }

  return { tracked: existingMatches.length, changes: oddsChanges.length };
}

/**
 * Supabase에 경기 데이터 저장 (배당 변동 추적 포함)
 */
async function saveMatches(matches: MatchData[]) {
  if (matches.length === 0) {
    console.log('⚠️  저장할 경기 데이터 없음');
    return { success: 0, failed: 0, oddsChanges: 0 };
  }

  // 1. 배당 변동 추적
  const trackingResult = await trackOddsChanges(matches);

  // 2. 경기 데이터 저장/업데이트
  const { data, error } = await supabase
    .from('sports_matches')
    .upsert(matches, { onConflict: 'id' });

  if (error) {
    console.error('❌ 저장 실패:', error);
    return { success: 0, failed: matches.length, oddsChanges: trackingResult.changes };
  }

  console.log(`✅ Supabase 저장 완료: ${matches.length}개`);
  return { 
    success: matches.length, 
    failed: 0,
    oddsChanges: trackingResult.changes 
  };
}

/**
 * 메인 동기화 핸들러
 */
export async function GET(request: Request) {
  console.log('\n⚽ The Odds API 멀티 리그 동기화 시작...\n');

  if (!ODDS_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'ODDS_API_KEY가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  const startTime = Date.now();
  const stats: Record<string, any> = {};

  try {
    // 모든 리그 순차적으로 처리
    const allMatches: MatchData[] = [];

    for (const league of LEAGUES) {
      const matches = await processLeague(league.key, league.name);
      allMatches.push(...matches);
      stats[league.name] = matches.length;
    }

    // Supabase에 한 번에 저장 (배당 변동 추적 포함)
    const saveResult = await saveMatches(allMatches);

    const duration = Date.now() - startTime;
    const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();

    return NextResponse.json({
      success: true,
      message: '멀티 리그 동기화 완료',
      stats: {
        total: allMatches.length,
        leagues: stats,
        saved: saveResult.success,
        failed: saveResult.failed,
        oddsChanges: saveResult.oddsChanges, // 배당 변동 건수
      },
      duration: `${duration}ms`,
      timestamp: kstNow,
      apiKey: ODDS_API_KEY ? '설정됨 ✅' : '미설정 ❌',
    });
  } catch (error: any) {
    console.error('❌ 동기화 실패:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || '알 수 없는 오류',
        timestamp: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Vercel Cron Job 지원
 */
export async function POST(request: Request) {
  return GET(request);
}
