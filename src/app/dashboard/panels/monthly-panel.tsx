"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { TrendingUp, TrendingDown } from "lucide-react"

interface MonthlyData {
  totalIncome: number
  totalExpense: number
  netProfit: number
  profitChange: number
  topCustomers: Array<{
    name: string
    member_number: string
    totalUsage: number
  }>
}

export default function MonthlyPanel() {
  const [data, setData] = useState<MonthlyData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMonthlyData()
  }, [])

  const fetchMonthlyData = async () => {
    try {
      // For now, we'll use mock data since the API endpoint doesn't exist yet
      // TODO: Replace with actual API call to /api/finance/monthly-summary

      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1

      // Mock data calculation
      setData({
        totalIncome: 34500000,
        totalExpense: 21300000,
        netProfit: 13200000,
        profitChange: 12.5,
        topCustomers: [
          { name: "홍길동", member_number: "M-0012", totalUsage: 2500000 },
          { name: "김철수", member_number: "M-0008", totalUsage: 1800000 },
          { name: "박영희", member_number: "M-0015", totalUsage: 1500000 },
        ]
      })
    } catch (error) {
      console.error("Failed to fetch monthly data:", error)
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

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  return (
    <Card>
      <CardHeader>
        <CardTitle>{year}년 {month}월 운영 요약</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {/* 총 입금액 */}
          <div className="space-y-1">
            <Label className="text-sm text-gray-600 dark:text-gray-400">총 입금액</Label>
            <p className="text-2xl font-bold text-blue-600">
              ₩{data.totalIncome.toLocaleString()}
            </p>
          </div>

          {/* 총 지출액 */}
          <div className="space-y-1">
            <Label className="text-sm text-gray-600 dark:text-gray-400">총 지출액</Label>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-red-600">
                ₩{data.totalExpense.toLocaleString()}
              </p>
            </div>
          </div>

          {/* 월간 순이익 */}
          <div className="space-y-1">
            <Label className="text-sm text-gray-600 dark:text-gray-400">월간 순이익</Label>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-green-600">
                ₩{data.netProfit.toLocaleString()}
              </p>
              {data.profitChange > 0 ? (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  +{data.profitChange}%
                </span>
              ) : (
                <span className="text-sm text-red-600 flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" />
                  {data.profitChange}%
                </span>
              )}
            </div>
          </div>

          {/* 최다 이용 회원 */}
          <div className="mt-6 space-y-2">
            <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
              최다 이용 회원 TOP 3
            </h4>
            <div className="space-y-2">
              {data.topCustomers.map((customer, index) => (
                <div
                  key={customer.member_number}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-500 w-6">#{index + 1}</span>
                    <div>
                      <p className="font-medium text-sm">{customer.name}</p>
                      <p className="text-xs text-gray-500">{customer.member_number}</p>
                    </div>
                  </div>
                  <p className="font-semibold text-sm text-blue-600">
                    ₩{customer.totalUsage.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
