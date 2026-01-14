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

    // task_items에서 'book' 또는 'goods' 카테고리만 필터링
    // details JSONB에서 book_id 추출 및 books 테이블 JOIN
    const { data: items, error: itemsError } = await supabase
      .from("task_items")
      .select(
        `
        *,
        tasks!task_items_task_id_fkey (
          id,
          ticket_no,
          member_id,
          customer:customers!tasks_member_id_fkey (
            member_number,
            name,
            institution,
            prison_number
          )
        )
      `
      )
      .in("category", ["book", "goods"])
      .in("status", ["approved", "pending"])
      .order("created_at", { ascending: false })

    if (itemsError) {
      console.error("Error fetching items:", itemsError)
      return NextResponse.json({ error: "아이템 목록을 불러오는데 실패했습니다." }, { status: 500 })
    }

    // 각 아이템의 details에서 book_id 추출 및 books 테이블 조회
    const itemsWithBooks = await Promise.all(
      (items || []).map(async (item: any) => {
        let bookInfo = null
        let stockQuantity = null
        let stockWarning = false

        if (item.category === "book" && item.details) {
          try {
            let details: any = {}
            if (typeof item.details === "string") {
              details = JSON.parse(item.details)
            } else if (typeof item.details === "object") {
              details = item.details
            }

            const bookId = details.book_id
            if (bookId) {
              // books 테이블 조회
              const { data: book, error: bookError } = await supabase
                .from("books")
                .select("id, title, author, stock_quantity")
                .eq("id", bookId)
                .single()

              if (!bookError && book) {
                bookInfo = {
                  id: book.id,
                  title: book.title,
                  author: book.author,
                }
                stockQuantity = book.stock_quantity || 0

                // 재고 확인 (수량이 1로 가정, 실제로는 details에서 quantity를 가져와야 할 수 있음)
                const requestedQuantity = details.quantity || 1
                if (requestedQuantity > stockQuantity) {
                  stockWarning = true
                }
              }
            }
          } catch (e) {
            console.error("Error parsing details:", e)
          }
        }

        return {
          ...item,
          bookInfo,
          stockQuantity,
          stockWarning,
        }
      })
    )

    return NextResponse.json({ success: true, items: itemsWithBooks })
  } catch (error: any) {
    console.error("Logistics items API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
