import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkReadAccess } from "@/lib/.cursorrules/permissions"

/**
 * GET /api/inventory/alerts
 * 재고 부족 알림 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 읽기 권한 확인
    const { hasAccess } = await checkReadAccess()
    if (!hasAccess) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const supabase = await createClient()

    // 재고가 최소 수량 이하인 항목 조회
    const { data: lowStockItems, error: lowStockError } = await supabase
      .from("inventory")
      .select("*")
      .lte("current_stock", supabase.rpc("current_stock"))
      .order("current_stock", { ascending: true })

    // PostgreSQL에서 직접 비교
    const { data: allInventory, error } = await supabase
      .from("inventory_items")
      .select("*")
      .order("current_stock", { ascending: true })

    if (error) {
      console.error("Error fetching inventory alerts:", error)
      return NextResponse.json(
        { error: "재고 알림을 불러오는데 실패했습니다." },
        { status: 500 }
      )
    }

    // JavaScript에서 필터링
    const lowStock = allInventory.filter(
      (item: any) => item.current_stock <= item.min_quantity
    )
    const outOfStock = allInventory.filter((item: any) => item.current_stock === 0)

    // 알림 우선순위 설정
    const alerts = lowStock.map((item: any) => {
      const shortageRate = item.min_quantity > 0
        ? (item.min_quantity - item.current_stock) / item.min_quantity
        : 0

      let severity: "critical" | "warning" | "info"
      if (item.current_stock === 0) {
        severity = "critical"
      } else if (item.current_stock <= item.min_quantity * 0.5) {
        severity = "critical"
      } else if (item.current_stock <= item.min_quantity) {
        severity = "warning"
      } else {
        severity = "info"
      }

      return {
        ...item,
        severity,
        shortageRate: Math.round(shortageRate * 100),
        message: item.current_stock === 0
          ? `"${item.name}" 재고가 소진되었습니다.`
          : `"${item.name}" 재고가 부족합니다. (현재: ${item.current_stock}${item.unit}, 최소: ${item.min_quantity}${item.unit})`,
      }
    })

    // 심각도 순으로 정렬
    const sortedAlerts = alerts.sort((a: any, b: any) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })

    return NextResponse.json({
      success: true,
      alerts: sortedAlerts,
      stats: {
        totalAlerts: lowStock.length,
        criticalAlerts: outOfStock.length,
        warningAlerts: lowStock.length - outOfStock.length,
      },
    })
  } catch (error: any) {
    console.error("Inventory alerts API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
