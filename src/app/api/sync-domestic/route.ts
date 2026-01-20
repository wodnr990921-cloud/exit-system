import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// API 키들
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const VOLLEYBALL_API_KEY = process.env.VOLLEYBALL_API_KEY;
const BASKETBALL_API_KEY = process.env.BASKETBALL_API_KEY;

interface TeamMapping {
  api_name: string;
  standard_name: string;
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

// 팀 이름 매핑 캐시 (요청마다 DB 조회를 줄이기 위해)
let teamMappingCache: Map<string, Map<string, string>> = new Map();
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 팀 매핑 테이블을 로드하고 캐시에 저장
 */
async function loadTeamMappings() {
  const now = Date.now();
  
  // 캐시가 유효하면 재사용
  if (teamMappingCache.size > 0 && now - cacheTimestamp < CACHE_TTL) {
    return;
  }

  const { data, error } = await supabase
    .from('team_mapping')
    .select('league, api_source, api_name, standard_name')
    .eq('is_active', true);

  if (error) {
    console.error('팀 매핑 로드 실패:', error);
    return;
  }

  // 캐시 초기화
  teamMappingCache.clear();

  // league + api_source 조합을 키로 사용
  data?.forEach((mapping) => {
    const key = `${mapping.league}:${mapping.api_source}`;
    if (!teamMappingCache.has(key)) {
      teamMappingCache.set(key, new Map());
    }
    teamMappingCache.get(key)!.set(mapping.api_name, mapping.standard_name);
  });

  cacheTimestamp = now;
  console.log(`✅ 팀 매핑 로드 완료: ${data?.length}개 항목`);
}

/**
 * API 이름을 표준 이름으로 변환
 */
function convertTeamName(
  league: string,
  apiSource: string,
  apiName: string
): { converted: string; found: boolean } {
  const key = `${league}:${apiSource}`;
  const mappings = teamMappingCache.get(key);

  if (mappings && mappings.has(apiName)) {
    return { converted: mappings.get(apiName)!, found: true };
  }

  // 매핑을 찾지 못한 경우 로그 남기고 원본 이름 반환
  console.warn(`⚠️ 팀 매핑 없음: [${league}/${apiSource}] "${apiName}"`);
  return { converted: apiName, found: false };
}

/**
 * K-리그 데이터 가져오기 (The Odds API)
 */
async function fetchKLeagueData(): Promise<MatchData[]> {
  if (!ODDS_API_KEY) {
    console.warn('⚠️ ODDS_API_KEY 없음 - K-리그 동기화 스킵');
    return [];
  }

  const matches: MatchData[] = [];

  try {
    // 1. 배당(Odds) 데이터 가져오기
    const oddsUrl = `https://api.the-odds-api.com/v4/sports/soccer_korea_kleague_1/odds?apiKey=${ODDS_API_KEY}&regions=kr&markets=h2h&oddsFormat=decimal`;
    const oddsRes = await fetch(oddsUrl);
    const oddsData = await oddsRes.json();

    // 2. 점수(Scores) 데이터 가져오기
    const scoresUrl = `https://api.the-odds-api.com/v4/sports/soccer_korea_kleague_1/scores?apiKey=${ODDS_API_KEY}&daysFrom=3`;
    const scoresRes = await fetch(scoresUrl);
    const scoresData = await scoresRes.json();

    // 점수 데이터를 맵으로 변환 (빠른 조회)
    const scoresMap = new Map();
    if (Array.isArray(scoresData)) {
      scoresData.forEach((score: any) => {
        scoresMap.set(score.id, score);
      });
    }

    // 배당 데이터 처리
    if (Array.isArray(oddsData)) {
      for (const game of oddsData) {
        const homeTeam = convertTeamName('K-LEAGUE', 'The Odds API', game.home_team);
        const awayTeam = convertTeamName('K-LEAGUE', 'The Odds API', game.away_team);

        // 배당률 추출 (첫 번째 bookmaker 사용)
        let oddsHome, oddsDraw, oddsAway;
        if (game.bookmakers && game.bookmakers.length > 0) {
          const market = game.bookmakers[0].markets.find((m: any) => m.key === 'h2h');
          if (market && market.outcomes) {
            const homeOutcome = market.outcomes.find((o: any) => o.name === game.home_team);
            const awayOutcome = market.outcomes.find((o: any) => o.name === game.away_team);
            const drawOutcome = market.outcomes.find((o: any) => o.name === 'Draw');

            oddsHome = homeOutcome?.price;
            oddsAway = awayOutcome?.price;
            oddsDraw = drawOutcome?.price;
          }
        }

        // 점수 데이터 확인
        const scoreData = scoresMap.get(game.id);
        const hasScores = scoreData && scoreData.completed;

        matches.push({
          id: `kleague_${game.id}`,
          sport_key: 'K-LEAGUE',
          commence_time: game.commence_time,
          home_team: homeTeam.converted,
          away_team: awayTeam.converted,
          odds_home: oddsHome,
          odds_draw: oddsDraw,
          odds_away: oddsAway,
          home_score: hasScores ? scoreData.scores?.find((s: any) => s.name === game.home_team)?.score : undefined,
          away_score: hasScores ? scoreData.scores?.find((s: any) => s.name === game.away_team)?.score : undefined,
          is_finished: hasScores || false,
        });
      }
    }

    console.log(`✅ K-리그 데이터: ${matches.length}개 경기`);
  } catch (error) {
    console.error('❌ K-리그 데이터 가져오기 실패:', error);
  }

  return matches;
}

/**
 * KOVO 데이터 가져오기 (API-Volleyball)
 */
async function fetchKOVOData(): Promise<MatchData[]> {
  if (!VOLLEYBALL_API_KEY) {
    console.warn('⚠️ VOLLEYBALL_API_KEY 없음 - KOVO 동기화 스킵');
    return [];
  }

  const matches: MatchData[] = [];

  try {
    // API-Volleyball 엔드포인트 (예시 - 실제 API 문서에 맞춰 수정 필요)
    const url = `https://api.api-volleyball.com/v1/matches?league=kovo&apiKey=${VOLLEYBALL_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (Array.isArray(data.matches)) {
      for (const game of data.matches) {
        const homeTeam = convertTeamName('KOVO', 'API-Volleyball', game.home_team);
        const awayTeam = convertTeamName('KOVO', 'API-Volleyball', game.away_team);

        const hasScores = game.status === 'finished' && game.home_score !== null;

        matches.push({
          id: `kovo_${game.id}`,
          sport_key: 'KOVO',
          commence_time: game.match_time,
          home_team: homeTeam.converted,
          away_team: awayTeam.converted,
          odds_home: game.odds?.home,
          odds_draw: undefined, // 배구는 무승부 없음
          odds_away: game.odds?.away,
          home_score: hasScores ? game.home_score : undefined,
          away_score: hasScores ? game.away_score : undefined,
          is_finished: hasScores || false,
        });
      }
    }

    console.log(`✅ KOVO 데이터: ${matches.length}개 경기`);
  } catch (error) {
    console.error('❌ KOVO 데이터 가져오기 실패:', error);
  }

  return matches;
}

/**
 * KBL/WKBL 데이터 가져오기 (API-Basketball)
 */
async function fetchKBLData(): Promise<MatchData[]> {
  if (!BASKETBALL_API_KEY) {
    console.warn('⚠️ BASKETBALL_API_KEY 없음 - KBL 동기화 스킵');
    return [];
  }

  const matches: MatchData[] = [];

  try {
    // KBL 데이터
    const kblUrl = `https://api.api-basketball.com/v1/games?league=kbl&apiKey=${BASKETBALL_API_KEY}`;
    const kblRes = await fetch(kblUrl);
    const kblData = await kblRes.json();

    if (Array.isArray(kblData.response)) {
      for (const game of kblData.response) {
        const homeTeam = convertTeamName('KBL', 'API-Basketball', game.teams.home.name);
        const awayTeam = convertTeamName('KBL', 'API-Basketball', game.teams.away.name);

        const hasScores = game.scores && game.scores.home && game.scores.away;

        matches.push({
          id: `kbl_${game.id}`,
          sport_key: 'KBL',
          commence_time: game.date,
          home_team: homeTeam.converted,
          away_team: awayTeam.converted,
          odds_home: game.odds?.home,
          odds_draw: undefined, // 농구는 무승부 없음
          odds_away: game.odds?.away,
          home_score: hasScores ? game.scores.home.total : undefined,
          away_score: hasScores ? game.scores.away.total : undefined,
          is_finished: game.status.short === 'FT',
        });
      }
    }

    // WKBL 데이터
    const wkblUrl = `https://api.api-basketball.com/v1/games?league=wkbl&apiKey=${BASKETBALL_API_KEY}`;
    const wkblRes = await fetch(wkblUrl);
    const wkblData = await wkblRes.json();

    if (Array.isArray(wkblData.response)) {
      for (const game of wkblData.response) {
        const homeTeam = convertTeamName('WKBL', 'API-Basketball', game.teams.home.name);
        const awayTeam = convertTeamName('WKBL', 'API-Basketball', game.teams.away.name);

        const hasScores = game.scores && game.scores.home && game.scores.away;

        matches.push({
          id: `wkbl_${game.id}`,
          sport_key: 'WKBL',
          commence_time: game.date,
          home_team: homeTeam.converted,
          away_team: awayTeam.converted,
          odds_home: game.odds?.home,
          odds_draw: undefined,
          odds_away: game.odds?.away,
          home_score: hasScores ? game.scores.home.total : undefined,
          away_score: hasScores ? game.scores.away.total : undefined,
          is_finished: game.status.short === 'FT',
        });
      }
    }

    console.log(`✅ KBL/WKBL 데이터: ${matches.length}개 경기`);
  } catch (error) {
    console.error('❌ KBL/WKBL 데이터 가져오기 실패:', error);
  }

  return matches;
}

/**
 * 경기 데이터를 Supabase에 upsert
 */
async function upsertMatches(matches: MatchData[]) {
  if (matches.length === 0) {
    console.log('⚠️ upsert할 경기 없음');
    return { success: 0, failed: 0 };
  }

  const { data, error } = await supabase
    .from('sports_matches')
    .upsert(matches, { onConflict: 'id' });

  if (error) {
    console.error('❌ 경기 데이터 저장 실패:', error);
    return { success: 0, failed: matches.length };
  }

  console.log(`✅ 경기 데이터 저장 완료: ${matches.length}개`);
  return { success: matches.length, failed: 0 };
}

/**
 * 메인 동기화 핸들러
 */
export async function GET(request: Request) {
  console.log('🏀 국내 리그 동기화 시작...');

  const startTime = Date.now();

  try {
    // 1. 팀 매핑 테이블 로드
    await loadTeamMappings();

    // 2. 각 리그 데이터 병렬로 가져오기
    const [kLeagueMatches, kovoMatches, kblMatches] = await Promise.all([
      fetchKLeagueData(),
      fetchKOVOData(),
      fetchKBLData(),
    ]);

    // 3. 모든 경기 데이터 병합
    const allMatches = [...kLeagueMatches, ...kovoMatches, ...kblMatches];

    // 4. Supabase에 저장
    const result = await upsertMatches(allMatches);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: '국내 리그 동기화 완료',
      stats: {
        total: allMatches.length,
        kleague: kLeagueMatches.length,
        kovo: kovoMatches.length,
        kbl: kblMatches.length,
        saved: result.success,
        failed: result.failed,
      },
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ 동기화 실패:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || '알 수 없는 오류',
        timestamp: new Date().toISOString(),
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
