"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface PointTransaction {
  id: string
  customer_id: string | null
  amount: number
  category: string
  type: string
  status: string
  reason: string | null
  requested_by: string | null
  approved_by: string | null
  created_at: string
  customers: {
    member_number: string
    name: string
  } | null
  requested_by_user: {
    name: string
  } | null
  approved_by_user: {
    name: string
  } | null
}

export default function BankClient() {
  const [pendingTransactions, setPendingTransactions] = useState<PointTransaction[]>([])
  const [allTransactions, setAllTransactions] = useState<PointTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<PointTransaction | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [hasAccess, setHasAccess] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    checkPermissions()
    loadPendingTransactions()
    loadAllTransactions()
  }, [])

  const checkPermissions = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase.from("users").select("role").eq("id", user.id).single()
      if (data && (data.role === "ceo" || data.role === "operator" || data.role === "admin")) {
        setHasAccess(true)
      }
    } catch (error) {
      console.error("Error checking permissions:", error)
    }
  }

  const loadPendingTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("points")
        .select(
          `
          *,
          customers (member_number, name),
          requested_by_user:users!points_requested_by_fkey (name),
          approved_by_user:users!points_approved_by_fkey (name)
        `
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      if (error) throw error
      setPendingTransactions(data || [])
    } catch (error: any) {
      console.error("Error loading pending transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadAllTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("points")
        .select(
          `
          *,
          customers (member_number, name),
          requested_by_user:users!points_requested_by_fkey (name),
          approved_by_user:users!points_approved_by_fkey (name)
        `
        )
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error
      setAllTransactions(data || [])
    } catch (error: any) {
      console.error("Error loading all transactions:", error)
    }
  }


  const handleApprove = async (transactionId: string) => {
    setApproving(true)
    setError(null)
    setSuccess(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("로그인이 필요합니다.")
      }

      // API Route를 통해 승인 (알림 자동 생성)
      const response = await fetch("/api/points/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "승인에 실패했습니다.")
      }

      setSuccess("승인되었습니다.")
      loadPendingTransactions()
      loadAllTransactions()

      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (error: any) {
      setError(error.message || "승인에 실패했습니다.")
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async () => {
    if (!selectedTransaction) return

    setApproving(true)
    setError(null)
    setSuccess(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("로그인이 필요합니다.")
      }

      const { error } = await supabase
        .from("points")
        .update({
          status: "rejected",
          approved_by: user.id,
          reason: rejectReason || selectedTransaction.reason || "거절됨",
        })
        .eq("id", selectedTransaction.id)

      if (error) throw error

      setSuccess("거절되었습니다.")
      setShowRejectDialog(false)
      setSelectedTransaction(null)
      setRejectReason("")

      loadPendingTransactions()
      loadAllTransactions()

      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (error: any) {
      setError(error.message || "거절에 실패했습니다.")
    } finally {
      setApproving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR")
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString("ko-KR")
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
    return category === "general" ? "일반" : "배팅"
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "승인대기",
      approved: "승인완료",
      rejected: "거절됨",
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    }
    return colors[status] || ""
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">포인트 자금 관리</h1>

        {error && (
          <div className="mb-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
            {success}
          </div>
        )}

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending" disabled={!hasAccess}>
              승인 대기 {pendingTransactions.length > 0 && `(${pendingTransactions.length})`}
            </TabsTrigger>
            <TabsTrigger value="ledger">전체 장부</TabsTrigger>
          </TabsList>

          {/* Tab 1: 승인 대기 */}
          <TabsContent value="pending">
            {!hasAccess ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  승인 권한이 없습니다.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>승인 대기</CardTitle>
                  <CardDescription>승인 대기 중인 포인트 거래 목록입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center p-8">로딩 중...</div>
                  ) : pendingTransactions.length === 0 ? (
                    <div className="text-center p-8 text-gray-500">승인 대기 중인 거래가 없습니다.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>회원</TableHead>
                          <TableHead>포인트종류</TableHead>
                          <TableHead>유형</TableHead>
                          <TableHead>금액</TableHead>
                          <TableHead>사유</TableHead>
                          <TableHead>요청자</TableHead>
                          <TableHead>요청일시</TableHead>
                          <TableHead>액션</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingTransactions.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell>
                              {transaction.customers
                                ? `${transaction.customers.member_number} - ${transaction.customers.name}`
                                : "-"}
                            </TableCell>
                            <TableCell>{getCategoryLabel(transaction.category)}</TableCell>
                            <TableCell>{getTypeLabel(transaction.type)}</TableCell>
                            <TableCell className="font-medium">
                              {formatNumber(transaction.amount)}
                            </TableCell>
                            <TableCell>{transaction.reason || "-"}</TableCell>
                            <TableCell>
                              {transaction.requested_by_user?.name || "-"}
                            </TableCell>
                            <TableCell>{formatDate(transaction.created_at)}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(transaction.id)}
                                  disabled={approving}
                                >
                                  승인
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedTransaction(transaction)
                                    setShowRejectDialog(true)
                                  }}
                                  disabled={approving}
                                >
                                  거절
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab 2: 전체 장부 */}
          <TabsContent value="ledger">
            <Card>
              <CardHeader>
                <CardTitle>전체 장부</CardTitle>
                <CardDescription>모든 포인트 거래 내역입니다.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center p-8">로딩 중...</div>
                ) : allTransactions.length === 0 ? (
                  <div className="text-center p-8 text-gray-500">거래 내역이 없습니다.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>회원</TableHead>
                        <TableHead>포인트종류</TableHead>
                        <TableHead>유형</TableHead>
                        <TableHead>금액</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>사유</TableHead>
                        <TableHead>요청자</TableHead>
                        <TableHead>승인자</TableHead>
                        <TableHead>일시</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allTransactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            {transaction.customers
                              ? `${transaction.customers.member_number} - ${transaction.customers.name}`
                              : "-"}
                          </TableCell>
                          <TableCell>{getCategoryLabel(transaction.category)}</TableCell>
                          <TableCell>{getTypeLabel(transaction.type)}</TableCell>
                          <TableCell className="font-medium">
                            {formatNumber(transaction.amount)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded text-xs ${getStatusColor(transaction.status)}`}
                            >
                              {getStatusLabel(transaction.status)}
                            </span>
                          </TableCell>
                          <TableCell>{transaction.reason || "-"}</TableCell>
                          <TableCell>{transaction.requested_by_user?.name || "-"}</TableCell>
                          <TableCell>{transaction.approved_by_user?.name || "-"}</TableCell>
                          <TableCell>{formatDate(transaction.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 거절 다이얼로그 */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>거래 거절</DialogTitle>
              <DialogDescription>거절 사유를 입력하세요.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reject-reason">거절 사유</Label>
                <Input
                  id="reject-reason"
                  type="text"
                  placeholder="거절 사유를 입력하세요"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={approving}>
                취소
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={approving}>
                {approving ? "처리 중..." : "거절"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
