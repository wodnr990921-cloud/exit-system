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
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  ArrowLeftRight,
  Loader2,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface BankTransaction {
  id: string
  transaction_id: string
  transaction_type: "deposit" | "withdrawal" | "transfer"
  amount: number
  balance_after: number | null
  depositor_name: string | null
  account_number: string | null
  bank_name: string | null
  content: string | null
  transaction_date: string
  status: string
  is_internal: boolean
  matched_customer_id: string | null
  matched_point_id: string | null
  processed_by: string | null
  processed_at: string | null
  notes: string | null
  created_at: string
  customers?: {
    member_number: string
    name: string
  } | null
}

interface Customer {
  id: string
  member_number: string
  name: string
  depositor_name: string | null
}

export default function TransactionsClient() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [internalFilter, setInternalFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Manual matching dialog
  const [showMatchDialog, setShowMatchDialog] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null)
  const [customerSearch, setCustomerSearch] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchingCustomers, setSearchingCustomers] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [matching, setMatching] = useState(false)

  // Approval dialog
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalNotes, setApprovalNotes] = useState("")
  const [approving, setApproving] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadTransactions()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [transactions, statusFilter, typeFilter, internalFilter, searchQuery])

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null)
        setSuccess(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, success])

  const loadTransactions = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("bank_transactions")
        .select(
          `
          *,
          customers (member_number, name)
        `
        )
        .order("transaction_date", { ascending: false })
        .limit(100)

      if (error) throw error
      setTransactions(data || [])
    } catch (error: any) {
      console.error("Error loading transactions:", error)
      setError("거래 내역을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadTransactions()
    setRefreshing(false)
    setSuccess("새로고침 완료")
  }

  const applyFilters = () => {
    let filtered = [...transactions]

    if (statusFilter !== "all") {
      filtered = filtered.filter((t) => t.status === statusFilter)
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((t) => t.transaction_type === typeFilter)
    }

    if (internalFilter === "internal") {
      filtered = filtered.filter((t) => t.is_internal)
    } else if (internalFilter === "external") {
      filtered = filtered.filter((t) => !t.is_internal)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (t) =>
          t.transaction_id.toLowerCase().includes(query) ||
          t.depositor_name?.toLowerCase().includes(query) ||
          t.content?.toLowerCase().includes(query) ||
          t.customers?.name.toLowerCase().includes(query)
      )
    }

    setFilteredTransactions(filtered)
  }

  const searchCustomers = async (query: string) => {
    if (!query.trim()) {
      setCustomers([])
      return
    }

    setSearchingCustomers(true)
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, member_number, name, depositor_name")
        .or(`name.ilike.%${query}%,member_number.ilike.%${query}%,depositor_name.ilike.%${query}%`)
        .limit(10)

      if (error) throw error
      setCustomers(data || [])
    } catch (error: any) {
      console.error("Error searching customers:", error)
      setError("회원 검색에 실패했습니다.")
    } finally {
      setSearchingCustomers(false)
    }
  }

  const handleManualMatch = async () => {
    if (!selectedTransaction || !selectedCustomer) return

    setMatching(true)
    setError(null)
    setSuccess(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("로그인이 필요합니다.")

      // Create pending point record
      const { data: pointData, error: pointError } = await supabase
        .from("points")
        .insert({
          customer_id: selectedCustomer.id,
          amount: selectedTransaction.amount,
          category: "general",
          type: "charge",
          status: "pending",
          reason: `은행 입금 수동 매칭 - ${selectedTransaction.depositor_name}`,
          requested_by: user.id,
        })
        .select()
        .single()

      if (pointError) throw pointError

      // Update transaction
      const { error: updateError } = await supabase
        .from("bank_transactions")
        .update({
          status: "matched",
          matched_customer_id: selectedCustomer.id,
          matched_point_id: pointData.id,
          processed_by: user.id,
          processed_at: new Date().toISOString(),
        })
        .eq("id", selectedTransaction.id)

      if (updateError) throw updateError

      setSuccess("매칭이 완료되었습니다. 관리자 승인 대기 중입니다.")
      setShowMatchDialog(false)
      setSelectedTransaction(null)
      setSelectedCustomer(null)
      setCustomerSearch("")
      setCustomers([])
      await loadTransactions()
    } catch (error: any) {
      setError(error.message || "매칭에 실패했습니다.")
    } finally {
      setMatching(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedTransaction) return

    setApproving(true)
    setError(null)
    setSuccess(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("로그인이 필요합니다.")

      // Approve the point record if it exists
      if (selectedTransaction.matched_point_id) {
        const response = await fetch("/api/points/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId: selectedTransaction.matched_point_id }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "포인트 승인에 실패했습니다.")
        }
      }

      // Update transaction status
      const { error } = await supabase
        .from("bank_transactions")
        .update({
          status: "approved",
          notes: approvalNotes || null,
          processed_by: user.id,
          processed_at: new Date().toISOString(),
        })
        .eq("id", selectedTransaction.id)

      if (error) throw error

      setSuccess("승인이 완료되었습니다.")
      setShowApprovalDialog(false)
      setSelectedTransaction(null)
      setApprovalNotes("")
      await loadTransactions()
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
      if (!user) throw new Error("로그인이 필요합니다.")

      // Reject the point record if it exists
      if (selectedTransaction.matched_point_id) {
        const { error: pointError } = await supabase
          .from("points")
          .update({
            status: "rejected",
            approved_by: user.id,
            reason: approvalNotes || "거절됨",
          })
          .eq("id", selectedTransaction.matched_point_id)

        if (pointError) throw pointError
      }

      // Update transaction status
      const { error } = await supabase
        .from("bank_transactions")
        .update({
          status: "rejected",
          notes: approvalNotes || null,
          processed_by: user.id,
          processed_at: new Date().toISOString(),
        })
        .eq("id", selectedTransaction.id)

      if (error) throw error

      setSuccess("거절되었습니다.")
      setShowApprovalDialog(false)
      setSelectedTransaction(null)
      setApprovalNotes("")
      await loadTransactions()
    } catch (error: any) {
      setError(error.message || "거절에 실패했습니다.")
    } finally {
      setApproving(false)
    }
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

  const formatNumber = (num: number) => {
    return num.toLocaleString("ko-KR")
  }

  const getStatusBadge = (status: string) => {
    const configs: Record<
      string,
      { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
    > = {
      pending: { label: "대기", variant: "secondary" },
      matched: { label: "매칭됨", variant: "default" },
      unidentified: { label: "미확인", variant: "destructive" },
      approved: { label: "승인", variant: "default" },
      rejected: { label: "거절", variant: "destructive" },
      internal: { label: "내부", variant: "outline" },
    }
    const config = configs[status] || { label: status, variant: "secondary" }
    return (
      <Badge variant={config.variant} className="capitalize">
        {config.label}
      </Badge>
    )
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return <ArrowDownCircle className="w-4 h-4 text-green-600" />
      case "withdrawal":
        return <ArrowUpCircle className="w-4 h-4 text-red-600" />
      case "transfer":
        return <ArrowLeftRight className="w-4 h-4 text-blue-600" />
      default:
        return null
    }
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      deposit: "입금",
      withdrawal: "출금",
      transfer: "이체",
    }
    return labels[type] || type
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">은행 거래 관리</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              자동 입금 매칭 및 내부 이체 관리
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            새로고침
          </Button>
        </div>

        {/* Notifications */}
        {error && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="p-4 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}

        {success && (
          <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
            <CardContent className="p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              필터
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status-filter">상태</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status-filter">
                    <SelectValue placeholder="상태 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="pending">대기</SelectItem>
                    <SelectItem value="matched">매칭됨</SelectItem>
                    <SelectItem value="unidentified">미확인</SelectItem>
                    <SelectItem value="approved">승인</SelectItem>
                    <SelectItem value="rejected">거절</SelectItem>
                    <SelectItem value="internal">내부</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type-filter">거래 유형</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger id="type-filter">
                    <SelectValue placeholder="유형 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="deposit">입금</SelectItem>
                    <SelectItem value="withdrawal">출금</SelectItem>
                    <SelectItem value="transfer">이체</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="internal-filter">내부/외부</Label>
                <Select value={internalFilter} onValueChange={setInternalFilter}>
                  <SelectTrigger id="internal-filter">
                    <SelectValue placeholder="구분 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="external">외부 거래</SelectItem>
                    <SelectItem value="internal">내부 이체</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="search">검색</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="거래ID, 입금자명..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>거래 내역</CardTitle>
            <CardDescription>
              {filteredTransactions.length}건의 거래가 표시되고 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">거래 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>유형</TableHead>
                      <TableHead>거래일시</TableHead>
                      <TableHead>입금자명</TableHead>
                      <TableHead>금액</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>매칭회원</TableHead>
                      <TableHead>내부/외부</TableHead>
                      <TableHead>액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTypeIcon(transaction.transaction_type)}
                            <span className="text-sm">{getTypeLabel(transaction.transaction_type)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(transaction.transaction_date)}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>
                            <div className="font-medium">{transaction.depositor_name || "-"}</div>
                            {transaction.content && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {transaction.content}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {formatNumber(transaction.amount)}원
                        </TableCell>
                        <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                        <TableCell className="text-sm">
                          {transaction.customers
                            ? `${transaction.customers.member_number} - ${transaction.customers.name}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {transaction.is_internal ? (
                            <Badge variant="outline" className="gap-1">
                              <Building2 className="w-3 h-3" />
                              내부
                            </Badge>
                          ) : (
                            <Badge variant="secondary">외부</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {transaction.status === "unidentified" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedTransaction(transaction)
                                  setShowMatchDialog(true)
                                }}
                              >
                                매칭
                              </Button>
                            )}
                            {transaction.status === "matched" && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedTransaction(transaction)
                                  setShowApprovalDialog(true)
                                }}
                              >
                                승인
                              </Button>
                            )}
                          </div>
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

      {/* Manual Match Dialog */}
      <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>수동 회원 매칭</DialogTitle>
            <DialogDescription>
              입금자와 회원을 수동으로 매칭합니다. 매칭 후 관리자 승인이 필요합니다.
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4 py-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">거래 정보</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">입금자명:</span>
                    <span className="font-medium">{selectedTransaction.depositor_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">금액:</span>
                    <span className="font-medium">{formatNumber(selectedTransaction.amount)}원</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">거래일시:</span>
                    <span className="font-medium">
                      {formatDate(selectedTransaction.transaction_date)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label htmlFor="customer-search">회원 검색</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="customer-search"
                    placeholder="회원 이름 또는 번호를 입력하세요"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value)
                      searchCustomers(e.target.value)
                    }}
                    className="pl-9"
                  />
                </div>
              </div>

              {searchingCustomers && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              )}

              {!searchingCustomers && customers.length > 0 && (
                <div className="space-y-2">
                  <Label>검색 결과</Label>
                  <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
                    {customers.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => setSelectedCustomer(customer)}
                        className={`w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                          selectedCustomer?.id === customer.id
                            ? "bg-blue-50 dark:bg-blue-900/20"
                            : ""
                        }`}
                      >
                        <div className="text-sm font-medium">
                          {customer.member_number} - {customer.name}
                        </div>
                        {customer.depositor_name && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            예금주명: {customer.depositor_name}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedCustomer && (
                <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">선택된 회원</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                          {selectedCustomer.member_number} - {selectedCustomer.name}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedCustomer(null)}
                      >
                        취소
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMatchDialog(false)
                setSelectedTransaction(null)
                setSelectedCustomer(null)
                setCustomerSearch("")
                setCustomers([])
              }}
              disabled={matching}
            >
              취소
            </Button>
            <Button onClick={handleManualMatch} disabled={!selectedCustomer || matching}>
              {matching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  매칭 중...
                </>
              ) : (
                "매칭하기"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>입금 승인/거절</DialogTitle>
            <DialogDescription>
              매칭된 입금을 승인하거나 거절합니다.
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4 py-4">
              <Card>
                <CardContent className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">입금자명:</span>
                    <span className="font-medium">{selectedTransaction.depositor_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">금액:</span>
                    <span className="font-medium">{formatNumber(selectedTransaction.amount)}원</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">매칭회원:</span>
                    <span className="font-medium">
                      {selectedTransaction.customers
                        ? `${selectedTransaction.customers.member_number} - ${selectedTransaction.customers.name}`
                        : "-"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label htmlFor="approval-notes">메모 (선택)</Label>
                <Input
                  id="approval-notes"
                  placeholder="메모를 입력하세요"
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowApprovalDialog(false)
                setSelectedTransaction(null)
                setApprovalNotes("")
              }}
              disabled={approving}
            >
              취소
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={approving}>
              {approving ? "처리 중..." : "거절"}
            </Button>
            <Button onClick={handleApprove} disabled={approving}>
              {approving ? "처리 중..." : "승인"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
