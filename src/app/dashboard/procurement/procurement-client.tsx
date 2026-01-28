"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Package,
  ShoppingCart,
  BookOpen,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Home,
  DollarSign,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ProcurementItem {
  id: string
  task_id: string
  category: "book" | "goods"
  description: string
  amount: number
  status: string
  procurement_status: string | null
  cost_price: number | null
  selling_price: number | null
  shipping_cost: number | null
  sender_name: string | null
  created_at: string
  updated_at: string
  details: any
  task: {
    id: string
    ticket_no: string
    customer_id: string
    status: string
    customer: {
      name: string
      member_number: string
    }
  }
}

export default function ProcurementClient() {
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const [items, setItems] = useState<ProcurementItem[]>([])
  const [filteredItems, setFilteredItems] = useState<ProcurementItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "ordered" | "shipped" | "completed">("pending")

  // 수정 다이얼로그
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<ProcurementItem | null>(null)
  const [editData, setEditData] = useState({
    procurement_status: "",
    cost_price: 0,
    selling_price: 0,
    shipping_cost: 0,
    sender_name: "",
    tracking_number: "",
  })
  const [saving, setSaving] = useState(false)

  // 일괄 선택
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadProcurementItems()
  }, [])

  useEffect(() => {
    filterItems()
  }, [items, activeTab])

  const loadProcurementItems = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/procurement")
      const data = await response.json()

      if (data.success) {
        setItems(data.items || [])
      } else {
        toast({
          title: "오류",
          description: "데이터를 불러올 수 없습니다",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error loading procurement items:", error)
      toast({
        title: "오류",
        description: "데이터 로딩 중 오류 발생",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filterItems = () => {
    let filtered = items

    if (activeTab !== "all") {
      filtered = items.filter((item) => {
        const status = item.procurement_status || "pending"
        return status === activeTab
      })
    }

    setFilteredItems(filtered)
  }

  const handleEditClick = (item: ProcurementItem) => {
    setEditingItem(item)
    setEditData({
      procurement_status: item.procurement_status || "pending",
      cost_price: item.cost_price || 0,
      selling_price: item.selling_price || 0,
      shipping_cost: item.shipping_cost || 0,
      sender_name: item.sender_name || "",
      tracking_number: item.details?.tracking_number || "",
    })
    setShowEditDialog(true)
  }

  const handleSaveEdit = async () => {
    if (!editingItem) return

    try {
      setSaving(true)

      const response = await fetch("/api/procurement", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: editingItem.id,
          ...editData,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "✅ 저장 완료",
          description: "발주 정보가 업데이트되었습니다",
        })
        setShowEditDialog(false)
        setEditingItem(null)
        await loadProcurementItems()
      } else {
        toast({
          title: "저장 실패",
          description: data.error || "저장 중 오류 발생",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Save error:", error)
      toast({
        title: "저장 실패",
        description: "저장 중 오류 발생",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleBulkUpdate = async (newStatus: string) => {
    if (selectedItems.size === 0) {
      toast({
        title: "알림",
        description: "선택된 항목이 없습니다",
        variant: "destructive",
      })
      return
    }

    const confirmed = confirm(
      `선택한 ${selectedItems.size}개 항목의 상태를 "${getStatusLabel(newStatus)}"(으)로 변경하시겠습니까?`
    )

    if (!confirmed) return

    try {
      const response = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIds: Array.from(selectedItems),
          procurement_status: newStatus,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "✅ 일괄 업데이트 완료",
          description: `${data.successCount}개 항목이 업데이트되었습니다`,
        })
        setSelectedItems(new Set())
        await loadProcurementItems()
      } else {
        toast({
          title: "업데이트 실패",
          description: data.error || "일괄 업데이트 중 오류 발생",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Bulk update error:", error)
      toast({
        title: "업데이트 실패",
        description: "일괄 업데이트 중 오류 발생",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string | null) => {
    const statusMap: Record<string, { label: string; variant: any; icon: any }> = {
      pending: { label: "대기", variant: "outline", icon: Clock },
      ordered: { label: "발주됨", variant: "default", icon: ShoppingCart },
      shipped: { label: "배송중", variant: "default", icon: Truck },
      completed: { label: "완료", variant: "default", icon: CheckCircle2 },
    }

    const config = statusMap[status || "pending"] || statusMap.pending
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    )
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "대기",
      ordered: "발주됨",
      shipped: "배송중",
      completed: "완료",
    }
    return labels[status] || status
  }

  const getCategoryIcon = (category: string) => {
    return category === "book" ? <BookOpen className="w-4 h-4" /> : <Package className="w-4 h-4" />
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const stats = {
    total: items.length,
    pending: items.filter((i) => !i.procurement_status || i.procurement_status === "pending").length,
    ordered: items.filter((i) => i.procurement_status === "ordered").length,
    shipped: items.filter((i) => i.procurement_status === "shipped").length,
    completed: items.filter((i) => i.procurement_status === "completed").length,
    totalCost: items.reduce((sum, i) => sum + (i.cost_price || 0), 0),
    totalRevenue: items.reduce((sum, i) => sum + (i.selling_price || 0), 0),
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
              <Home className="w-4 h-4 mr-2" />
              대시보드
            </Button>
            <h1 className="text-2xl font-bold">발주 및 물품 대행 관리</h1>
          </div>
          <div className="flex gap-2">
            {selectedItems.size > 0 && (
              <>
                <Button
                  onClick={() => handleBulkUpdate("ordered")}
                  variant="outline"
                  size="sm"
                >
                  발주 완료 표시 ({selectedItems.size})
                </Button>
                <Button
                  onClick={() => handleBulkUpdate("shipped")}
                  variant="outline"
                  size="sm"
                >
                  배송 시작 ({selectedItems.size})
                </Button>
                <Button
                  onClick={() => handleBulkUpdate("completed")}
                  variant="default"
                  size="sm"
                >
                  완료 처리 ({selectedItems.size})
                </Button>
              </>
            )}
            <Button onClick={loadProcurementItems} variant="ghost" size="sm" disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>총 항목</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">전체 발주 항목</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>처리 대기</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{stats.pending}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">발주 필요</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>총 원가</CardDescription>
              <CardTitle className="text-3xl text-red-600">
                {stats.totalCost.toLocaleString()}원
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">구매 비용</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>총 판매가</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {stats.totalRevenue.toLocaleString()}원
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">마진: {(stats.totalRevenue - stats.totalCost).toLocaleString()}원</p>
            </CardContent>
          </Card>
        </div>

        {/* 탭 및 테이블 */}
        <Card>
          <CardHeader>
            <CardTitle>발주 항목 관리</CardTitle>
            <CardDescription>도서 및 물품 발주 현황</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
              <TabsList className="grid w-full grid-cols-5 mb-6">
                <TabsTrigger value="all">전체 ({stats.total})</TabsTrigger>
                <TabsTrigger value="pending">
                  <Clock className="w-4 h-4 mr-2" />
                  대기 ({stats.pending})
                </TabsTrigger>
                <TabsTrigger value="ordered">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  발주됨 ({stats.ordered})
                </TabsTrigger>
                <TabsTrigger value="shipped">
                  <Truck className="w-4 h-4 mr-2" />
                  배송중 ({stats.shipped})
                </TabsTrigger>
                <TabsTrigger value="completed">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  완료 ({stats.completed})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-0">
                {loading ? (
                  <div className="text-center p-12">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
                    데이터 로딩 중...
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center p-12">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">항목이 없습니다</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <input
                              type="checkbox"
                              checked={
                                selectedItems.size === filteredItems.length &&
                                filteredItems.length > 0
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedItems(new Set(filteredItems.map((i) => i.id)))
                                } else {
                                  setSelectedItems(new Set())
                                }
                              }}
                              className="w-4 h-4"
                            />
                          </TableHead>
                          <TableHead>분류</TableHead>
                          <TableHead>티켓번호</TableHead>
                          <TableHead>회원</TableHead>
                          <TableHead>상품명</TableHead>
                          <TableHead className="text-right">원가</TableHead>
                          <TableHead className="text-right">판매가</TableHead>
                          <TableHead className="text-right">배송비</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead>생성일</TableHead>
                          <TableHead className="text-right">관리</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedItems.has(item.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedItems)
                                  if (e.target.checked) {
                                    newSet.add(item.id)
                                  } else {
                                    newSet.delete(item.id)
                                  }
                                  setSelectedItems(newSet)
                                }}
                                className="w-4 h-4"
                              />
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                {getCategoryIcon(item.category)}
                                {item.category === "book" ? "도서" : "물품"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">{item.task.ticket_no}</TableCell>
                            <TableCell>
                              {item.task.customer.name} ({item.task.customer.member_number})
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{item.description}</TableCell>
                            <TableCell className="text-right">
                              {item.cost_price ? `${item.cost_price.toLocaleString()}원` : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.selling_price ? `${item.selling_price.toLocaleString()}원` : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.shipping_cost ? `${item.shipping_cost.toLocaleString()}원` : "-"}
                            </TableCell>
                            <TableCell>{getStatusBadge(item.procurement_status)}</TableCell>
                            <TableCell>{formatDate(item.created_at)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                onClick={() => handleEditClick(item)}
                                variant="outline"
                                size="sm"
                              >
                                수정
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* 수정 다이얼로그 */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>발주 정보 수정</DialogTitle>
              <DialogDescription>
                {editingItem?.description}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="procurement_status">발주 상태</Label>
                  <Select
                    value={editData.procurement_status}
                    onValueChange={(value) =>
                      setEditData({ ...editData, procurement_status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">대기</SelectItem>
                      <SelectItem value="ordered">발주됨</SelectItem>
                      <SelectItem value="shipped">배송중</SelectItem>
                      <SelectItem value="completed">완료</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="sender_name">발송인</Label>
                  <Input
                    id="sender_name"
                    value={editData.sender_name}
                    onChange={(e) =>
                      setEditData({ ...editData, sender_name: e.target.value })
                    }
                    placeholder="발송인 이름"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="cost_price">원가</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    value={editData.cost_price}
                    onChange={(e) =>
                      setEditData({ ...editData, cost_price: Number(e.target.value) })
                    }
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label htmlFor="selling_price">판매가</Label>
                  <Input
                    id="selling_price"
                    type="number"
                    value={editData.selling_price}
                    onChange={(e) =>
                      setEditData({ ...editData, selling_price: Number(e.target.value) })
                    }
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label htmlFor="shipping_cost">배송비</Label>
                  <Input
                    id="shipping_cost"
                    type="number"
                    value={editData.shipping_cost}
                    onChange={(e) =>
                      setEditData({ ...editData, shipping_cost: Number(e.target.value) })
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="tracking_number">송장번호</Label>
                <Input
                  id="tracking_number"
                  value={editData.tracking_number}
                  onChange={(e) =>
                    setEditData({ ...editData, tracking_number: e.target.value })
                  }
                  placeholder="송장번호 입력"
                />
              </div>

              {editData.selling_price > 0 && editData.cost_price > 0 && (
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded">
                  <div className="flex justify-between text-sm">
                    <span>마진:</span>
                    <span className="font-semibold text-green-600">
                      {(editData.selling_price - editData.cost_price - (editData.shipping_cost || 0)).toLocaleString()}원
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span>마진율:</span>
                    <span className="font-semibold">
                      {(((editData.selling_price - editData.cost_price - (editData.shipping_cost || 0)) / editData.selling_price) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                취소
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving ? "저장 중..." : "저장"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
