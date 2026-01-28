import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { normalizePointAmount } from "@/lib/point-utils"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { member_id, items } = await request.json()

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "최소 1개 이상의 아이템이 필요합니다." }, { status: 400 })
    }

    // 총액 계산
    const total_amount = items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0)

    // 티켓번호 생성 (YYYYMMDD-XXXXXX 형식)
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "")
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase()
    const ticket_no = `T${dateStr}-${randomStr}`

    // OpenAI로 요약 생성
    let ai_summary = ""
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY
      if (openaiApiKey) {
        // 비용 절감: 필요한 필드만 포함 (category, description, amount)
        const itemsText = items
          .map((item: any) => {
            const categoryNames: Record<string, string> = {
              book: "도서",
              game: "경기",
              goods: "물품",
              inquiry: "문의",
              complaint: "민원",
              other: "기타",
              complex: "복합",
            }
            // 최소한의 정보만 포함
            return JSON.stringify({
              category: categoryNames[item.category] || item.category,
              description: item.description || "",
              amount: item.amount || 0,
            })
          })
          .join("\n")

        const summaryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "user",
                content: `다음 티켓 아이템들을 간결하게 요약해주세요 (예: "도서 1권, 경기 1건 (총 35,000P)" 형식):

${itemsText}

요약 (총 개수와 금액 포함):`,
              },
            ],
            max_tokens: 150,
            temperature: 0.7,
          }),
        })

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json()
          ai_summary = summaryData.choices[0]?.message?.content?.trim() || ""
        }
      }
    } catch (error) {
      console.error("Error generating summary:", error)
      // 요약 실패해도 티켓은 생성
    }

    // 트랜잭션으로 tasks와 task_items 저장
    const { data: taskData, error: taskError } = await supabase
      .from("tasks")
      .insert([
        {
          user_id: user.id,
          ticket_no: ticket_no,
          member_id: member_id || null,
          customer_id: member_id || null, // 호환성 유지
          total_amount: total_amount,
          ai_summary: ai_summary || null,
          status: "draft",
          title: `티켓 ${ticket_no}`,
          description: ai_summary || "",
        },
      ])
      .select()
      .single()

    if (taskError) {
      console.error("Error creating task:", taskError)
      return NextResponse.json({ error: "티켓 생성에 실패했습니다.", details: taskError.message }, { status: 500 })
    }

    // task_items 생성
    const taskItems = items.map((item: any) => ({
      task_id: taskData.id,
      category: item.category,
      description: item.description,
      amount: item.amount || 0,
      status: "pending",
    }))

    const { error: itemsError } = await supabase.from("task_items").insert(taskItems)

    if (itemsError) {
      console.error("Error creating task items:", itemsError)
      // 롤백: task 삭제
      await supabase.from("tasks").delete().eq("id", taskData.id)
      return NextResponse.json({ error: "아이템 저장에 실패했습니다.", details: itemsError.message }, { status: 500 })
    }

    // 포인트 동결 처리 (회원이 있는 경우)
    if (member_id && total_amount > 0) {
      try {
        // 회원 정보 조회
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .select("total_point_general, total_point_betting")
          .eq("id", member_id)
          .single()

        if (customerError) {
          console.error("Error fetching customer:", customerError)
          throw new Error("회원 정보를 찾을 수 없습니다.")
        }

        // 카테고리별로 포인트 분류
        let generalAmount = 0
        let bettingAmount = 0

        items.forEach((item: any) => {
          const amount = item.amount || 0
          if (item.category === "game") {
            // 경기는 배팅 포인트
            bettingAmount += amount
          } else {
            // 나머지는 일반 포인트
            generalAmount += amount
          }
        })

        // 잔액 확인
        const availableGeneral = customer.total_point_general || 0
        const availableBetting = customer.total_point_betting || 0

        if (generalAmount > availableGeneral) {
          // 롤백
          await supabase.from("task_items").delete().eq("task_id", taskData.id)
          await supabase.from("tasks").delete().eq("id", taskData.id)
          return NextResponse.json(
            { error: `일반 포인트 잔액이 부족합니다. (필요: ${generalAmount}원, 보유: ${availableGeneral}원)` },
            { status: 400 }
          )
        }

        if (bettingAmount > availableBetting) {
          // 롤백
          await supabase.from("task_items").delete().eq("task_id", taskData.id)
          await supabase.from("tasks").delete().eq("id", taskData.id)
          return NextResponse.json(
            { error: `배팅 포인트 잔액이 부족합니다. (필요: ${bettingAmount}원, 보유: ${availableBetting}원)` },
            { status: 400 }
          )
        }

        // 포인트 동결 기록 (pending 상태로 저장)
        const pointRecords = []

        if (generalAmount > 0) {
          pointRecords.push({
            customer_id: member_id,
            user_id: user.id,
            amount: normalizePointAmount(generalAmount, "use"), // 자동으로 음수 처리
            category: "general",
            type: "use",
            status: "pending", // 동결 상태
            reason: `티켓 ${ticket_no} - 일반 포인트 사용`,
            requested_by: user.id,
          })
        }

        if (bettingAmount > 0) {
          pointRecords.push({
            customer_id: member_id,
            user_id: user.id,
            amount: normalizePointAmount(bettingAmount, "use"), // 자동으로 음수 처리
            category: "betting",
            type: "use",
            status: "pending", // 동결 상태
            reason: `티켓 ${ticket_no} - 배팅 포인트 사용`,
            requested_by: user.id,
          })
        }

        if (pointRecords.length > 0) {
          console.log("Creating point records for ticket:", ticket_no, pointRecords)

          const { error: pointError } = await supabase.from("points").insert(pointRecords)

          if (pointError) {
            console.error("Error creating point records:", pointError)
            // 롤백
            await supabase.from("task_items").delete().eq("task_id", taskData.id)
            await supabase.from("tasks").delete().eq("id", taskData.id)
            return NextResponse.json(
              { error: "포인트 동결 처리에 실패했습니다.", details: pointError.message },
              { status: 500 }
            )
          }
        }
      } catch (error: any) {
        console.error("Error processing points:", error)
        // 롤백
        await supabase.from("task_items").delete().eq("task_id", taskData.id)
        await supabase.from("tasks").delete().eq("id", taskData.id)
        return NextResponse.json(
          { error: error.message || "포인트 처리 중 오류가 발생했습니다." },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      ticket_no: ticket_no,
      task_id: taskData.id,
      message: "티켓이 성공적으로 생성되었습니다.",
    })
  } catch (error: any) {
    console.error("Create Ticket Error:", error)
    return NextResponse.json(
      { error: "티켓 생성 중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
