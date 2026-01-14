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
import { Package, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"

interface InventoryItem {
  id: string
  item_name: string
  item_code: string
  current_stock: number
  min_stock_level: number
  unit: string
  unit_price: number
  last_restocked_at: string | null
  created_at: string
}

interface StockTransaction {
  id: string
  inventory_id: string
  transaction_type: "in" | "out"
  quantity: number
  reason: string
  created_by: string
  created_at: string
  user: {
    name: string | null
    username: string
  } | null
}

export default function InventoryPage() {
  const router = useRouter()
  const supabase = createClient()

  const [items, setItems] = useState<InventoryItem[]>([])
  const [transactions, setTransactions] = useState<StockTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [showStockDialog, setShowStockDialog] = useState(false)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [processing, setProcessing] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [stockTransaction, setStockTransaction] = useState({
    transaction_type: "in" as "in" | "out",
    quantity: 0,
    reason: "",
  })

  const [newItem, setNewItem] = useState({
    item_name: "",
    item_code: "",
    current_stock: 0,
    min_stock_level: 10,
    unit: "개",
    unit_price: 0,
  })

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    checkPermissions()
  }, [])

  useEffect(() => {
    if (hasAccess) {
      loadInventory()
      loadRecentTransactions()
    }
  }, [hasAccess])

  const checkPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/")
        return
      }

      setCurrentUserId(user.id)

      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()

      if (data && (data.role === "admin" || data.role === "operator" || data.role === "employee")) {
        setHasAccess(true)
      } else {
        router.push("/dashboard")
      }
    } catch (error) {
      console.error("Error checking permissions:", error)
      router.push("/")
    }
  }

  const loadInventory = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .order("item_name", { ascending: true })

      if (error) throw error
      setItems(data || [])
    } catch (error: any) {
      console.error("Error loading inventory:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadRecentTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("stock_transactions")
        .select(`
          *,
          user:users!stock_transactions_created_by_fkey (name, username)
        `)
        .order("created_at", { ascending: false })
        .limit(20)

      if (error) throw error
      setTransactions(data || [])
    } catch (error: any) {
      console.error("Error loading transactions:", error)
    }
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setProcessing(true)
    setError(null)
    setSuccess(null)

    try {
      const { error } = await supabase
        .from("inventory")
        .insert([{
          ...newItem,
          last_restocked_at: new Date().toISOString(),
        }])

      if (error) throw error

      setSuccess("소모품이 성공적으로 추가되었습니다.")
      setNewItem({
        item_name: "",
        item_code: "",
        current_stock: 0,
        min_stock_level: 10,
        unit: "개",
        unit_price: 0,
      })
      setShowAddItemDialog(false)
      loadInventory()

      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (error: any) {
      setError(error.message || "소모품 추가에 실패했습니다.")
    } finally {
      setProcessing(false)
    }
  }

  const handleStockTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem || !currentUserId) return

    setProcessing(true)
    setError(null)
    setSuccess(null)

    try {
      // Calculate new stock
      const newStock = stockTransaction.transaction_type === "in"
        ? selectedItem.current_stock + stockTransaction.quantity
        : selectedItem.current_stock - stockTransaction.quantity

      if (newStock < 0) {
        throw new Error("재고가 부족합니다.")
      }

      // Insert transaction
      const { error: transError } = await supabase
        .from("stock_transactions")
        .insert([{
          inventory_id: selectedItem.id,
          transaction_type: stockTransaction.transaction_type,
          quantity: stockTransaction.quantity,
          reason: stockTransaction.reason,
          created_by: currentUserId,
        }])

      if (transError) throw transError

      // Update inventory
      const updateData: any = {
        current_stock: newStock,
      }

      if (stockTransaction.transaction_type === "in") {
        updateData.last_restocked_at = new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from("inventory")
        .update(updateData)
        .eq("id", selectedItem.id)

      if (updateError) throw updateError

      setSuccess(`재고가 성공적으로 ${stockTransaction.transaction_type === "in" ? "입고" : "출고"}되었습니다.`)
      setStockTransaction({ transaction_type: "in", quantity: 0, reason: "" })
      setShowStockDialog(false)
      setSelectedItem(null)
      loadInventory()
      loadRecentTransactions()

      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (error: any) {
      setError(error.message || "재고 처리에 실패했습니다.")
    } finally {
      setProcessing(false)
    }
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString("ko-KR")
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const isLowStock = (item: InventoryItem) => {
    return item.current_stock <= item.min_stock_level
  }

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
              <Package className="w-6 h-6 text-blue-600" />
              소모품 재고 관리
            </h1>
          <Button onClick={() => setShowAddItemDialog(true)} className="bg-blue-600 hover:bg-blue-700">
            + 소모품 추가
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-md">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-md">
            {success}
          </div>
        )}

        {/* Low Stock Alerts */}
        {items.filter(isLowStock).length > 0 && (
          <Card className="border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <AlertTriangle className="w-5 h-5" />
                재고 부족 알림
              </CardTitle>
              <CardDescription>다음 소모품의 재고가 부족합니다</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.filter(isLowStock).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-gray-50">{item.item_name}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                        (현재: {item.current_stock}{item.unit}, 최소: {item.min_stock_level}{item.unit})
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedItem(item)
                        setStockTransaction({ ...stockTransaction, transaction_type: "in" })
                        setShowStockDialog(true)
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      입고
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Inventory Table */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle>재고 현황</CardTitle>
            <CardDescription>전체 소모품 재고 목록</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center p-12 text-gray-500 dark:text-gray-400">로딩 중...</div>
            ) : items.length === 0 ? (
              <div className="text-center p-12 text-gray-500 dark:text-gray-400">
                등록된 소모품이 없습니다.
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>품목명</TableHead>
                      <TableHead>품목코드</TableHead>
                      <TableHead className="text-right">현재 재고</TableHead>
                      <TableHead className="text-right">최소 재고</TableHead>
                      <TableHead className="text-right">단가</TableHead>
                      <TableHead>최근 입고일</TableHead>
                      <TableHead>작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow
                        key={item.id}
                        className={isLowStock(item) ? "bg-orange-50/50 dark:bg-orange-950/10" : ""}
                      >
                        <TableCell className="font-medium text-gray-900 dark:text-gray-50">
                          <div className="flex items-center gap-2">
                            {item.item_name}
                            {isLowStock(item) && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                부족
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300 font-mono text-sm">
                          {item.item_code}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${isLowStock(item) ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-50"}`}>
                          {formatNumber(item.current_stock)} {item.unit}
                        </TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-gray-300">
                          {formatNumber(item.min_stock_level)} {item.unit}
                        </TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-gray-300">
                          {formatNumber(item.unit_price)}원
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">
                          {formatDate(item.last_restocked_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedItem(item)
                                setStockTransaction({ ...stockTransaction, transaction_type: "in" })
                                setShowStockDialog(true)
                              }}
                              className="text-blue-600 border-blue-300 hover:bg-blue-50"
                            >
                              입고
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedItem(item)
                                setStockTransaction({ ...stockTransaction, transaction_type: "out" })
                                setShowStockDialog(true)
                              }}
                              className="text-orange-600 border-orange-300 hover:bg-orange-50"
                            >
                              출고
                            </Button>
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

        {/* Recent Transactions */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle>최근 거래 내역</CardTitle>
            <CardDescription>최근 20건의 입출고 내역</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center p-12 text-gray-500 dark:text-gray-400">
                거래 내역이 없습니다.
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>유형</TableHead>
                      <TableHead>수량</TableHead>
                      <TableHead>사유</TableHead>
                      <TableHead>처리자</TableHead>
                      <TableHead>일시</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((trans) => (
                      <TableRow key={trans.id}>
                        <TableCell>
                          <Badge className={trans.transaction_type === "in" ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"}>
                            {trans.transaction_type === "in" ? (
                              <><TrendingUp className="w-3 h-3 mr-1" /> 입고</>
                            ) : (
                              <><TrendingDown className="w-3 h-3 mr-1" /> 출고</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-gray-900 dark:text-gray-50">
                          {trans.quantity}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">
                          {trans.reason}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">
                          {trans.user?.name || trans.user?.username || "-"}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">
                          {formatDate(trans.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Item Dialog */}
        <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>소모품 추가</DialogTitle>
              <DialogDescription>새로운 소모품을 등록합니다</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddItem}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="item_name">품목명 *</Label>
                    <Input
                      id="item_name"
                      value={newItem.item_name}
                      onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                      required
                      disabled={processing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="item_code">품목코드 *</Label>
                    <Input
                      id="item_code"
                      value={newItem.item_code}
                      onChange={(e) => setNewItem({ ...newItem, item_code: e.target.value })}
                      required
                      disabled={processing}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="current_stock">초기 재고 *</Label>
                    <Input
                      id="current_stock"
                      type="number"
                      value={newItem.current_stock}
                      onChange={(e) => setNewItem({ ...newItem, current_stock: parseInt(e.target.value) || 0 })}
                      required
                      disabled={processing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min_stock_level">최소 재고 *</Label>
                    <Input
                      id="min_stock_level"
                      type="number"
                      value={newItem.min_stock_level}
                      onChange={(e) => setNewItem({ ...newItem, min_stock_level: parseInt(e.target.value) || 0 })}
                      required
                      disabled={processing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">단위 *</Label>
                    <Input
                      id="unit"
                      value={newItem.unit}
                      onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                      required
                      disabled={processing}
                      placeholder="개, 박스, 장"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit_price">단가 (원) *</Label>
                  <Input
                    id="unit_price"
                    type="number"
                    value={newItem.unit_price}
                    onChange={(e) => setNewItem({ ...newItem, unit_price: parseInt(e.target.value) || 0 })}
                    required
                    disabled={processing}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddItemDialog(false)}
                  disabled={processing}
                >
                  취소
                </Button>
                <Button type="submit" disabled={processing} className="bg-blue-600 hover:bg-blue-700">
                  {processing ? "처리 중..." : "추가"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Stock Transaction Dialog */}
        <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>재고 {stockTransaction.transaction_type === "in" ? "입고" : "출고"}</DialogTitle>
              <DialogDescription>재고를 {stockTransaction.transaction_type === "in" ? "입고" : "출고"}합니다</DialogDescription>
            </DialogHeader>

            {selectedItem && (
              <form onSubmit={handleStockTransaction}>
                <div className="space-y-4 py-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">품목</div>
                    <div className="font-medium text-gray-900 dark:text-gray-50">{selectedItem.item_name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      현재 재고: {selectedItem.current_stock}{selectedItem.unit}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quantity">수량 *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={stockTransaction.quantity}
                      onChange={(e) => setStockTransaction({ ...stockTransaction, quantity: parseInt(e.target.value) || 0 })}
                      required
                      disabled={processing}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">사유 *</Label>
                    <Input
                      id="reason"
                      value={stockTransaction.reason}
                      onChange={(e) => setStockTransaction({ ...stockTransaction, reason: e.target.value })}
                      required
                      disabled={processing}
                      placeholder={stockTransaction.transaction_type === "in" ? "예: 재고 보충" : "예: 사용"}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowStockDialog(false)}
                    disabled={processing}
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    disabled={processing}
                    className={stockTransaction.transaction_type === "in" ? "bg-blue-600 hover:bg-blue-700" : "bg-orange-600 hover:bg-orange-700"}
                  >
                    {processing ? "처리 중..." : stockTransaction.transaction_type === "in" ? "입고" : "출고"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
