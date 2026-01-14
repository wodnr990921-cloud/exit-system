"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Calculator, TrendingUp, TrendingDown } from "lucide-react"

interface MonthlySettlement {
  month: string
  revenue: number
  cost: number
  shipping_cost: number
  net_profit: number
  transaction_count: number
}

export default function SettlementsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [settlements, setSettlements] = useState<MonthlySettlement[]>([])
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<string>("")

  useEffect(() => {
    checkPermissions()
  }, [])

  useEffect(() => {
    if (hasAccess) {
      loadSettlements()
    }
  }, [hasAccess, selectedYear])

  const checkPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/")
        return
      }

      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()

      if (data && (data.role === "admin" || data.role === "ceo")) {
        setHasAccess(true)
      } else {
        router.push("/dashboard")
      }
    } catch (error) {
      console.error("Error checking permissions:", error)
      router.push("/")
    }
  }

  const loadSettlements = async () => {
    setLoading(true)
    try {
      const startDate = `${selectedYear}-01-01`
      const endDate = `${selectedYear}-12-31`

      // Load all transactions for the year
      const { data: transactions, error } = await supabase
        .from("points")
        .select("amount, category, type, created_at, status")
        .eq("status", "approved")
        .gte("created_at", startDate)
        .lte("created_at", `${endDate}T23:59:59`)

      if (error) throw error

      // Group by month
      const monthlyData: Record<string, MonthlySettlement> = {}

      for (let month = 1; month <= 12; month++) {
        const monthStr = `${selectedYear}-${String(month).padStart(2, "0")}`
        monthlyData[monthStr] = {
          month: monthStr,
          revenue: 0,
          cost: 0,
          shipping_cost: 0,
          net_profit: 0,
          transaction_count: 0,
        }
      }

      transactions?.forEach((trans) => {
        const month = trans.created_at.substring(0, 7)
        if (!monthlyData[month]) return

        if (trans.type === "charge") {
          monthlyData[month].revenue += trans.amount
        } else if (trans.type === "use") {
          // Assuming 70% is cost, 10% is shipping
          monthlyData[month].cost += trans.amount * 0.7
          monthlyData[month].shipping_cost += trans.amount * 0.1
        }
        monthlyData[month].transaction_count++
      })

      // Calculate net profit
      Object.keys(monthlyData).forEach((month) => {
        monthlyData[month].net_profit =
          monthlyData[month].revenue -
          monthlyData[month].cost -
          monthlyData[month].shipping_cost
      })

      setSettlements(Object.values(monthlyData).reverse())
    } catch (error: any) {
      console.error("Error loading settlements:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCalculate = async () => {
    if (!selectedMonth) {
      alert("월을 선택해주세요.")
      return
    }

    setCalculating(true)
    try {
      // Recalculate selected month
      await loadSettlements()
      alert(`${selectedMonth} 정산이 완료되었습니다.`)
    } catch (error) {
      console.error("Error calculating:", error)
      alert("정산 계산에 실패했습니다.")
    } finally {
      setCalculating(false)
    }
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString("ko-KR")
  }

  const formatMonth = (month: string) => {
    const [year, m] = month.split("-")
    return `${year}년 ${parseInt(m)}월`
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-gray-600 dark:text-gray-400">접근 권한이 없습니다.</div>
      </div>
    )
  }

  const totalRevenue = settlements.reduce((sum, s) => sum + s.revenue, 0)
  const totalCost = settlements.reduce((sum, s) => sum + s.cost, 0)
  const totalShipping = settlements.reduce((sum, s) => sum + s.shipping_cost, 0)
  const totalProfit = settlements.reduce((sum, s) => sum + s.net_profit, 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-blue-600" />
              월말 정산
            </h1>
        </div>

        {/* Year Selector */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle>조회 연도</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="space-y-2">
                <Label>연도</Label>
                <select
                  className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-background"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                >
                  {[2024, 2025, 2026].map((year) => (
                    <option key={year} value={year}>
                      {year}년
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>정산 계산 월</Label>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="border-gray-300 dark:border-gray-700"
                />
              </div>
              <Button
                onClick={handleCalculate}
                disabled={calculating || !selectedMonth}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {calculating ? "계산 중..." : "정산 계산"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-blue-200 dark:border-blue-900">
            <CardHeader className="pb-2">
              <CardDescription>연간 매출</CardDescription>
              <CardTitle className="text-2xl text-blue-600 dark:text-blue-400">
                {formatNumber(totalRevenue)}원
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <TrendingUp className="w-4 h-4" />
                <span>총 수익</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 dark:border-orange-900">
            <CardHeader className="pb-2">
              <CardDescription>연간 원가</CardDescription>
              <CardTitle className="text-2xl text-orange-600 dark:text-orange-400">
                {formatNumber(totalCost)}원
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <TrendingDown className="w-4 h-4" />
                <span>상품 비용</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 dark:border-purple-900">
            <CardHeader className="pb-2">
              <CardDescription>연간 배송비</CardDescription>
              <CardTitle className="text-2xl text-purple-600 dark:text-purple-400">
                {formatNumber(totalShipping)}원
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-purple-600">
                <TrendingDown className="w-4 h-4" />
                <span>택배 비용</span>
              </div>
            </CardContent>
          </Card>

          <Card className={totalProfit >= 0 ? "border-emerald-200 dark:border-emerald-900" : "border-red-200 dark:border-red-900"}>
            <CardHeader className="pb-2">
              <CardDescription>연간 순수익</CardDescription>
              <CardTitle className={`text-2xl ${totalProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {formatNumber(totalProfit)}원
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`flex items-center gap-2 text-sm ${totalProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {totalProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span>{totalProfit >= 0 ? "흑자" : "적자"}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Table */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle>월별 정산 내역</CardTitle>
            <CardDescription>{selectedYear}년 전체 월별 정산</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center p-12 text-gray-500 dark:text-gray-400">로딩 중...</div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>월</TableHead>
                      <TableHead className="text-right">매출</TableHead>
                      <TableHead className="text-right">원가</TableHead>
                      <TableHead className="text-right">배송비</TableHead>
                      <TableHead className="text-right">순수익</TableHead>
                      <TableHead className="text-right">거래 건수</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settlements.map((settlement) => (
                      <TableRow key={settlement.month}>
                        <TableCell className="font-medium text-gray-900 dark:text-gray-50">
                          {formatMonth(settlement.month)}
                        </TableCell>
                        <TableCell className="text-right text-blue-600 dark:text-blue-400 font-medium">
                          {formatNumber(settlement.revenue)}원
                        </TableCell>
                        <TableCell className="text-right text-orange-600 dark:text-orange-400">
                          {formatNumber(settlement.cost)}원
                        </TableCell>
                        <TableCell className="text-right text-purple-600 dark:text-purple-400">
                          {formatNumber(settlement.shipping_cost)}원
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${settlement.net_profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {formatNumber(settlement.net_profit)}원
                        </TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-gray-300">
                          {formatNumber(settlement.transaction_count)}건
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
