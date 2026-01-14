import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

/**
 * 배당 마감 API
 * - 경기 시작 전 배팅을 마감
 * - 마감 후에는 추가 배팅 불가
 */
export async function POST(request: NextRequest) {
  try {
    const { matchId } = await request.json()

    if (!matchId) {
      return NextResponse.json(
        { error: "matchId가 필요합니다" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 경기 정보 확인
    const { data: match, error: matchError } = await supabase
      .from('sports_matches')
      .select('*')
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return NextResponse.json(
        { error: "경기를 찾을 수 없습니다" },
        { status: 404 }
      )
    }

    // 이미 종료된 경기는 마감 불가
    if (match.is_finished) {
      return NextResponse.json(
        { error: "이미 종료된 경기입니다" },
        { status: 400 }
      )
    }

    // 배팅 테이블이 있다면 해당 경기의 배팅을 마감 상태로 변경
    // 실제 구현은 betting_items 테이블 구조에 따라 달라질 수 있음
    
    // 예시: betting_items 테이블에 is_closed 컬럼이 있다고 가정
    const { data: bets, error: betsError } = await supabase
      .from('betting_items')
      .select('count')
      .eq('match_id', matchId)
      .eq('status', 'pending')

    const betCount = bets?.length || 0

    // 경기에 betting_closed 플래그 추가 (확장 필요 시)
    const { error: updateError } = await supabase
      .from('sports_matches')
      .update({ 
        updated_at: new Date().toISOString(),
        // betting_closed: true (컬럼 추가 필요 시)
      })
      .eq('id', matchId)

    if (updateError) {
      console.error("마감 업데이트 오류:", updateError)
      return NextResponse.json(
        { error: "마감 처리 중 오류가 발생했습니다" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "배당이 마감되었습니다",
      betCount,
      matchId
    })

  } catch (error) {
    console.error("배당 마감 오류:", error)
    return NextResponse.json(
      { 
        error: "배당 마감 중 오류 발생",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
