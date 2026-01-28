"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface DailyData {
  todayIncome: number
  todayExpense: number
  todayProfit: number
  pendingApprovalsCount: number
}

export default function DailyPanel() {
  const router = useRouter()
  const supabase = createClient()
  const [data, setData] = useState<DailyData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDailyData()
  }, [])

  const fetchDailyData = async () => {
    try {
      // 오늘 날짜 범위 계산
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const todayStr = today.toISOString()
      const tomorrowStr = tomorrow.toISOString()

      // 1. 금일 입금 (충전) - approved 상태
      const { data: incomeData, error: incomeError } = await supabase
        .from("points")
        .select("amount")
        .eq("type", "charge")
        .eq("status", "approved")
        .gte("created_at", todayStr)
        .lt("created_at", tomorrowStr)

      if (incomeError) throw incomeError

      const todayIncome = incomeData?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0

      // 2. 금일 지출 (사용) - approved 상태
      const { data: expenseData, error: expenseError } = await supabase
        .from("points")
        .select("amount")
        .eq("type", "use")
        .eq("status", "approved")
        .gte("created_at", todayStr)
        .lt("created_at", tomorrowStr)

      if (expenseError) throw expenseError

      const todayExpense = expenseData?.reduce((sum, item) => sum + Math.abs(item.amount || 0), 0) || 0

      // 3. 승인 대기 건수
      const { count: pendingCount, error: pendingError } = await supabase
        .from("points")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")

      if (pendingError) throw pendingError

      const pendingApprovalsCount = pendingCount || 0

      // 4. 순이익 계산
      const todayProfit = todayIncome - todayExpense

      setData({
        todayIncome,
        todayExpense,
        todayProfit,
        pendingApprovalsCount
      })
    } catch (error) {
      console.error("Failed to fetch daily data:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-gray-500">로딩 중...</p>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-500">데이터를 불러올 수 없습니다.</p>
        </CardContent>
      </Card>
    )
  }

  const today = new Date()
  const formattedDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`

  return (
    <Card>
      <CardHeader>
        <CardTitle>일일 결산</CardTitle>
        <CardDescription>{formattedDate}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* 금일 입금 */}
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">금일 입금</span>
            <span className="font-bold text-blue-600">
              ₩{data.todayIncome.toLocaleString()}
            </span>
          </div>

          {/* 금일 지출 */}
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">금일 지출</span>
            <span className="font-bold text-red-600">
              ₩{data.todayExpense.toLocaleString()}
            </span>
          </div>

          {/* 구분선 */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-3"></div>

          {/* 금일 순이익 */}
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-700 dark:text-gray-300">금일 순이익</span>
            <span className={`font-bold text-lg ${data.todayProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.todayProfit >= 0 ? '+' : ''}₩{data.todayProfit.toLocaleString()}
            </span>
          </div>

          {/* 승인 대기 버튼 - 강조 표시 */}
          {data.pendingApprovalsCount > 0 && (
            <Button
              className="w-full mt-4 bg-orange-600 hover:bg-orange-700 text-white font-semibold"
              onClick={() => router.push("/dashboard/finance")}
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              경리 승인 대기 ({data.pendingApprovalsCount}건)
            </Button>
          )}

          {data.pendingApprovalsCount === 0 && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-center">
              <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                ✅ 승인 대기 건 없음
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
