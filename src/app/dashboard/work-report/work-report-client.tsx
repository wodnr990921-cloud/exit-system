"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { 
  ClipboardList, 
  Clock, 
  Package, 
  DollarSign, 
  MessageSquare, 
  Home,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SupplyItem {
  id: string
  code: string
  name: string
  category: string
  unit: string
  unit_price: number
  current_stock: number
}

interface SupplyUsed {
  code: string
  name: string
  quantity: number
  unit_price: number
}

interface Expense {
  category: string
  item: string
  amount: number
  receipt_url?: string
}

interface WorkReport {
  id: string
  report_date: string
  clock_in_time: string | null
  clock_out_time: string | null
  work_hours: number | null
  supplies_used: SupplyUsed[]
  expenses: Expense[]
  handover_notes: string | null
  total_supply_cost: number
  total_expense_amount: number
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
}

export default function WorkReportClient() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // 출퇴근 섹션 접기/펼치기
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(true)
  
  // 업무보고 데이터
  const [todayReport, setTodayReport] = useState<WorkReport | null>(null)
  const [clockedIn, setClockedIn] = useState(false)
  const [clockedOut, setClockedOut] = useState(false)
  
  // 소모품 관련
  const [availableSupplies, setAvailableSupplies] = useState<SupplyItem[]>([])
  const [selectedSupply, setSelectedSupply] = useState<string>("")
  const [supplyQuantity, setSupplyQuantity] = useState<number>(1)
  const [suppliesUsed, setSuppliesUsed] = useState<SupplyUsed[]>([])
  
  // 경비 관련
  const [expenseCategory, setExpenseCategory] = useState<string>("")
  const [expenseItem, setExpenseItem] = useState<string>("")
  const [expenseAmount, setExpenseAmount] = useState<number>(0)
  const [expenses, setExpenses] = useState<Expense[]>([])
  
  // 전달사항
  const [handoverNotes, setHandoverNotes] = useState<string>("")

  useEffect(() => {
    loadTodayReport()
    loadAvailableSupplies()
  }, [])

  const loadTodayReport = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("로그인이 필요합니다.")

      const today = new Date().toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from("daily_work_reports")
        .select("*")
        .eq("user_id", user.id)
        .eq("report_date", today)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error
      }

      if (data) {
        setTodayReport(data)
        setClockedIn(!!data.clock_in_time)
        setClockedOut(!!data.clock_out_time)
        setSuppliesUsed(data.supplies_used || [])
        setExpenses(data.expenses || [])
        setHandoverNotes(data.handover_notes || "")
      }
    } catch (err: any) {
      console.error("Error loading today's report:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableSupplies = async () => {
    try {
      const { data, error } = await supabase
        .from("supply_items")
        .select("*")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true })

      if (error) throw error
      setAvailableSupplies(data || [])
    } catch (err: any) {
      console.error("Error loading supplies:", err)
    }
  }

  const handleClockIn = async () => {
    try {
      setSaving(true)
      setError(null)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("로그인이 필요합니다.")

      const today = new Date().toISOString().split('T')[0]
      const now = new Date().toISOString()

      if (todayReport) {
        // 업데이트
        const { error } = await supabase
          .from("daily_work_reports")
          .update({ clock_in_time: now })
          .eq("id", todayReport.id)

        if (error) throw error
      } else {
        // 새로 생성
        const { error } = await supabase
          .from("daily_work_reports")
          .insert({
            user_id: user.id,
            report_date: today,
            clock_in_time: now,
          })

        if (error) throw error
      }

      setSuccess("출근이 기록되었습니다.")
      await loadTodayReport()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleClockOut = async () => {
    try {
      setSaving(true)
      setError(null)
      
      if (!todayReport) {
        throw new Error("출근 기록이 없습니다.")
      }

      const now = new Date().toISOString()

      const { error } = await supabase
        .from("daily_work_reports")
        .update({ clock_out_time: now })
        .eq("id", todayReport.id)

      if (error) throw error

      setSuccess("퇴근이 기록되었습니다.")
      await loadTodayReport()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddSupply = () => {
    if (!selectedSupply || supplyQuantity <= 0) {
      setError("소모품과 수량을 입력하세요.")
      return
    }

    const supply = availableSupplies.find(s => s.id === selectedSupply)
    if (!supply) return

    const newSupply: SupplyUsed = {
      code: supply.code,
      name: supply.name,
      quantity: supplyQuantity,
      unit_price: supply.unit_price,
    }

    setSuppliesUsed([...suppliesUsed, newSupply])
    setSelectedSupply("")
    setSupplyQuantity(1)
    setError(null)
  }

  const handleRemoveSupply = (index: number) => {
    setSuppliesUsed(suppliesUsed.filter((_, i) => i !== index))
  }

  const handleAddExpense = () => {
    if (!expenseCategory || !expenseItem || expenseAmount <= 0) {
      setError("경비 정보를 모두 입력하세요.")
      return
    }

    const newExpense: Expense = {
      category: expenseCategory,
      item: expenseItem,
      amount: expenseAmount,
    }

    setExpenses([...expenses, newExpense])
    setExpenseCategory("")
    setExpenseItem("")
    setExpenseAmount(0)
    setError(null)
  }

  const handleRemoveExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index))
  }

  const handleSaveReport = async () => {
    try {
      setSaving(true)
      setError(null)

      if (!todayReport) {
        throw new Error("출근 기록이 없습니다. 먼저 출근을 해주세요.")
      }

      const totalSupplyCost = suppliesUsed.reduce(
        (sum, s) => sum + s.quantity * s.unit_price,
        0
      )
      const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0)

      const { error } = await supabase
        .from("daily_work_reports")
        .update({
          supplies_used: suppliesUsed,
          expenses: expenses,
          handover_notes: handoverNotes,
          total_supply_cost: totalSupplyCost,
          total_expense_amount: totalExpenseAmount,
        })
        .eq("id", todayReport.id)

      if (error) throw error

      setSuccess("업무보고가 저장되었습니다.")
      await loadTodayReport()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitReport = async () => {
    try {
      setSaving(true)
      setError(null)

      if (!todayReport) {
        throw new Error("출근 기록이 없습니다.")
      }

      const { error } = await supabase
        .from("daily_work_reports")
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq("id", todayReport.id)

      if (error) throw error

      setSuccess("업무보고가 제출되었습니다.")
      await loadTodayReport()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const formatTime = (timeString: string | null) => {
    if (!timeString) return "-"
    return new Date(timeString).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const totalSupplyCost = suppliesUsed.reduce(
    (sum, s) => sum + s.quantity * s.unit_price,
    0
  )
  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0)

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-12 w-64 bg-gray-200 animate-pulse rounded" />
        <div className="h-96 w-full bg-gray-200 animate-pulse rounded" />
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-blue-600" />
            업무보고
          </h1>
          <p className="text-muted-foreground mt-2">
            {new Date().toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          홈으로
        </Button>
      </div>

      {/* 알림 */}
      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-900">성공</AlertTitle>
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 출퇴근 기록 - 접을 수 있음 */}
      <Card>
        <CardHeader className="pb-3">
          <div 
            className="flex items-center justify-between cursor-pointer group"
            onClick={() => setIsAttendanceOpen(!isAttendanceOpen)}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <div>
                <CardTitle className="text-lg">출퇴근 기록</CardTitle>
                <CardDescription>출근 및 퇴근 시간을 기록합니다</CardDescription>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="group-hover:bg-gray-100 dark:group-hover:bg-gray-800"
              type="button"
            >
              {isAttendanceOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        {isAttendanceOpen && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>출근 시간</Label>
                <div className="flex items-center gap-3">
                  <Input
                    value={formatTime(todayReport?.clock_in_time || null)}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    onClick={handleClockIn}
                    disabled={clockedIn || saving}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {clockedIn ? "출근완료" : "출근"}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>퇴근 시간</Label>
                <div className="flex items-center gap-3">
                  <Input
                    value={formatTime(todayReport?.clock_out_time || null)}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    onClick={handleClockOut}
                    disabled={!clockedIn || clockedOut || saving}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {clockedOut ? "퇴근완료" : "퇴근"}
                  </Button>
                </div>
              </div>
            </div>
            {todayReport?.work_hours && (
              <div className="text-sm text-muted-foreground">
                총 근무시간: <strong>{todayReport.work_hours.toFixed(1)}시간</strong>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* 소모품 사용 보고 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            소모품 사용 보고
          </CardTitle>
          <CardDescription>오늘 사용한 소모품을 기록합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <Label>소모품</Label>
              <Select value={selectedSupply} onValueChange={setSelectedSupply}>
                <SelectTrigger>
                  <SelectValue placeholder="소모품 선택" />
                </SelectTrigger>
                <SelectContent>
                  {availableSupplies.map((supply) => (
                    <SelectItem key={supply.id} value={supply.id}>
                      [{supply.code}] {supply.name} - {supply.unit_price}원/{supply.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>수량</Label>
              <Input
                type="number"
                min="1"
                value={supplyQuantity}
                onChange={(e) => setSupplyQuantity(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddSupply} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                추가
              </Button>
            </div>
          </div>

          {suppliesUsed.length > 0 && (
            <div className="border rounded-md">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium">소모품</th>
                    <th className="px-4 py-2 text-right text-sm font-medium">수량</th>
                    <th className="px-4 py-2 text-right text-sm font-medium">단가</th>
                    <th className="px-4 py-2 text-right text-sm font-medium">합계</th>
                    <th className="px-4 py-2 text-center text-sm font-medium">삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliesUsed.map((supply, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-2 text-sm">{supply.name}</td>
                      <td className="px-4 py-2 text-sm text-right">{supply.quantity}</td>
                      <td className="px-4 py-2 text-sm text-right">
                        {supply.unit_price.toLocaleString()}원
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-medium">
                        {(supply.quantity * supply.unit_price).toLocaleString()}원
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSupply(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t bg-gray-50 font-bold">
                    <td colSpan={3} className="px-4 py-2 text-sm text-right">
                      총액
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      {totalSupplyCost.toLocaleString()}원
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 경비 지출 보고 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            경비 지출 보고
          </CardTitle>
          <CardDescription>오늘 지출한 경비를 기록합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <Label>구분</Label>
              <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="구분" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="교통비">교통비</SelectItem>
                  <SelectItem value="식대">식대</SelectItem>
                  <SelectItem value="우편요금">우편요금</SelectItem>
                  <SelectItem value="택배비">택배비</SelectItem>
                  <SelectItem value="사무용품">사무용품</SelectItem>
                  <SelectItem value="기타">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>항목</Label>
              <Input
                placeholder="항목 입력"
                value={expenseItem}
                onChange={(e) => setExpenseItem(e.target.value)}
              />
            </div>
            <div>
              <Label>금액</Label>
              <Input
                type="number"
                min="0"
                placeholder="금액"
                value={expenseAmount || ""}
                onChange={(e) => setExpenseAmount(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddExpense} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                추가
              </Button>
            </div>
          </div>

          {expenses.length > 0 && (
            <div className="border rounded-md">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium">구분</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">항목</th>
                    <th className="px-4 py-2 text-right text-sm font-medium">금액</th>
                    <th className="px-4 py-2 text-center text-sm font-medium">삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-2 text-sm">{expense.category}</td>
                      <td className="px-4 py-2 text-sm">{expense.item}</td>
                      <td className="px-4 py-2 text-sm text-right font-medium">
                        {expense.amount.toLocaleString()}원
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveExpense(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t bg-gray-50 font-bold">
                    <td colSpan={2} className="px-4 py-2 text-sm text-right">
                      총액
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      {totalExpenseAmount.toLocaleString()}원
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 전달사항 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            전달사항
          </CardTitle>
          <CardDescription>다음 근무자에게 전달할 사항을 작성합니다</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="전달사항을 입력하세요..."
            value={handoverNotes}
            onChange={(e) => setHandoverNotes(e.target.value)}
            rows={5}
          />
        </CardContent>
      </Card>

      {/* 하단 버튼 */}
      <div className="flex items-center justify-end gap-3">
        <Badge variant={todayReport?.status === 'submitted' ? 'default' : 'secondary'}>
          {todayReport?.status === 'submitted' ? '제출완료' : '작성중'}
        </Badge>
        <Button
          variant="outline"
          onClick={handleSaveReport}
          disabled={!clockedIn || saving || todayReport?.status === 'submitted'}
        >
          임시저장
        </Button>
        <Button
          onClick={handleSubmitReport}
          disabled={!clockedIn || saving || todayReport?.status === 'submitted'}
          className="bg-blue-600 hover:bg-blue-700"
        >
          제출하기
        </Button>
      </div>
    </div>
  )
}
