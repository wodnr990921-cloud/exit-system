"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface Transaction {
  id: string
  customer_id: string | null
  amount: number
  category: string
  type: string
  status: string
  reason: string | null
  task_item_id: string | null
  created_at: string
  cost_price?: number
  selling_price?: number
  shipping_cost?: number
  customer: {
    id: string
    member_number: string
    name: string
  } | null
  task_item: {
    id: string
    category: string
    description: string
    amount: number
    status: string
    cost_price?: number
    selling_price?: number
    shipping_cost?: number
    item_details?: {
      type: string
      title?: string
      author?: string
      quantity?: number
      game_name?: string
      choice?: string
      odds?: number
    } | null
  } | null
}

interface DailySummary {
  date: string
  generalRevenue: number
  bettingRevenue: number
  bettingPayout: number
  netProfit: number
  totalCost?: number
  totalShipping?: number
  grossProfit?: number
}

export default function FinanceClient() {
  const router = useRouter()
  const supabase = createClient()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null)
  const [filterType, setFilterType] = useState<string>("")
  const [filterCategory, setFilterCategory] = useState<string>("")
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [showRefundDialog, setShowRefundDialog] = useState(false)
  const [refundReason, setRefundReason] = useState("")
  const [restoreStock, setRestoreStock] = useState(false)
  const [refunding, setRefunding] = useState(false)
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null)

  useEffect(() => {
    loadDailySummary()
    loadTransactions()
  }, [filterType, filterCategory, filterDate])

  const loadDailySummary = async () => {
    try {
      const response = await fetch(`/api/finance/daily-summary?date=${filterDate}`)
      const data = await response.json()

      if (data.success) {
        setDailySummary(data.summary)
      }
    } catch (error) {
      console.error("Error loading daily summary:", error)
    }
  }

  const loadTransactions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterType) params.append("type", filterType)
      if (filterCategory) params.append("category", filterCategory)
      if (filterDate) params.append("date", filterDate)

      const response = await fetch(`/api/finance/transactions?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setTransactions(data.transactions)
      }
    } catch (error) {
      console.error("Error loading transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefund = async (taskItem: any) => {
    setSelectedTask(taskItem)
    setShowRefundDialog(true)
    setRefundReason("")
    setRestoreStock(false)
  }

  const confirmRefund = async () => {
    if (!selectedTask || !refundReason.trim()) {
      setNotification({ type: "error", message: "환불 사유를 입력해주세요." })
      setTimeout(() => setNotification(null), 3000)
      return
    }

    setRefunding(true)
    try {
      const response = await fetch("/api/finance/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskItemId: selectedTask.id,
          reason: refundReason.trim(),
          restoreStock: restoreStock,
        }),
      })

      const data = await response.json()

      if (data.success) {
        const stockMessage = data.refund.stockRestored ? " (재고 복구 완료)" : ""
        setNotification({
          type: "success",
          message: `부분 환불 완료: +${data.refund.amount.toLocaleString("ko-KR")}P${stockMessage}`,
        })
        setTimeout(() => setNotification(null), 5000)
        setShowRefundDialog(false)
        setRefundReason("")
        setRestoreStock(false)
        loadTransactions()
        loadDailySummary()
      } else {
        setNotification({
          type: "error",
          message: data.error || "환불 처리 중 오류가 발생했습니다.",
        })
        setTimeout(() => setNotification(null), 3000)
      }
    } catch (error: any) {
      console.error("Error processing refund:", error)
      setNotification({
        type: "error",
        message: "환불 처리 중 오류가 발생했습니다.",
      })
      setTimeout(() => setNotification(null), 3000)
    } finally {
      setRefunding(false)
    }
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString("ko-KR")
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      charge: "충전",
      use: "사용",
      refund: "환불",
      exchange: "전환",
    }
    return labels[type] || type
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      general: "일반",
      betting: "배팅",
    }
    return labels[category] || category
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "대기",
      approved: "승인",
      rejected: "거절",
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    }
    return colors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
  }

  const getTypeColor = (type: string) => {
    if (type === "refund") {
      return "text-green-600 dark:text-green-400"
    }
    if (type === "use") {
      return "text-red-600 dark:text-red-400"
    }
    return "text-gray-900 dark:text-gray-50"
  }

  const formatItemDescription = (taskItem: Transaction["task_item"]) => {
    if (!taskItem) return "-"

    // item_details가 있으면 상세 정보 표시
    if (taskItem.item_details) {
      const details = taskItem.item_details
      if (details.type === "book") {
        return `${details.title || taskItem.description}${details.author ? ` (${details.author})` : ""}${details.quantity && details.quantity > 1 ? ` × ${details.quantity}` : ""}`
      } else if (details.type === "game") {
        return `${details.game_name || taskItem.description} - ${details.choice || ""}${details.odds ? ` (배당 ${details.odds.toFixed(2)})` : ""}`
      }
    }

    // 기본 description 표시
    const categoryLabels: Record<string, string> = {
      book: "도서",
      game: "경기",
      goods: "물품",
    }
    return `${categoryLabels[taskItem.category] || taskItem.category}: ${taskItem.description}`
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">재무관리</h1>
        </div>

        {/* 알림 */}
        {notification && (
          <div
            className={`p-4 rounded-md ${
              notification.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800"
                : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800"
            }`}
          >
            {notification.message}
          </div>
        )}

        {/* 일일 정산 요약 카드 */}
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">오늘의 일일 정산 요약</CardTitle>
            <CardDescription>{filterDate} 기준</CardDescription>
          </CardHeader>
          <CardContent>
            {dailySummary ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
                    <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">오늘의 일반 매출</div>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {formatNumber(dailySummary.generalRevenue)}P
                    </div>
                  </div>
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-900">
                    <div className="text-sm text-purple-600 dark:text-purple-400 mb-1">오늘의 배팅 매출</div>
                    <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      {formatNumber(dailySummary.bettingRevenue)}P
                    </div>
                  </div>
                  <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-900">
                    <div className="text-sm text-orange-600 dark:text-orange-400 mb-1">오늘의 배팅 당첨 지급액</div>
                    <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                      {formatNumber(dailySummary.bettingPayout)}P
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg border ${
                    dailySummary.netProfit >= 0
                      ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"
                      : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
                  }`}>
                    <div className={`text-sm mb-1 ${
                      dailySummary.netProfit >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      최종 순수익
                    </div>
                    <div className={`text-2xl font-bold ${
                      dailySummary.netProfit >= 0
                        ? "text-green-900 dark:text-green-100"
                        : "text-red-900 dark:text-red-100"
                    }`}>
                      {formatNumber(dailySummary.netProfit)}P
                    </div>
                  </div>
                </div>

                {/* 정산 세부 정보 */}
                {(dailySummary.totalCost || dailySummary.totalShipping || dailySummary.grossProfit) && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">정산 세부 내역</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">총 원가</div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                          {formatNumber(dailySummary.totalCost || 0)}원
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">총 배송비</div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                          {formatNumber(dailySummary.totalShipping || 0)}원
                        </div>
                      </div>
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-900">
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">총 순수익</div>
                        <div className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                          {formatNumber(dailySummary.grossProfit || 0)}원
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center p-8 text-gray-500 dark:text-gray-400">로딩 중...</div>
            )}
          </CardContent>
        </Card>

        {/* 필터 및 거래 내역 */}
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">상세 거래 내역</CardTitle>
            <CardDescription>연결된 티켓 아이템 정보와 함께 표시됩니다</CardDescription>
          </CardHeader>
          <CardContent>
            {/* 필터 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="space-y-2">
                <Label>날짜</Label>
                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="border-gray-300 dark:border-gray-700"
                />
              </div>
              <div className="space-y-2">
                <Label>유형</Label>
                <Select value={filterType || undefined} onValueChange={(value) => setFilterType(value || "")}>
                  <SelectTrigger className="border-gray-300 dark:border-gray-700">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="charge">충전</SelectItem>
                    <SelectItem value="use">사용</SelectItem>
                    <SelectItem value="refund">환불</SelectItem>
                    <SelectItem value="exchange">전환</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>카테고리</Label>
                <Select value={filterCategory || undefined} onValueChange={(value) => setFilterCategory(value || "")}>
                  <SelectTrigger className="border-gray-300 dark:border-gray-700">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">일반</SelectItem>
                    <SelectItem value="betting">배팅</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilterType("")
                    setFilterCategory("")
                    setFilterDate(new Date().toISOString().split("T")[0])
                  }}
                  className="w-full border-gray-300 dark:border-gray-700"
                >
                  필터 초기화
                </Button>
              </div>
            </div>

            {/* 거래 내역 테이블 */}
            {loading ? (
              <div className="text-center p-8 text-gray-500 dark:text-gray-400">로딩 중...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center p-8 text-gray-500 dark:text-gray-400">거래 내역이 없습니다.</div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>회원</TableHead>
                      <TableHead>유형</TableHead>
                      <TableHead>카테고리</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                      <TableHead className="text-right">원가</TableHead>
                      <TableHead className="text-right">배송비</TableHead>
                      <TableHead className="text-right">순수익</TableHead>
                      <TableHead>연결된 아이템</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>사유</TableHead>
                      <TableHead>일시</TableHead>
                      <TableHead className="w-[100px]">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => {
                      const costPrice = transaction.task_item?.cost_price || 0
                      const sellingPrice = transaction.task_item?.selling_price || transaction.amount || 0
                      const shippingCost = transaction.task_item?.shipping_cost || 0
                      const netProfit = sellingPrice - costPrice - shippingCost

                      return (
                        <TableRow key={transaction.id} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                          <TableCell className="text-gray-900 dark:text-gray-50">
                            {transaction.customer
                              ? `${transaction.customer.member_number} - ${transaction.customer.name}`
                              : "-"}
                          </TableCell>
                          <TableCell className="text-gray-700 dark:text-gray-300">{getTypeLabel(transaction.type)}</TableCell>
                          <TableCell className="text-gray-700 dark:text-gray-300">{getCategoryLabel(transaction.category)}</TableCell>
                          <TableCell className={`text-right font-medium ${getTypeColor(transaction.type)}`}>
                            {transaction.type === "refund" || transaction.type === "charge" ? "+" : "-"}
                            {formatNumber(transaction.amount)}P
                          </TableCell>
                          <TableCell className="text-right text-sm text-gray-700 dark:text-gray-300">
                            {costPrice > 0 ? `${formatNumber(costPrice)}원` : "-"}
                          </TableCell>
                          <TableCell className="text-right text-sm text-gray-700 dark:text-gray-300">
                            {shippingCost > 0 ? `${formatNumber(shippingCost)}원` : "-"}
                          </TableCell>
                          <TableCell className={`text-right text-sm font-semibold ${
                            netProfit > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : netProfit < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-gray-500 dark:text-gray-400"
                          }`}>
                            {costPrice > 0 || shippingCost > 0
                              ? `${netProfit >= 0 ? "+" : ""}${formatNumber(netProfit)}원`
                              : "-"}
                          </TableCell>
                          <TableCell className="text-gray-700 dark:text-gray-300 text-sm">
                            {formatItemDescription(transaction.task_item)}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${getStatusColor(transaction.status)}`}>
                              {getStatusLabel(transaction.status)}
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-700 dark:text-gray-300 text-sm">
                            {transaction.reason || "-"}
                          </TableCell>
                          <TableCell className="text-gray-700 dark:text-gray-300 text-sm">
                            {formatDate(transaction.created_at)}
                          </TableCell>
                          <TableCell>
                            {transaction.task_item &&
                             transaction.task_item.status !== "refunded" &&
                             transaction.status === "approved" &&
                             transaction.type === "use" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRefund(transaction.task_item)}
                                className="text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
                              >
                                환불
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 환불 다이얼로그 */}
        <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>부분 환불</DialogTitle>
              <DialogDescription>특정 아이템에 대한 환불을 진행합니다.</DialogDescription>
            </DialogHeader>
            {selectedTask && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">아이템 정보</div>
                  <div className="font-medium text-gray-900 dark:text-gray-50">{formatItemDescription(selectedTask)}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    금액: {formatNumber(selectedTask.amount)}P
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refund-reason">환불 사유 *</Label>
                  <Textarea
                    id="refund-reason"
                    placeholder="환불 사유를 입력하세요"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="border-gray-300 dark:border-gray-700"
                    rows={3}
                  />
                </div>
                {selectedTask.category === "book" && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="restore-stock"
                      checked={restoreStock}
                      onCheckedChange={(checked) => setRestoreStock(checked === true)}
                    />
                    <Label htmlFor="restore-stock" className="text-sm font-normal cursor-pointer">
                      재고를 다시 채우겠습니까?
                    </Label>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRefundDialog(false)} disabled={refunding}>
                취소
              </Button>
              <Button
                onClick={confirmRefund}
                disabled={refunding || !refundReason.trim()}
                className="bg-green-600 hover:bg-green-700"
              >
                {refunding ? "처리 중..." : "환불 실행"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
