"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { PackageX, Plus, TrendingUp } from "lucide-react"

interface Return {
  id: string
  ticket_id: string
  return_reason: string
  return_cost: number
  action_taken: string | null
  notes: string | null
  returned_at: string
  processed_by: string | null
  created_at: string
  ticket?: {
    tracking_number: string
    sender_name: string
  } | null
  processed_by_user?: {
    name: string
  } | null
}

interface Ticket {
  id: string
  tracking_number: string
  sender_name: string
  status: string
}

export default function ReturnsClient() {
  const router = useRouter()
  const supabase = createClient()

  const [returns, setReturns] = useState<Return[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  // Filters
  const [filterReason, setFilterReason] = useState<string>("all")
  const [filterAction, setFilterAction] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Dialogs
  const [showReturnDialog, setShowReturnDialog] = useState(false)
  const [showProcessDialog, setShowProcessDialog] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null)

  // Form state
  const [returnForm, setReturnForm] = useState({
    ticket_id: "",
    return_reason: "",
    return_cost: "",
    returned_at: new Date().toISOString().split("T")[0],
    notes: "",
  })

  const [processForm, setProcessForm] = useState({
    action_taken: "",
    notes: "",
  })

  useEffect(() => {
    checkPermissions()
  }, [])

  useEffect(() => {
    if (hasAccess) {
      loadReturns()
      loadTickets()
    }
  }, [hasAccess])

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

      if (data && ["ceo", "operator", "admin"].includes(data.role)) {
        setHasAccess(true)
      } else {
        router.push("/dashboard")
      }
    } catch (error) {
      console.error("Error checking permissions:", error)
      router.push("/")
    }
  }

  const loadReturns = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("returns")
        .select(`
          *,
          ticket:tickets!returns_ticket_id_fkey (tracking_number, sender_name),
          processed_by_user:users!returns_processed_by_fkey (name)
        `)
        .order("returned_at", { ascending: false })

      if (error) throw error
      setReturns(data || [])
    } catch (error: any) {
      console.error("Error loading returns:", error)
      setError("반송 목록을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const loadTickets = async () => {
    try {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, tracking_number, sender_name, status")
        .in("status", ["in_transit", "at_warehouse", "inspection"])
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error
      setTickets(data || [])
    } catch (error: any) {
      console.error("Error loading tickets:", error)
    }
  }

  const openNewReturnDialog = () => {
    setReturnForm({
      ticket_id: "",
      return_reason: "",
      return_cost: "",
      returned_at: new Date().toISOString().split("T")[0],
      notes: "",
    })
    setShowReturnDialog(true)
  }

  const openProcessDialog = (returnItem: Return) => {
    setSelectedReturn(returnItem)
    setProcessForm({
      action_taken: returnItem.action_taken || "",
      notes: returnItem.notes || "",
    })
    setShowProcessDialog(true)
  }

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    setProcessing(true)
    setError(null)
    setSuccess(null)

    try {
      if (!returnForm.ticket_id || !returnForm.return_reason || !returnForm.return_cost) {
        throw new Error("필수 항목을 모두 입력해주세요.")
      }

      const response = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          ...returnForm,
          return_cost: parseFloat(returnForm.return_cost),
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "반송 등록에 실패했습니다.")
      }

      setSuccess("반송이 등록되었습니다.")
      setShowReturnDialog(false)
      loadReturns()

      setTimeout(() => setSuccess(null), 3000)
    } catch (error: any) {
      setError(error.message || "반송 등록에 실패했습니다.")
    } finally {
      setProcessing(false)
    }
  }

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedReturn) return

    setProcessing(true)
    setError(null)
    setSuccess(null)

    try {
      if (!processForm.action_taken) {
        throw new Error("처리 방법을 선택해주세요.")
      }

      const response = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "process",
          returnId: selectedReturn.id,
          action_taken: processForm.action_taken,
          notes: processForm.notes,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "처리에 실패했습니다.")
      }

      setSuccess("반송이 처리되었습니다.")
      setShowProcessDialog(false)
      setSelectedReturn(null)
      loadReturns()

      setTimeout(() => setSuccess(null), 3000)
    } catch (error: any) {
      setError(error.message || "처리에 실패했습니다.")
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString("ko-KR")
  }

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      transfer: "이감",
      release: "출소",
      unknown_recipient: "수취인불명",
      prohibited_item: "금지물품",
      address_error: "주소 오류",
      refused: "수취 거부",
      other: "기타",
    }
    return labels[reason] || reason
  }

  const getReasonColor = (reason: string) => {
    const colors: Record<string, string> = {
      transfer: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      release: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
      unknown_recipient: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      prohibited_item: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
      address_error: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
      refused: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
      other: "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    }
    return colors[reason] || colors.other
  }

  const getActionLabel = (action: string | null) => {
    if (!action) return "-"
    const labels: Record<string, string> = {
      resend: "재발송",
      dispose: "폐기",
      hold: "보관",
      refund: "환불",
    }
    return labels[action] || action
  }

  const filteredReturns = returns.filter((returnItem) => {
    // Reason filter
    if (filterReason !== "all" && returnItem.return_reason !== filterReason) {
      return false
    }

    // Action filter
    if (filterAction === "pending" && returnItem.action_taken) {
      return false
    } else if (filterAction === "processed" && !returnItem.action_taken) {
      return false
    } else if (filterAction !== "all" && filterAction !== "pending" && filterAction !== "processed" && returnItem.action_taken !== filterAction) {
      return false
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        returnItem.ticket?.tracking_number.toLowerCase().includes(query) ||
        returnItem.ticket?.sender_name.toLowerCase().includes(query)

      if (!matchesSearch) return false
    }

    return true
  })

  const totalReturnCost = filteredReturns.reduce((sum, r) => sum + r.return_cost, 0)

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-gray-600 dark:text-gray-400">접근 권한이 없습니다.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
            <PackageX className="w-6 h-6 text-red-600" />
            반송 처리
          </h1>
          <Button onClick={openNewReturnDialog} className="bg-red-600 hover:bg-red-700">
            <Plus className="w-4 h-4 mr-2" />
            반송 등록
          </Button>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 rounded-md">
            {success}
          </div>
        )}

        {/* Statistics */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">총 반송 비용</Label>
                <p className="mt-2 text-2xl font-semibold text-red-600 dark:text-red-400">
                  {formatNumber(totalReturnCost)}원
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle>검색 및 필터</CardTitle>
            <CardDescription>반송 내역을 검색하고 필터링합니다</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>검색</Label>
                <Input
                  placeholder="송장번호, 발송인명..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>반송 사유</Label>
                <Select value={filterReason} onValueChange={setFilterReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="transfer">이감</SelectItem>
                    <SelectItem value="release">출소</SelectItem>
                    <SelectItem value="unknown_recipient">수취인불명</SelectItem>
                    <SelectItem value="prohibited_item">금지물품</SelectItem>
                    <SelectItem value="address_error">주소 오류</SelectItem>
                    <SelectItem value="refused">수취 거부</SelectItem>
                    <SelectItem value="other">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>처리 상태</Label>
                <Select value={filterAction} onValueChange={setFilterAction}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="pending">미처리</SelectItem>
                    <SelectItem value="processed">처리완료</SelectItem>
                    <SelectItem value="resend">재발송</SelectItem>
                    <SelectItem value="dispose">폐기</SelectItem>
                    <SelectItem value="hold">보관</SelectItem>
                    <SelectItem value="refund">환불</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Returns Table */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle>반송 목록</CardTitle>
            <CardDescription>총 {filteredReturns.length}건</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center p-12 text-gray-500 dark:text-gray-400">로딩 중...</div>
            ) : filteredReturns.length === 0 ? (
              <div className="text-center p-12 text-gray-500 dark:text-gray-400">
                반송 내역이 없습니다.
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80 dark:bg-gray-800/50">
                      <TableHead>송장번호</TableHead>
                      <TableHead>발송인</TableHead>
                      <TableHead>반송 사유</TableHead>
                      <TableHead>반송일</TableHead>
                      <TableHead>반송 비용</TableHead>
                      <TableHead>처리 방법</TableHead>
                      <TableHead>처리자</TableHead>
                      <TableHead>작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReturns.map((returnItem) => (
                      <TableRow key={returnItem.id} className="border-b border-gray-100 dark:border-gray-800/50">
                        <TableCell className="font-mono text-sm text-gray-900 dark:text-gray-50">
                          {returnItem.ticket?.tracking_number || "-"}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">
                          {returnItem.ticket?.sender_name || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={getReasonColor(returnItem.return_reason)}>
                            {getReasonLabel(returnItem.return_reason)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">
                          {formatDate(returnItem.returned_at)}
                        </TableCell>
                        <TableCell className="font-medium text-red-600 dark:text-red-400">
                          {formatNumber(returnItem.return_cost)}원
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">
                          {returnItem.action_taken ? (
                            <Badge variant="outline">{getActionLabel(returnItem.action_taken)}</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">미처리</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">
                          {returnItem.processed_by_user?.name || "-"}
                        </TableCell>
                        <TableCell>
                          {!returnItem.action_taken && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openProcessDialog(returnItem)}
                            >
                              처리
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Return Dialog */}
        <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>반송 등록</DialogTitle>
              <DialogDescription>반송된 우편물을 등록합니다.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateReturn}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="ticket">송장번호 *</Label>
                  <Select
                    value={returnForm.ticket_id}
                    onValueChange={(value) => setReturnForm({ ...returnForm, ticket_id: value })}
                    disabled={processing}
                  >
                    <SelectTrigger id="ticket">
                      <SelectValue placeholder="송장을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {tickets.map((ticket) => (
                        <SelectItem key={ticket.id} value={ticket.id}>
                          {ticket.tracking_number} - {ticket.sender_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">반송 사유 *</Label>
                  <Select
                    value={returnForm.return_reason}
                    onValueChange={(value) => setReturnForm({ ...returnForm, return_reason: value })}
                    disabled={processing}
                  >
                    <SelectTrigger id="reason">
                      <SelectValue placeholder="반송 사유를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transfer">이감</SelectItem>
                      <SelectItem value="release">출소</SelectItem>
                      <SelectItem value="unknown_recipient">수취인불명</SelectItem>
                      <SelectItem value="prohibited_item">금지물품</SelectItem>
                      <SelectItem value="address_error">주소 오류</SelectItem>
                      <SelectItem value="refused">수취 거부</SelectItem>
                      <SelectItem value="other">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cost">반송 비용 *</Label>
                  <Input
                    id="cost"
                    type="number"
                    value={returnForm.return_cost}
                    onChange={(e) => setReturnForm({ ...returnForm, return_cost: e.target.value })}
                    placeholder="반송 비용을 입력하세요"
                    disabled={processing}
                    min="0"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="returned_at">반송일 *</Label>
                  <Input
                    id="returned_at"
                    type="date"
                    value={returnForm.returned_at}
                    onChange={(e) => setReturnForm({ ...returnForm, returned_at: e.target.value })}
                    disabled={processing}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">비고</Label>
                  <Textarea
                    id="notes"
                    value={returnForm.notes}
                    onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                    placeholder="특이사항을 입력하세요"
                    rows={4}
                    disabled={processing}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowReturnDialog(false)}
                  disabled={processing}
                >
                  취소
                </Button>
                <Button type="submit" disabled={processing} className="bg-red-600 hover:bg-red-700">
                  {processing ? "처리 중..." : "등록"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Process Return Dialog */}
        <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>반송 처리</DialogTitle>
              <DialogDescription>반송 우편물의 처리 방법을 선택합니다.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleProcessReturn}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="action">처리 방법 *</Label>
                  <Select
                    value={processForm.action_taken}
                    onValueChange={(value) => setProcessForm({ ...processForm, action_taken: value })}
                    disabled={processing}
                  >
                    <SelectTrigger id="action">
                      <SelectValue placeholder="처리 방법을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resend">재발송</SelectItem>
                      <SelectItem value="dispose">폐기</SelectItem>
                      <SelectItem value="hold">보관</SelectItem>
                      <SelectItem value="refund">환불</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="process_notes">처리 비고</Label>
                  <Textarea
                    id="process_notes"
                    value={processForm.notes}
                    onChange={(e) => setProcessForm({ ...processForm, notes: e.target.value })}
                    placeholder="처리 내용을 입력하세요"
                    rows={4}
                    disabled={processing}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowProcessDialog(false)
                    setSelectedReturn(null)
                  }}
                  disabled={processing}
                >
                  취소
                </Button>
                <Button type="submit" disabled={processing} className="bg-blue-600 hover:bg-blue-700">
                  {processing ? "처리 중..." : "처리"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
