import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

/**
 * 배팅 티켓 생성 API
 * - 티켓 시스템과 완전 통합
 * - 여러 경기를 한 티켓에 담을 수 있음
 */
export async function POST(request: NextRequest) {
  try {
    const { memberId, bets } = await request.json()

    if (!memberId || !bets || bets.length === 0) {
      return NextResponse.json(
        { error: "회원 ID와 배팅 정보가 필요합니다" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      )
    }

    // 회원 정보 확인
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, member_number, name')
      .eq('id', memberId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json(
        { error: "회원을 찾을 수 없습니다" },
        { status: 404 }
      )
    }

    // 경기 정보 확인 및 총액 계산
    let totalAmount = 0
    const betDetails = []

    for (const bet of bets) {
      const { matchId, choice, amount } = bet

      if (!matchId || !choice || !amount) {
        return NextResponse.json(
          { error: "배팅 정보가 올바르지 않습니다" },
          { status: 400 }
        )
      }

      // 경기 정보 가져오기
      const { data: match, error: matchError } = await supabase
        .from('sports_matches')
        .select('*')
        .eq('id', matchId)
        .single()

      if (matchError || !match) {
        return NextResponse.json(
          { error: `경기를 찾을 수 없습니다: ${matchId}` },
          { status: 404 }
        )
      }

      // 이미 종료된 경기는 배팅 불가
      if (match.is_finished) {
        return NextResponse.json(
          { error: `이미 종료된 경기입니다: ${match.home_team} vs ${match.away_team}` },
          { status: 400 }
        )
      }

      // 배당 마감된 경기 확인
      if (match.betting_closed) {
        return NextResponse.json(
          { error: `배당이 마감된 경기입니다: ${match.home_team} vs ${match.away_team}` },
          { status: 400 }
        )
      }

      // 배당률 확인
      const odds = 
        choice === 'home' ? match.odds_home :
        choice === 'away' ? match.odds_away :
        choice === 'draw' ? match.odds_draw : null

      if (!odds) {
        return NextResponse.json(
          { error: `배당률 정보가 없습니다: ${choice}` },
          { status: 400 }
        )
      }

      totalAmount += amount

      betDetails.push({
        matchId,
        match,
        choice,
        odds,
        amount,
        potentialWin: Math.floor(amount * odds)
      })
    }

    // 티켓 번호 생성
    const ticketNo = `BET-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    // AI 요약 생성
    const aiSummary = betDetails.map(b => 
      `${b.match.home_team} vs ${b.match.away_team} - ${
        b.choice === 'home' ? '홈승' : 
        b.choice === 'away' ? '원정승' : '무승부'
      } (${b.odds.toFixed(2)}) ${b.amount.toLocaleString()}P`
    ).join('\n')

    // 트랜잭션: tasks 생성
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        ticket_no: ticketNo,
        member_id: memberId,
        customer_id: memberId,
        total_amount: totalAmount,
        ai_summary: `스포츠 배팅 티켓\n\n${aiSummary}`,
        status: 'pending',
        title: `배팅 티켓 ${ticketNo}`,
        description: aiSummary
      })
      .select()
      .single()

    if (taskError) {
      console.error("티켓 생성 오류:", taskError)
      return NextResponse.json(
        { error: "티켓 생성 실패", details: taskError.message },
        { status: 500 }
      )
    }

    // task_items 생성 (배팅 아이템들)
    const taskItems = betDetails.map(bet => ({
      task_id: task.id,
      category: 'betting',
      description: `${bet.match.home_team} vs ${bet.match.away_team} - ${
        bet.choice === 'home' ? '홈승' : 
        bet.choice === 'away' ? '원정승' : '무승부'
      }`,
      amount: bet.amount,
      match_id: bet.matchId,
      betting_choice: bet.choice,
      betting_odds: bet.odds,
      potential_win: bet.potentialWin,
      status: 'pending'
    }))

    const { error: itemsError } = await supabase
      .from('task_items')
      .insert(taskItems)

    if (itemsError) {
      console.error("배팅 아이템 생성 오류:", itemsError)
      // 롤백: task 삭제
      await supabase.from('tasks').delete().eq('id', task.id)
      return NextResponse.json(
        { error: "배팅 아이템 생성 실패", details: itemsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      ticketNo,
      taskId: task.id,
      totalAmount,
      totalPotentialWin: betDetails.reduce((sum, b) => sum + b.potentialWin, 0),
      betCount: betDetails.length,
      message: "배팅 티켓이 생성되었습니다"
    })

  } catch (error) {
    console.error("배팅 티켓 생성 오류:", error)
    return NextResponse.json(
      { 
        error: "배팅 티켓 생성 중 오류 발생",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
