"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Label } from "@/components/ui/label"

interface TaskItem {
  id: string
  task_id: string
  category: string
  description: string
  amount: number
  status: string
  created_at: string
  details?: any
  bookInfo?: {
    id: string
    title: string
    author: string | null
  } | null
  stockQuantity?: number | null
  stockWarning?: boolean
  tasks?: {
    id: string
    ticket_no: string | null
    member_id: string | null
    customer: {
      member_number: string
      name: string
      institution: string | null
      prison_number: string | null
    } | null
  }
}

interface Task {
  id: string
  ticket_no: string | null
  member_id: string | null
  customer: {
    member_number: string
    name: string
    institution: string | null
    prison_number: string | null
  } | null
  items: TaskItem[]
}

interface BookGroup {
  id: string
  items: TaskItem[]
  totalCount: number
}

interface LabelData {
  sender: {
    id: string
    name: string
    email: string | null
    phone: string | null
    address: string | null
  }
  items: Array<{
    id: string
    description: string
    category: string
    amount: number
  }>
  customer: {
    member_number: string
    name: string
    institution: string | null
    prison_number: string | null
    address: string | null
  } | null
  ticket_no: string | null
}

export default function LogisticsClient() {
  const router = useRouter()
  const supabase = createClient()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [labelData, setLabelData] = useState<LabelData | null>(null)
  const [showLabelDialog, setShowLabelDialog] = useState(false)
  const [generatingLabel, setGeneratingLabel] = useState(false)

  useEffect(() => {
    loadLogisticsItems()
  }, [])

  const loadLogisticsItems = async () => {
    setLoading(true)
    try {
      // 새 API 사용 (재고 정보 포함)
      const response = await fetch("/api/logistics/items")
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "아이템 목록을 불러오는데 실패했습니다.")
      }

      const items = data.items || []

      if (items.length === 0) {
        setTasks([])
        return
      }

      // 티켓 단위로 그룹화
      const tasksMap = new Map<string, Task>()
      items.forEach((item: any) => {
        const task = item.tasks
        if (!task) return

        const taskId = task.id
        if (!tasksMap.has(taskId)) {
          tasksMap.set(taskId, {
            id: taskId,
            ticket_no: task.ticket_no,
            member_id: task.member_id,
            customer: task.customer,
            items: [],
          })
        }
        // task 속성을 제거하고 item만 추가
        const { tasks: _, ...itemWithoutTask } = item
        tasksMap.get(taskId)!.items.push(itemWithoutTask)
      })

      setTasks(Array.from(tasksMap.values()))
      setError(null)
    } catch (error: any) {
      console.error("Error loading logistics items:", error)
      setError(
        error.message || error.details || "데이터를 불러오는데 실패했습니다. task_items 테이블이 생성되었는지 확인해주세요."
      )
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  const toggleTask = (taskId: string) => {
    const newExpanded = new Set(expandedTasks)
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId)
    } else {
      newExpanded.add(taskId)
    }
    setExpandedTasks(newExpanded)
  }

  // details에서 quantity 추출 헬퍼 함수
  const getItemQuantity = (item: TaskItem): number => {
    if (item.details) {
      try {
        let details: any = {}
        if (typeof item.details === "string") {
          details = JSON.parse(item.details)
        } else if (typeof item.details === "object") {
          details = item.details
        }
        return details.quantity || 1
      } catch (e) {
        return 1
      }
    }
    return 1
  }

  // 5권 분할 알고리즘 (details에서 quantity 추출)
  const splitBooksIntoGroups = (bookItems: TaskItem[]): BookGroup[] => {
    // 전체 수량 계산
    let totalBookCount = 0
    bookItems.forEach((item) => {
      totalBookCount += getItemQuantity(item)
    })

    // 5권 이하면 분할 불필요
    if (totalBookCount <= 5) {
      return [
        {
          id: "group-1",
          items: bookItems,
          totalCount: totalBookCount,
        },
      ]
    }

    // 5권 초과 시 분할
    const groups: BookGroup[] = []
    let currentGroup: TaskItem[] = []
    let currentCount = 0

    bookItems.forEach((item) => {
      const quantity = getItemQuantity(item)

      if (currentCount + quantity > 5 && currentGroup.length > 0) {
        // 현재 그룹 완료 (5권)
        groups.push({
          id: `group-${groups.length + 1}`,
          items: [...currentGroup],
          totalCount: currentCount,
        })
        currentGroup = []
        currentCount = 0
      }

      currentGroup.push(item)
      currentCount += quantity
    })

    // 마지막 그룹 추가
    if (currentGroup.length > 0) {
      groups.push({
        id: `group-${groups.length + 1}`,
        items: currentGroup,
        totalCount: currentCount,
      })
    }

    return groups
  }

  // 그룹별 재고 확인
  const checkGroupStock = (group: BookGroup): boolean => {
    for (const item of group.items) {
      if (item.stockWarning) {
        return false
      }
    }
    return true
  }

  const handleGenerateLabel = async (itemIds: string[]) => {
    // 클라이언트 측 재고 재확인 (이중 체크)
    const items = tasks
      .flatMap((task) => task.items)
      .filter((item) => itemIds.includes(item.id))
    
    const hasStockIssue = items.some((item) => item.stockWarning)
    if (hasStockIssue) {
      alert("재고가 부족한 도서가 포함되어 있습니다. 재고를 확인해주세요.")
      return
    }

    setGeneratingLabel(true)
    try {
      const response = await fetch("/api/logistics/generate-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds }),
      })

      const data = await response.json()

      if (!response.ok) {
        // 재고 부족 에러 메시지 개선
        if (data.error && data.error.includes("재고 부족")) {
          throw new Error(data.error)
        }
        throw new Error(data.error || "라벨 생성에 실패했습니다.")
      }

      setLabelData(data.label)
      setShowLabelDialog(true)
      await loadLogisticsItems() // 목록 새로고침 (재고 정보 업데이트)
    } catch (error: any) {
      console.error("Error generating label:", error)
      alert(error.message || "라벨 생성에 실패했습니다.")
    } finally {
      setGeneratingLabel(false)
    }
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString("ko-KR")
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => router.back()}>
            ← 뒤로가기
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            홈
          </Button>
          <h1 className="text-3xl font-bold">물류 관리</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>배송 대기 목록</CardTitle>
            <CardDescription>도서 및 물품 배송 아이템 목록입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <div className="text-center p-8 text-gray-500">배송 대기 중인 아이템이 없습니다.</div>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => {
                  const isExpanded = expandedTasks.has(task.id)
                  const bookItems = task.items.filter((item) => item.category === "book")
                  const goodsItems = task.items.filter((item) => item.category === "goods")
                  const bookGroups = bookItems.length > 0 ? splitBooksIntoGroups(bookItems) : []

                  return (
                    <Card key={task.id} className="border-gray-200 dark:border-gray-800">
                      <CardHeader
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                        onClick={() => toggleTask(task.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              티켓: {task.ticket_no || task.id.substring(0, 8).toUpperCase()}
                            </CardTitle>
                            <CardDescription>
                              {task.customer
                                ? `${task.customer.member_number} - ${task.customer.name} ${
                                    task.customer.institution && task.customer.prison_number
                                      ? `(${task.customer.institution} ${task.customer.prison_number})`
                                      : ""
                                  }`
                                : "회원 정보 없음"}
                            </CardDescription>
                          </div>
                          <div className="text-sm text-gray-500">
                            {isExpanded ? "▼" : "▶"} {task.items.length}개 아이템
                          </div>
                        </div>
                      </CardHeader>
                      {isExpanded && (
                        <CardContent className="space-y-6">
                          {/* 도서 아이템 (5권 분할) */}
                          {bookGroups.length > 0 && (
                            <div className="space-y-4">
                              <h3 className="font-semibold text-lg">도서 배송</h3>
                              {bookGroups.map((group, groupIndex) => {
                                const hasStockWarning = !checkGroupStock(group)
                                return (
                                  <Card
                                    key={group.id}
                                    className={`${
                                      hasStockWarning
                                        ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                                        : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                                    }`}
                                  >
                                    <CardHeader>
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <CardTitle className="text-base">
                                            {groupIndex + 1}차 발송 ({group.totalCount}권)
                                          </CardTitle>
                                          {hasStockWarning && (
                                            <div className="mt-1 text-sm font-medium text-red-600 dark:text-red-400">
                                              ⚠️ 재고 부족
                                            </div>
                                          )}
                                        </div>
                                        <Button
                                          onClick={() => handleGenerateLabel(group.items.map((item) => item.id))}
                                          disabled={generatingLabel || hasStockWarning}
                                          className={
                                            hasStockWarning
                                              ? "bg-gray-400 cursor-not-allowed"
                                              : "bg-blue-600 hover:bg-blue-700"
                                          }
                                          size="sm"
                                        >
                                          라벨 출력
                                        </Button>
                                      </div>
                                    </CardHeader>
                                    <CardContent>
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>도서명</TableHead>
                                            <TableHead>재고</TableHead>
                                            <TableHead className="text-right">수량</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {group.items.map((item) => {
                                            const quantity = getItemQuantity(item)
                                            return (
                                              <TableRow key={item.id}>
                                                <TableCell>
                                                  <div>
                                                    <div className="font-medium">
                                                      {item.bookInfo?.title || item.description}
                                                    </div>
                                                    {item.bookInfo?.author && (
                                                      <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {item.bookInfo.author}
                                                      </div>
                                                    )}
                                                  </div>
                                                </TableCell>
                                                <TableCell>
                                                  {item.stockQuantity !== null && item.stockQuantity !== undefined ? (
                                                    <span
                                                      className={
                                                        item.stockWarning
                                                          ? "text-red-600 dark:text-red-400 font-medium"
                                                          : "text-gray-700 dark:text-gray-300"
                                                      }
                                                    >
                                                      {item.stockQuantity}권
                                                    </span>
                                                  ) : (
                                                    <span className="text-gray-400">-</span>
                                                  )}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">{quantity}권</TableCell>
                                              </TableRow>
                                            )
                                          })}
                                        </TableBody>
                                      </Table>
                                    </CardContent>
                                  </Card>
                                )
                              })}
                            </div>
                          )}

                          {/* 물품 아이템 */}
                          {goodsItems.length > 0 && (
                            <div className="space-y-4">
                              <h3 className="font-semibold text-lg">물품 배송</h3>
                              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                                <CardHeader>
                                  <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">물품 배송</CardTitle>
                                    <Button
                                      onClick={() => handleGenerateLabel(goodsItems.map((item) => item.id))}
                                      disabled={generatingLabel}
                                      className="bg-green-600 hover:bg-green-700"
                                      size="sm"
                                    >
                                      라벨 출력
                                    </Button>
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>내용</TableHead>
                                        <TableHead className="text-right">금액</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {goodsItems.map((item) => (
                                        <TableRow key={item.id}>
                                          <TableCell>{item.description}</TableCell>
                                          <TableCell className="text-right">{formatNumber(item.amount)}원</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 라벨 다이얼로그 */}
        <Dialog open={showLabelDialog} onOpenChange={setShowLabelDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>배송 라벨</DialogTitle>
              <DialogDescription>배송 라벨 정보입니다. 인쇄하여 사용하세요.</DialogDescription>
            </DialogHeader>
            {labelData && (
              <div className="space-y-4 py-4">
                <div className="border-2 border-gray-300 p-6 space-y-4">
                  {/* 발송인 정보 */}
                  <div className="border-b pb-2">
                    <Label className="text-sm font-medium text-gray-500">발송인</Label>
                    <div className="mt-1">
                      <p className="font-semibold">{labelData.sender.name}</p>
                      {labelData.sender.address && <p className="text-sm">{labelData.sender.address}</p>}
                      {labelData.sender.phone && <p className="text-sm">전화: {labelData.sender.phone}</p>}
                    </div>
                  </div>

                  {/* 받는 사람 정보 */}
                  {labelData.customer && (
                    <div className="border-b pb-2">
                      <Label className="text-sm font-medium text-gray-500">받는 사람</Label>
                      <div className="mt-1">
                        <p className="font-semibold">{labelData.customer.name}</p>
                        {labelData.customer.institution && labelData.customer.prison_number && (
                          <p className="text-sm">
                            {labelData.customer.institution} {labelData.customer.prison_number}
                          </p>
                        )}
                        {labelData.customer.address && <p className="text-sm">{labelData.customer.address}</p>}
                      </div>
                    </div>
                  )}

                  {/* 티켓 번호 */}
                  {labelData.ticket_no && (
                    <div className="border-b pb-2">
                      <Label className="text-sm font-medium text-gray-500">티켓 번호</Label>
                      <p className="mt-1 font-mono">{labelData.ticket_no}</p>
                    </div>
                  )}

                  {/* Picking List */}
                  <div>
                    <Label className="text-sm font-medium text-gray-500">포함 품목</Label>
                    <ul className="mt-2 space-y-1">
                      {labelData.items.map((item) => (
                        <li key={item.id} className="text-sm">
                          • {item.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => window.print()}>
                인쇄
              </Button>
              <Button onClick={() => setShowLabelDialog(false)}>닫기</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
