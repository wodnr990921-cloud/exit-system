"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Clock,
  ClockIcon,
  PackagePlus,
  DollarSign,
  MessageSquare,
  Trash2,
  Plus,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"

interface WorkReport {
  id: string
  employee_id: string
  clock_in: string
  clock_out: string | null
  consumables: Consumable[]
  expenses: Expense[]
  message: string
  status: string
  created_at: string
}

interface Consumable {
  item_code: string
  item_name: string
  quantity: number
  unit: string
}

interface Expense {
  description: string
  amount: number
  category?: string
}

interface InventoryItem {
  id: string
  item_code: string
  item_name: string
  category: string
  unit: string
  current_stock: number
}

export default function WorkReportWidget() {
  const supabase = createClient()
  const [currentReport, setCurrentReport] = useState<WorkReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Inventory items for consumables dropdown
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])

  // Form states
  const [consumables, setConsumables] = useState<Consumable[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [message, setMessage] = useState("")

  // New item forms
  const [newConsumable, setNewConsumable] = useState<{
    item_code: string
    item_name: string
    quantity: string
    unit: string
  }>({
    item_code: "",
    item_name: "",
    quantity: "",
    unit: "",
  })

  const [newExpense, setNewExpense] = useState<{
    description: string
    amount: string
    category: string
  }>({
    description: "",
    amount: "",
    category: "",
  })

  useEffect(() => {
    loadCurrentReport()
    loadInventoryItems()
  }, [])

  const loadInventoryItems = async () => {
    try {
      const response = await fetch("/api/inventory")
      const data = await response.json()

      if (data.success) {
        setInventoryItems(data.inventory || [])
      }
    } catch (error) {
      console.error("Error loading inventory items:", error)
    }
  }

  const loadCurrentReport = async () => {
    try {
      setLoading(true)
      const today = new Date().toISOString().split("T")[0]

      const response = await fetch(`/api/work-reports?date=${today}&status=in_progress`)
      const data = await response.json()

      if (data.success && data.reports && data.reports.length > 0) {
        const report = data.reports[0]
        setCurrentReport(report)
        setConsumables(report.consumables || [])
        setExpenses(report.expenses || [])
        setMessage(report.message || "")
      } else {
        setCurrentReport(null)
        setConsumables([])
        setExpenses([])
        setMessage("")
      }
    } catch (error) {
      console.error("Error loading work report:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleClockIn = async () => {
    try {
      setSubmitting(true)

      const response = await fetch("/api/work-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consumables: [],
          expenses: [],
          message: "",
        }),
      })

      const data = await response.json()

      if (data.success) {
        await loadCurrentReport()
      } else {
        alert(data.error || "Failed to clock in")
      }
    } catch (error) {
      console.error("Error clocking in:", error)
      alert("Failed to clock in")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClockOut = async () => {
    if (!currentReport) return

    try {
      setSubmitting(true)

      const response = await fetch("/api/work-reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: currentReport.id,
          clockOut: true,
          consumables,
          expenses,
          message,
        }),
      })

      const data = await response.json()

      if (data.success) {
        await loadCurrentReport()
      } else {
        alert(data.error || "Failed to clock out")
      }
    } catch (error) {
      console.error("Error clocking out:", error)
      alert("Failed to clock out")
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveChanges = async () => {
    if (!currentReport) return

    try {
      setSubmitting(true)

      const response = await fetch("/api/work-reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: currentReport.id,
          consumables,
          expenses,
          message,
        }),
      })

      const data = await response.json()

      if (data.success) {
        await loadCurrentReport()
        alert("Changes saved successfully")
      } else {
        alert(data.error || "Failed to save changes")
      }
    } catch (error) {
      console.error("Error saving changes:", error)
      alert("Failed to save changes")
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddConsumable = () => {
    if (!newConsumable.item_code || !newConsumable.quantity) {
      alert("Please select an item and enter quantity")
      return
    }

    const selectedItem = inventoryItems.find((item) => item.item_code === newConsumable.item_code)
    if (!selectedItem) {
      alert("Please select a valid item")
      return
    }

    const consumable: Consumable = {
      item_code: selectedItem.item_code,
      item_name: selectedItem.item_name,
      quantity: parseFloat(newConsumable.quantity),
      unit: selectedItem.unit,
    }

    setConsumables([...consumables, consumable])
    setNewConsumable({ item_code: "", item_name: "", quantity: "", unit: "" })
  }

  const handleRemoveConsumable = (index: number) => {
    setConsumables(consumables.filter((_, i) => i !== index))
  }

  const handleAddExpense = () => {
    if (!newExpense.description || !newExpense.amount) {
      alert("Please enter description and amount")
      return
    }

    const expense: Expense = {
      description: newExpense.description,
      amount: parseFloat(newExpense.amount),
      category: newExpense.category || "",
    }

    setExpenses([...expenses, expense])
    setNewExpense({ description: "", amount: "", category: "" })
  }

  const handleRemoveExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index))
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const calculateWorkHours = () => {
    if (!currentReport || !currentReport.clock_in) return "0"

    const clockIn = new Date(currentReport.clock_in)
    const now = new Date()
    const diff = now.getTime() - clockIn.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    return `${hours}시간 ${minutes}분`
  }

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            근무 보고
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          근무 보고
        </CardTitle>
        <CardDescription>출근/퇴근 및 업무 내용 기록</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Clock In/Out Status */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-3">
            {currentReport ? (
              <>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="font-semibold text-lg">출근 중</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    출근 시각: {formatTime(currentReport.clock_in)} • 근무 시간: {calculateWorkHours()}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <ClockIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  <div className="font-semibold text-lg">미출근</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">출근 버튼을 눌러 근무를 시작하세요</div>
                </div>
              </>
            )}
          </div>
          <div>
            {currentReport ? (
              <Button variant="destructive" onClick={handleClockOut} disabled={submitting}>
                <Clock className="w-4 h-4 mr-2" />
                퇴근하기
              </Button>
            ) : (
              <Button onClick={handleClockIn} disabled={submitting}>
                <Clock className="w-4 h-4 mr-2" />
                출근하기
              </Button>
            )}
          </div>
        </div>

        {currentReport && (
          <>
            {/* Consumables Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold">사용한 소모품</h3>
                <Badge variant="outline">{consumables.length}건</Badge>
              </div>

              {/* Add Consumable Form */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <Select
                    value={newConsumable.item_code}
                    onValueChange={(value) => {
                      const item = inventoryItems.find((i) => i.item_code === value)
                      setNewConsumable({
                        item_code: value,
                        item_name: item?.item_name || "",
                        quantity: "",
                        unit: item?.unit || "",
                      })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="소모품 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventoryItems.map((item) => (
                        <SelectItem key={item.item_code} value={item.item_code}>
                          {item.item_name} ({item.item_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    placeholder="수량"
                    value={newConsumable.quantity}
                    onChange={(e) =>
                      setNewConsumable({ ...newConsumable, quantity: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Input value={newConsumable.unit} disabled placeholder="단위" />
                </div>
                <div className="col-span-2">
                  <Button onClick={handleAddConsumable} className="w-full" size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    추가
                  </Button>
                </div>
              </div>

              {/* Consumables List */}
              {consumables.length > 0 && (
                <div className="space-y-2">
                  {consumables.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{item.item_name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {item.quantity} {item.unit} • {item.item_code}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveConsumable(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Expenses Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold">경비 지출</h3>
                <Badge variant="outline">{expenses.length}건</Badge>
                {totalExpenses > 0 && (
                  <Badge variant="secondary">{totalExpenses.toLocaleString()}원</Badge>
                )}
              </div>

              {/* Add Expense Form */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <Input
                    placeholder="설명"
                    value={newExpense.description}
                    onChange={(e) =>
                      setNewExpense({ ...newExpense, description: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    placeholder="금액"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    placeholder="분류"
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Button onClick={handleAddExpense} className="w-full" size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    추가
                  </Button>
                </div>
              </div>

              {/* Expenses List */}
              {expenses.length > 0 && (
                <div className="space-y-2">
                  {expenses.map((expense, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{expense.description}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {expense.amount.toLocaleString()}원
                          {expense.category && ` • ${expense.category}`}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveExpense(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Message Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold">업무 메모</h3>
              </div>
              <Textarea
                placeholder="오늘의 업무 내용, 특이사항 등을 기록하세요..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            {/* Save Button */}
            <Button onClick={handleSaveChanges} disabled={submitting} className="w-full">
              변경사항 저장
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
