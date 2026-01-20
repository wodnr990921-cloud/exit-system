import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 배당 변동 이력 조회 API
 * 
 * 쿼리 파라미터:
 * - match_id: 특정 경기의 배당 히스토리
 * - sport_key: 특정 리그의 배당 히스토리
 * - hours: 최근 N시간 (기본값: 24)
 * - limit: 결과 개수 (기본값: 50)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const matchId = searchParams.get('match_id');
  const sportKey = searchParams.get('sport_key');
  const hours = parseInt(searchParams.get('hours') || '24');
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    let query = supabase
      .from('odds_history')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(limit);

    // 필터 적용
    if (matchId) {
      query = query.eq('match_id', matchId);
    }

    if (sportKey) {
      query = query.eq('sport_key', sportKey);
    }

    // 시간 범위 필터
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    query = query.gte('checked_at', cutoffTime);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // 통계 계산
    const stats = {
      total: data?.length || 0,
      increase: data?.filter(d => d.change_type === 'increase').length || 0,
      decrease: data?.filter(d => d.change_type === 'decrease').length || 0,
      mixed: data?.filter(d => d.change_type === 'mixed').length || 0,
    };

    return NextResponse.json({
      success: true,
      data: data || [],
      stats,
      params: {
        match_id: matchId,
        sport_key: sportKey,
        hours,
        limit,
      },
    });
  } catch (error: any) {
    console.error('배당 히스토리 조회 실패:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

/**
 * 배당 변동 통계 조회
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sport_keys, days = 7 } = body;

    // 통계 뷰에서 데이터 가져오기
    let query = supabase
      .from('odds_change_stats')
      .select('*');

    if (sport_keys && sport_keys.length > 0) {
      query = query.in('sport_key', sport_keys);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      stats: data || [],
      period_days: days,
    });
  } catch (error: any) {
    console.error('배당 통계 조회 실패:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
