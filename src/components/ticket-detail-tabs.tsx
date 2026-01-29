"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
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
import { Plus, Trash2, DollarSign, ShoppingCart, Trophy, Edit3 } from "lucide-react"

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
  items?: Array<{
    id: string
    match_id?: string | null
    betting_choice?: string | null
    betting_odds?: number | null
    potential_win?: number | null
    category?: string
    description?: string
    amount?: number
  }>
}

interface TicketDetailTabsProps {
  task: Task
  onUpdate: () => void
  currentUserRole?: string
}

export default function TicketDetailTabs({ task, onUpdate, currentUserRole }: TicketDetailTabsProps) {
  const { toast } = useToast()
  const supabase = createClient()
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

  // 배팅 처리
  const [matches, setMatches] = useState<any[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState("")
  const [bettingChoice, setBettingChoice] = useState("")
  const [bettingAmount, setBettingAmount] = useState("")
  const [bettingOdds, setBettingOdds] = useState("")
  const [processingBetting, setProcessingBetting] = useState(false)
  const [editingOdds, setEditingOdds] = useState<string | null>(null)
  const [newOdds, setNewOdds] = useState("")

  useEffect(() => {
    if (activeTab === "betting") {
      loadMatches()
    }
  }, [activeTab])

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

  const loadMatches = async () => {
    setLoadingMatches(true)
    try {
      const { data, error } = await supabase
        .from("sports_matches")
        .select("*")
        .eq("status", "scheduled")
        .order("match_date", { ascending: true })
        .limit(20)

      if (error) throw error
      setMatches(data || [])
    } catch (error: any) {
      console.error("Load matches error:", error)
    } finally {
      setLoadingMatches(false)
    }
  }

  const handleProcessBetting = async () => {
    if (!selectedMatch || !bettingChoice || !bettingAmount || parseFloat(bettingAmount) <= 0) {
      toast({
        title: "오류",
        description: "모든 정보를 입력하세요.",
        variant: "destructive",
      })
      return
    }

    setProcessingBetting(true)
    try {
      const response = await fetch(`/api/tickets/${task.id}/process-betting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: selectedMatch,
          betting_choice: bettingChoice,
          betting_amount: parseFloat(bettingAmount),
          betting_odds: bettingOdds ? parseFloat(bettingOdds) : null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "배팅 처리에 실패했습니다.")
      }

      toast({
        title: "성공",
        description: result.message,
      })

      // 초기화
      setSelectedMatch("")
      setBettingChoice("")
      setBettingAmount("")
      setBettingOdds("")
      onUpdate()
    } catch (error: any) {
      console.error("Betting error:", error)
      toast({
        title: "오류",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setProcessingBetting(false)
    }
  }

  const handleUpdateOdds = async (taskItemId: string) => {
    if (!newOdds || parseFloat(newOdds) <= 0) {
      toast({
        title: "오류",
        description: "배당을 입력하세요.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch(`/api/tickets/${task.id}/update-betting-odds`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_item_id: taskItemId,
          betting_odds: parseFloat(newOdds),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "배당 수정에 실패했습니다.")
      }

      toast({
        title: "성공",
        description: result.message,
      })

      setEditingOdds(null)
      setNewOdds("")
      onUpdate()
    } catch (error: any) {
      console.error("Update odds error:", error)
      toast({
        title: "오류",
        description: error.message,
        variant: "destructive",
      })
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
          <CardContent className="pt-6 space-y-4">
            {task.customer && (
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md">
                <p className="text-sm">
                  <span className="font-semibold">배팅 포인트:</span>{" "}
                  {task.customer.total_point_betting?.toLocaleString() || 0}P
                </p>
              </div>
            )}

            {/* 기존 배팅 목록 */}
            {task.items && task.items.filter((item) => item.category === "game").length > 0 && (
              <div className="space-y-2">
                <Label>등록된 배팅</Label>
                <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
                  {task.items
                    .filter((item) => item.category === "game")
                    .map((item) => (
                      <div key={item.id} className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-semibold text-sm">{item.betting_choice}</div>
                            <div className="text-xs text-gray-500">배팅: {item.amount?.toLocaleString()}P</div>
                          </div>
                          <div className="text-right">
                            {editingOdds === item.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  placeholder="배당"
                                  value={newOdds}
                                  onChange={(e) => setNewOdds(e.target.value)}
                                  className="w-20 h-8"
                                  step="0.01"
                                />
                                <Button size="sm" onClick={() => handleUpdateOdds(item.id)} className="h-8">
                                  저장
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingOdds(null)}
                                  className="h-8"
                                >
                                  취소
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {item.betting_odds ? (
                                  <>
                                    <div className="text-sm">
                                      <span className="font-semibold text-blue-600">
                                        {item.betting_odds}배
                                      </span>
                                      <div className="text-xs text-gray-500">
                                        예상: {item.potential_win?.toLocaleString()}P
                                      </div>
                                    </div>
                                    {currentUserRole && ["ceo", "admin", "operator"].includes(currentUserRole) && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingOdds(item.id)
                                          setNewOdds(item.betting_odds?.toString() || "")
                                        }}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Edit3 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <span className="text-xs text-gray-500">배당 미설정</span>
                                    {currentUserRole && ["ceo", "admin", "operator"].includes(currentUserRole) && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEditingOdds(item.id)
                                          setNewOdds("")
                                        }}
                                        className="h-8"
                                      >
                                        배당 설정
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <Label className="mb-3 block">새 배팅 추가</Label>

              {loadingMatches ? (
                <div className="text-center py-4 text-gray-500">경기 목록 로딩 중...</div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label>경기 선택</Label>
                    <Select value={selectedMatch} onValueChange={setSelectedMatch}>
                      <SelectTrigger>
                        <SelectValue placeholder="경기를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {matches.length === 0 ? (
                          <div className="p-2 text-sm text-gray-500">진행 중인 경기가 없습니다</div>
                        ) : (
                          matches.map((match) => (
                            <SelectItem key={match.id} value={match.id}>
                              {match.home_team} vs {match.away_team}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>선택 (승/무/패)</Label>
                      <Input
                        placeholder="예: 홈승, 원정승"
                        value={bettingChoice}
                        onChange={(e) => setBettingChoice(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label>배팅 금액 (P)</Label>
                      <Input
                        type="number"
                        placeholder="배팅 금액"
                        value={bettingAmount}
                        onChange={(e) => setBettingAmount(e.target.value)}
                      />
                    </div>
                  </div>

                  {currentUserRole && ["ceo", "admin", "operator"].includes(currentUserRole) && (
                    <div>
                      <Label>배당 (관리자만 설정 가능, 선택사항)</Label>
                      <Input
                        type="number"
                        placeholder="배당 (예: 1.95)"
                        value={bettingOdds}
                        onChange={(e) => setBettingOdds(e.target.value)}
                        step="0.01"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        * 접수 시 배당을 비워두고, 나중에 관리자가 설정할 수 있습니다.
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleProcessBetting}
                    disabled={processingBetting || !selectedMatch}
                    className="w-full"
                  >
                    {processingBetting ? "처리 중..." : "배팅 추가"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
