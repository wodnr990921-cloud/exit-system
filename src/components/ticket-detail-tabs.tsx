"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, DollarSign, ShoppingCart, Trophy } from "lucide-react"

interface Task {
  id: string
  ticket_no?: string
  status: string
  customer?: {
    id: string
    name: string
    member_number: string
    total_point_general?: number
    total_point_betting?: number
  } | null
}

interface TicketDetailTabsProps {
  task: Task
  onUpdate: () => void
}

export default function TicketDetailTabs({ task, onUpdate }: TicketDetailTabsProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("charge")

  // 충전/입금 처리
  const [chargeAmount, setChargeAmount] = useState("")
  const [chargeCategory, setChargeCategory] = useState<"general" | "betting">("general")
  const [chargeType, setChargeType] = useState<"charge" | "deposit">("charge")
  const [chargeReason, setChargeReason] = useState("")
  const [processingCharge, setProcessingCharge] = useState(false)

  // 차감 처리
  const [deductItems, setDeductItems] = useState<Array<{ category: string; description: string; amount: number }>>([])
  const [deductCategory, setDeductCategory] = useState<"book" | "goods" | "agency" | "other">("book")
  const [deductDescription, setDeductDescription] = useState("")
  const [deductAmount, setDeductAmount] = useState("")

  const handleProcessCharge = async () => {
    if (!chargeAmount || parseFloat(chargeAmount) <= 0) {
      toast({
        title: "오류",
        description: "금액을 입력하세요.",
        variant: "destructive",
      })
      return
    }

    setProcessingCharge(true)
    try {
      const response = await fetch(`/api/tickets/${task.id}/process-charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(chargeAmount),
          category: chargeCategory,
          type: chargeType,
          reason: chargeReason,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "충전 처리에 실패했습니다.")
      }

      toast({
        title: "성공",
        description: result.message,
      })

      // 초기화
      setChargeAmount("")
      setChargeReason("")
      onUpdate()
    } catch (error: any) {
      console.error("Charge error:", error)
      toast({
        title: "오류",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setProcessingCharge(false)
    }
  }

  const handleAddDeductItem = () => {
    if (!deductDescription.trim() || !deductAmount || parseFloat(deductAmount) <= 0) {
      toast({
        title: "오류",
        description: "항목 내용과 금액을 입력하세요.",
        variant: "destructive",
      })
      return
    }

    setDeductItems([
      ...deductItems,
      {
        category: deductCategory,
        description: deductDescription.trim(),
        amount: parseFloat(deductAmount),
      },
    ])

    setDeductDescription("")
    setDeductAmount("")
  }

  const handleRemoveDeductItem = (index: number) => {
    setDeductItems(deductItems.filter((_, i) => i !== index))
  }

  const handleProcessDeduct = async () => {
    if (deductItems.length === 0) {
      toast({
        title: "오류",
        description: "차감 항목을 추가하세요.",
        variant: "destructive",
      })
      return
    }

    setProcessingCharge(true)
    try {
      const response = await fetch(`/api/tickets/${task.id}/process-deduct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: deductItems }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "차감 처리에 실패했습니다.")
      }

      toast({
        title: "성공",
        description: result.message,
      })

      // 초기화
      setDeductItems([])
      onUpdate()
    } catch (error: any) {
      console.error("Deduct error:", error)
      toast({
        title: "오류",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setProcessingCharge(false)
    }
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      book: "도서",
      goods: "물품",
      agency: "대행",
      other: "기타",
      game: "경기",
    }
    return labels[category] || category
  }

  const totalDeductAmount = deductItems.reduce((sum, item) => sum + item.amount, 0)

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="charge" className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          충전/입금
        </TabsTrigger>
        <TabsTrigger value="deduct" className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          차감 처리
        </TabsTrigger>
        <TabsTrigger value="betting" className="flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          배팅
        </TabsTrigger>
      </TabsList>

      {/* 충전/입금 탭 */}
      <TabsContent value="charge" className="space-y-4">
        <Card>
          <CardContent className="pt-6 space-y-4">
            {task.customer && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <p className="text-sm">
                  <span className="font-semibold">현재 잔액:</span>{" "}
                  일반 {task.customer.total_point_general?.toLocaleString() || 0}P / 배팅{" "}
                  {task.customer.total_point_betting?.toLocaleString() || 0}P
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>포인트 종류</Label>
                <Select value={chargeCategory} onValueChange={(value: "general" | "betting") => setChargeCategory(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">일반 포인트</SelectItem>
                    <SelectItem value="betting">배팅 포인트</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>처리 유형</Label>
                <Select value={chargeType} onValueChange={(value: "charge" | "deposit") => setChargeType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="charge">충전</SelectItem>
                    <SelectItem value="deposit">입금</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>금액 (원)</Label>
              <Input
                type="number"
                placeholder="금액을 입력하세요"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
              />
            </div>

            <div>
              <Label>사유 (선택사항)</Label>
              <Textarea
                placeholder="충전 사유를 입력하세요"
                value={chargeReason}
                onChange={(e) => setChargeReason(e.target.value)}
                rows={2}
              />
            </div>

            <Button onClick={handleProcessCharge} disabled={processingCharge} className="w-full">
              {processingCharge ? "처리 중..." : "충전 요청"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* 차감 처리 탭 */}
      <TabsContent value="deduct" className="space-y-4">
        <Card>
          <CardContent className="pt-6 space-y-4">
            {task.customer && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <p className="text-sm">
                  <span className="font-semibold">현재 잔액:</span>{" "}
                  일반 {task.customer.total_point_general?.toLocaleString() || 0}P / 배팅{" "}
                  {task.customer.total_point_betting?.toLocaleString() || 0}P
                </p>
              </div>
            )}

            <div className="space-y-3">
              <Label>항목 추가</Label>
              <div className="grid grid-cols-4 gap-2">
                <Select value={deductCategory} onValueChange={(value: any) => setDeductCategory(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="book">도서</SelectItem>
                    <SelectItem value="goods">물품</SelectItem>
                    <SelectItem value="agency">대행</SelectItem>
                    <SelectItem value="other">기타</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  placeholder="내용"
                  value={deductDescription}
                  onChange={(e) => setDeductDescription(e.target.value)}
                  className="col-span-2"
                />

                <Input
                  type="number"
                  placeholder="금액"
                  value={deductAmount}
                  onChange={(e) => setDeductAmount(e.target.value)}
                />
              </div>

              <Button onClick={handleAddDeductItem} variant="outline" className="w-full" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                항목 추가
              </Button>
            </div>

            {deductItems.length > 0 && (
              <div className="space-y-2">
                <Label>차감 항목 ({deductItems.length}개)</Label>
                <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
                  {deductItems.map((item, index) => (
                    <div key={index} className="p-3 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded">
                            {getCategoryLabel(item.category)}
                          </span>
                          <span className="text-sm">{item.description}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{item.amount.toLocaleString()}원</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveDeductItem(index)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md flex justify-between items-center">
                  <span className="font-semibold">합계</span>
                  <span className="text-lg font-bold text-red-600">{totalDeductAmount.toLocaleString()}원</span>
                </div>

                <Button onClick={handleProcessDeduct} disabled={processingCharge} className="w-full">
                  {processingCharge ? "처리 중..." : "차감 요청"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* 배팅 탭 */}
      <TabsContent value="betting" className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-gray-500">
              <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>배팅 처리 기능은 준비 중입니다.</p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
