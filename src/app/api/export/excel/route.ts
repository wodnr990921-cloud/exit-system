import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"

/**
 * GET /api/export/excel
 * 엑셀 다운로드 API (CSV 형식)
 * 쿼리 파라미터: type (points, transactions, settlements, audit-logs)
 * 권한: operator 이상
 */
export async function GET(request: NextRequest) {
  try {
    const { hasAccess } = await checkOperatorOrCEOAccess()
    if (!hasAccess) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    if (!type) {
      return NextResponse.json({ error: "타입이 필요합니다." }, { status: 400 })
    }

    let csvData = ""
    let filename = ""

    switch (type) {
      case "points": {
        // 포인트 거래 내역
        let query = supabase
          .from("points")
          .select(
            `
            id,
            customer_id,
            amount,
            balance_after,
            type,
            category,
            reason,
            status,
            approved_by,
            approved_at,
            created_at,
            customers!points_customer_id_fkey (
              member_number,
              name,
              phone
            )
          `
          )
          .order("created_at", { ascending: false })

        if (startDate) {
          query = query.gte("created_at", startDate)
        }
        if (endDate) {
          query = query.lte("created_at", endDate)
        }

        const { data, error } = await query

        if (error) {
          console.error("Error fetching points:", error)
          return NextResponse.json(
            { error: "포인트 내역을 불러오는데 실패했습니다." },
            { status: 500 }
          )
        }

        // CSV 헤더
        csvData =
          "거래ID,회원번호,회원명,전화번호,금액,거래후잔액,타입,카테고리,사유,상태,승인일시,생성일시\n"

        // CSV 데이터
        data.forEach((row: any) => {
          const customer = row.customers || {}
          csvData += [
            row.id,
            customer.member_number || "",
            `"${customer.name || ""}"`,
            customer.phone || "",
            row.amount,
            row.balance_after,
            row.type,
            row.category || "",
            `"${row.reason || ""}"`,
            row.status,
            row.approved_at || "",
            row.created_at,
          ].join(",")
          csvData += "\n"
        })

        filename = `points_${new Date().toISOString().split("T")[0]}.csv`
        break
      }

      case "transactions": {
        // 입출금 거래
        let query = supabase
          .from("finance_transactions")
          .select(
            `
            id,
            customer_id,
            amount,
            transaction_type,
            status,
            bank_name,
            account_number,
            depositor_name,
            description,
            created_at,
            customers!finance_transactions_customer_id_fkey (
              member_number,
              name,
              phone
            )
          `
          )
          .order("created_at", { ascending: false })

        if (startDate) {
          query = query.gte("created_at", startDate)
        }
        if (endDate) {
          query = query.lte("created_at", endDate)
        }

        const { data, error } = await query

        if (error) {
          console.error("Error fetching transactions:", error)
          return NextResponse.json(
            { error: "거래 내역을 불러오는데 실패했습니다." },
            { status: 500 }
          )
        }

        // CSV 헤더
        csvData =
          "거래ID,회원번호,회원명,전화번호,금액,거래타입,상태,은행명,계좌번호,입금자명,설명,생성일시\n"

        // CSV 데이터
        data.forEach((row: any) => {
          const customer = row.customers || {}
          csvData += [
            row.id,
            customer.member_number || "",
            `"${customer.name || ""}"`,
            customer.phone || "",
            row.amount,
            row.transaction_type,
            row.status,
            row.bank_name || "",
            row.account_number || "",
            `"${row.depositor_name || ""}"`,
            `"${row.description || ""}"`,
            row.created_at,
          ].join(",")
          csvData += "\n"
        })

        filename = `transactions_${new Date().toISOString().split("T")[0]}.csv`
        break
      }

      case "settlements": {
        // 정산 내역
        let query = supabase
          .from("settlements")
          .select("*")
          .order("settlement_year", { ascending: false })
          .order("settlement_month", { ascending: false })

        if (startDate || endDate) {
          // 날짜 필터링을 위해 년/월 파싱
          if (startDate) {
            const [year, month] = startDate.split("-")
            query = query.gte("settlement_year", parseInt(year))
          }
          if (endDate) {
            const [year, month] = endDate.split("-")
            query = query.lte("settlement_year", parseInt(year))
          }
        }

        const { data, error } = await query

        if (error) {
          console.error("Error fetching settlements:", error)
          return NextResponse.json(
            { error: "정산 내역을 불러오는데 실패했습니다." },
            { status: 500 }
          )
        }

        // CSV 헤더
        csvData = "정산ID,년도,월,매출,비용,배송비,순이익,이익률,생성일시\n"

        // CSV 데이터
        data.forEach((row: any) => {
          const profitMargin =
            row.revenue > 0 ? ((row.net_profit / row.revenue) * 100).toFixed(2) : 0
          csvData += [
            row.id,
            row.settlement_year,
            row.settlement_month,
            row.revenue || 0,
            row.cost || 0,
            row.shipping_cost || 0,
            row.net_profit || 0,
            profitMargin,
            row.created_at,
          ].join(",")
          csvData += "\n"
        })

        filename = `settlements_${new Date().toISOString().split("T")[0]}.csv`
        break
      }

      case "audit-logs": {
        // 감사 로그
        let query = supabase
          .from("audit_logs")
          .select(
            `
            id,
            user_id,
            action,
            table_name,
            record_id,
            ip_address,
            created_at,
            users!audit_logs_user_id_fkey (
              username,
              email
            )
          `
          )
          .order("created_at", { ascending: false })

        if (startDate) {
          query = query.gte("created_at", startDate)
        }
        if (endDate) {
          query = query.lte("created_at", endDate)
        }

        const { data, error } = await query

        if (error) {
          console.error("Error fetching audit logs:", error)
          return NextResponse.json(
            { error: "감사 로그를 불러오는데 실패했습니다." },
            { status: 500 }
          )
        }

        // CSV 헤더
        csvData = "로그ID,사용자ID,사용자명,이메일,액션,테이블,레코드ID,IP주소,생성일시\n"

        // CSV 데이터
        data.forEach((row: any) => {
          const user = row.users || {}
          csvData += [
            row.id,
            row.user_id,
            `"${user.username || ""}"`,
            user.email || "",
            row.action,
            row.table_name || "",
            row.record_id || "",
            row.ip_address || "",
            row.created_at,
          ].join(",")
          csvData += "\n"
        })

        filename = `audit_logs_${new Date().toISOString().split("T")[0]}.csv`
        break
      }

      default:
        return NextResponse.json({ error: "유효하지 않은 타입입니다." }, { status: 400 })
    }

    // BOM 추가 (엑셀에서 한글이 깨지지 않도록)
    const bom = "\uFEFF"
    const csvWithBom = bom + csvData

    // CSV 응답 반환
    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (error: any) {
    console.error("Export excel API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
