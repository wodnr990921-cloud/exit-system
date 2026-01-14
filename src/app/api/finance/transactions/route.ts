import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const category = searchParams.get("category")
    const date = searchParams.get("date")

    let query = supabase
      .from("points")
      .select(
        `
        id,
        customer_id,
        amount,
        category,
        type,
        status,
        reason,
        task_item_id,
        created_at,
        customer:customers!points_customer_id_fkey (
          id,
          member_number,
          name
        ),
        task_item:task_items!points_task_item_id_fkey (
          id,
          category,
          description,
          amount,
          status,
          details
        )
      `
      )
      .order("created_at", { ascending: false })

    // 필터 적용
    if (type) {
      query = query.eq("type", type)
    }
    if (category) {
      query = query.eq("category", category)
    }
    if (date) {
      const startDate = new Date(date)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(date)
      endDate.setHours(23, 59, 59, 999)

      query = query.gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString())
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching transactions:", error)
      return NextResponse.json({ error: "거래 내역을 불러오는데 실패했습니다." }, { status: 500 })
    }

    // task_items의 상세 정보 조회 (books, games 테이블 조인)
    const transactionsWithDetails = await Promise.all(
      (data || []).map(async (transaction: any) => {
        if (!transaction.task_item) {
          return transaction
        }

        const taskItem = transaction.task_item
        let itemDetails = null

        // book 카테고리의 경우 books 테이블에서 정보 가져오기
        if (taskItem.category === "book" && taskItem.details) {
          try {
            let details: any = {}
            if (typeof taskItem.details === "string") {
              details = JSON.parse(taskItem.details)
            } else if (typeof taskItem.details === "object") {
              details = taskItem.details
            }

            const bookId = details.book_id
            if (bookId) {
              const { data: book } = await supabase
                .from("books")
                .select("id, title, author")
                .eq("id", bookId)
                .single()

              if (book) {
                itemDetails = {
                  type: "book",
                  title: book.title,
                  author: book.author,
                  quantity: details.quantity || 1,
                }
              }
            }
          } catch (e) {
            console.error("Error parsing book details:", e)
          }
        }

        // game 카테고리의 경우 games 테이블에서 정보 가져오기
        if (taskItem.category === "game" && taskItem.details) {
          try {
            let details: any = {}
            if (typeof taskItem.details === "string") {
              details = JSON.parse(taskItem.details)
            } else if (typeof taskItem.details === "object") {
              details = taskItem.details
            }

            const gameId = details.game_id
            if (gameId) {
              const { data: game } = await supabase
                .from("games")
                .select("id, home_team, away_team")
                .eq("id", gameId)
                .single()

              if (game) {
                itemDetails = {
                  type: "game",
                  game_name: `${game.home_team} vs ${game.away_team}`,
                  choice: details.choice || "",
                  odds: details.odds || 1.0,
                }
              }
            }
          } catch (e) {
            console.error("Error parsing game details:", e)
          }
        }

        return {
          ...transaction,
          task_item: {
            ...taskItem,
            item_details: itemDetails,
          },
        }
      })
    )

    return NextResponse.json({ success: true, transactions: transactionsWithDetails })
  } catch (error: any) {
    console.error("Finance transactions API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
