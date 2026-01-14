"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Calendar, Trash2, CheckCircle } from "lucide-react"

interface DocumentRetention {
  id: string
  document_type: string
  ticket_id: string | null
  customer_id: string | null
  retention_until: string
  destruction_date: string | null
  is_destroyed: boolean
  destroyed_by: string | null
  notes: string | null
  created_at: string
  ticket?: {
    tracking_number: string
  } | null
  customer?: {
    member_number: string
    name: string
  } | null
  destroyed_by_user?: {
    name: string
  } | null
}

export default function DocumentRetentionClient() {
  const router = useRouter()
  const supabase = createClient()

  const [documents, setDocuments] = useState<DocumentRetention[]>([])
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  // Filters
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  // Dialogs
  const [showDestroyDialog, setShowDestroyDialog] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<DocumentRetention | null>(null)

  useEffect(() => {
    checkPermissions()
  }, [])

  useEffect(() => {
    if (hasAccess) {
      loadDocuments()
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

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("document_retention")
        .select(`
          *,
          ticket:tickets!document_retention_ticket_id_fkey (tracking_number),
          customer:customers!document_retention_customer_id_fkey (member_number, name),
          destroyed_by_user:users!document_retention_destroyed_by_fkey (name)
        `)
        .order("retention_until", { ascending: true })

      if (error) throw error
      setDocuments(data || [])
    } catch (error: any) {
      console.error("Error loading documents:", error)
      setError("문서 목록을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const handleDestroyDocument = async () => {
    if (!selectedDocument) return

    setProcessing(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/document-retention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "destroy",
          documentId: selectedDocument.id,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "파기 처리에 실패했습니다.")
      }

      setSuccess("문서가 파기 처리되었습니다.")
      setShowDestroyDialog(false)
      setSelectedDocument(null)
      loadDocuments()

      setTimeout(() => setSuccess(null), 3000)
    } catch (error: any) {
      setError(error.message || "파기 처리에 실패했습니다.")
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleString("ko-KR")
  }

  const isOverdue = (retentionUntil: string) => {
    const today = new Date()
    const retentionDate = new Date(retentionUntil)
    return retentionDate < today
  }

  const getDaysUntilDestruction = (retentionUntil: string) => {
    const today = new Date()
    const retentionDate = new Date(retentionUntil)
    const diffDays = Math.ceil((retentionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const pendingDocuments = documents.filter(doc => !doc.is_destroyed)
  const destroyedDocuments = documents.filter(doc => doc.is_destroyed)

  const filteredPendingDocuments = pendingDocuments.filter((doc) => {
    // Date filter
    if (dateFrom && new Date(doc.retention_until) < new Date(dateFrom)) {
      return false
    }
    if (dateTo && new Date(doc.retention_until) > new Date(dateTo)) {
      return false
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        doc.document_type.toLowerCase().includes(query) ||
        doc.ticket?.tracking_number.toLowerCase().includes(query) ||
        doc.customer?.name.toLowerCase().includes(query) ||
        doc.customer?.member_number.toLowerCase().includes(query)

      if (!matchesSearch) return false
    }

    return true
  })

  const filteredDestroyedDocuments = destroyedDocuments.filter((doc) => {
    // Date filter
    if (dateFrom && doc.destruction_date && new Date(doc.destruction_date) < new Date(dateFrom)) {
      return false
    }
    if (dateTo && doc.destruction_date && new Date(doc.destruction_date) > new Date(dateTo)) {
      return false
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        doc.document_type.toLowerCase().includes(query) ||
        doc.ticket?.tracking_number.toLowerCase().includes(query) ||
        doc.customer?.name.toLowerCase().includes(query) ||
        doc.customer?.member_number.toLowerCase().includes(query)

      if (!matchesSearch) return false
    }

    return true
  })

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
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              원본 파기 스케줄
            </h1>
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

        {/* Filters */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              검색 및 필터
            </CardTitle>
            <CardDescription>문서를 검색하고 날짜별로 필터링합니다</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>검색</Label>
                <Input
                  placeholder="문서 유형, 송장번호, 회원명..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>시작일</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>종료일</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-gray-800">
            <TabsTrigger value="pending">
              파기 예정 ({filteredPendingDocuments.length})
            </TabsTrigger>
            <TabsTrigger value="destroyed">
              파기 완료 ({filteredDestroyedDocuments.length})
            </TabsTrigger>
          </TabsList>

          {/* Pending Documents */}
          <TabsContent value="pending">
            <Card className="border-gray-200 dark:border-gray-800">
              <CardHeader>
                <CardTitle>파기 예정 문서</CardTitle>
                <CardDescription>보관 기간이 만료되는 문서 목록입니다</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center p-12 text-gray-500 dark:text-gray-400">로딩 중...</div>
                ) : filteredPendingDocuments.length === 0 ? (
                  <div className="text-center p-12 text-gray-500 dark:text-gray-400">
                    파기 예정 문서가 없습니다.
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50/80 dark:bg-gray-800/50">
                          <TableHead>문서 유형</TableHead>
                          <TableHead>송장번호</TableHead>
                          <TableHead>회원</TableHead>
                          <TableHead>파기 예정일</TableHead>
                          <TableHead>남은 일수</TableHead>
                          <TableHead>비고</TableHead>
                          <TableHead>작업</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPendingDocuments.map((doc) => {
                          const daysLeft = getDaysUntilDestruction(doc.retention_until)
                          const overdue = isOverdue(doc.retention_until)

                          return (
                            <TableRow key={doc.id} className="border-b border-gray-100 dark:border-gray-800/50">
                              <TableCell className="font-medium text-gray-900 dark:text-gray-50">
                                {doc.document_type}
                              </TableCell>
                              <TableCell className="font-mono text-sm text-gray-700 dark:text-gray-300">
                                {doc.ticket?.tracking_number || "-"}
                              </TableCell>
                              <TableCell className="text-gray-700 dark:text-gray-300">
                                {doc.customer
                                  ? `${doc.customer.member_number} - ${doc.customer.name}`
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-gray-700 dark:text-gray-300">
                                {formatDate(doc.retention_until)}
                              </TableCell>
                              <TableCell>
                                {overdue ? (
                                  <Badge variant="destructive">기한 경과</Badge>
                                ) : daysLeft <= 7 ? (
                                  <Badge className="bg-amber-600">D-{daysLeft}</Badge>
                                ) : (
                                  <span className="text-gray-700 dark:text-gray-300">D-{daysLeft}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                {doc.notes || "-"}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedDocument(doc)
                                    setShowDestroyDialog(true)
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  파기
                                </Button>
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
          </TabsContent>

          {/* Destroyed Documents */}
          <TabsContent value="destroyed">
            <Card className="border-gray-200 dark:border-gray-800">
              <CardHeader>
                <CardTitle>파기 완료 문서</CardTitle>
                <CardDescription>파기 처리된 문서 기록입니다</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center p-12 text-gray-500 dark:text-gray-400">로딩 중...</div>
                ) : filteredDestroyedDocuments.length === 0 ? (
                  <div className="text-center p-12 text-gray-500 dark:text-gray-400">
                    파기 완료 문서가 없습니다.
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50/80 dark:bg-gray-800/50">
                          <TableHead>문서 유형</TableHead>
                          <TableHead>송장번호</TableHead>
                          <TableHead>회원</TableHead>
                          <TableHead>파기일</TableHead>
                          <TableHead>파기자</TableHead>
                          <TableHead>비고</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDestroyedDocuments.map((doc) => (
                          <TableRow key={doc.id} className="border-b border-gray-100 dark:border-gray-800/50">
                            <TableCell className="font-medium text-gray-900 dark:text-gray-50">
                              {doc.document_type}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-gray-700 dark:text-gray-300">
                              {doc.ticket?.tracking_number || "-"}
                            </TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">
                              {doc.customer
                                ? `${doc.customer.member_number} - ${doc.customer.name}`
                                : "-"}
                            </TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">
                              {formatDateTime(doc.destruction_date)}
                            </TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">
                              {doc.destroyed_by_user?.name || "-"}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                              {doc.notes || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Destroy Confirmation Dialog */}
        <Dialog open={showDestroyDialog} onOpenChange={setShowDestroyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>문서 파기 확인</DialogTitle>
              <DialogDescription>
                정말로 이 문서를 파기 처리하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </DialogDescription>
            </DialogHeader>

            {selectedDocument && (
              <div className="py-4 space-y-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">문서 유형:</span>
                  <span className="text-sm text-gray-900 dark:text-gray-50">{selectedDocument.document_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">송장번호:</span>
                  <span className="text-sm text-gray-900 dark:text-gray-50">
                    {selectedDocument.ticket?.tracking_number || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">회원:</span>
                  <span className="text-sm text-gray-900 dark:text-gray-50">
                    {selectedDocument.customer
                      ? `${selectedDocument.customer.member_number} - ${selectedDocument.customer.name}`
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">파기 예정일:</span>
                  <span className="text-sm text-gray-900 dark:text-gray-50">
                    {formatDate(selectedDocument.retention_until)}
                  </span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDestroyDialog(false)
                  setSelectedDocument(null)
                }}
                disabled={processing}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleDestroyDocument}
                disabled={processing}
              >
                {processing ? "처리 중..." : "파기"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
