"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Archive, Home, Search, Eye } from "lucide-react"

interface Task {
  id: string
  ticket_no?: string
  title: string
  description: string | null
  status: string
  work_type: string | null
  total_amount: number | null
  created_at: string
  closed_at: string | null
  customer: {
    member_number: string
    name: string
    institution: string | null
  } | null
  user: {
    name: string | null
    username: string
  } | null
  closed_by_user: {
    name: string | null
    username: string
  } | null
  items?: Array<{
    id: string
    category?: string
    description?: string
    amount?: number
  }>
}

export default function ArchiveClient() {
  const router = useRouter()
  const supabase = createClient()

  const [tasks, setTasks] = useState<Task[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchType, setSearchType] = useState<"keyword" | "member" | "ticket">("keyword")
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    loadClosedTasks()
  }, [])

  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearch()
    } else {
      setTasks(allTasks)
    }
  }, [searchQuery, searchType, allTasks])

  const loadClosedTasks = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          `
          *,
          customer:customers!tasks_customer_id_fkey (member_number, name, institution),
          user:users!tasks_user_id_fkey (name, username),
          closed_by_user:users!tasks_closed_by_fkey (name, username),
          items:task_items(id, category, description, amount)
        `
        )
        .eq("status", "closed") // 마감된 티켓만
        .order("closed_at", { ascending: false })
        .limit(500)

      if (error) throw error

      setAllTasks(data || [])
      setTasks(data || [])
    } catch (error: any) {
      console.error("Error loading closed tasks:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setTasks(allTasks)
      return
    }

    const query = searchQuery.toLowerCase().trim()

    const filtered = allTasks.filter((task) => {
      if (searchType === "keyword") {
        return (
          task.title?.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query) ||
          task.work_type?.toLowerCase().includes(query)
        )
      } else if (searchType === "member") {
        return (
          task.customer?.name.toLowerCase().includes(query) ||
          task.customer?.member_number.toLowerCase().includes(query)
        )
      } else if (searchType === "ticket") {
        return task.ticket_no?.toLowerCase().includes(query)
      }
      return false
    })

    setTasks(filtered)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    const date = new Date(dateString)
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatNumber = (num: number | null) => {
    if (num === null || num === undefined) return "0"
    return num.toLocaleString()
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      book: "도서",
      game: "경기",
      goods: "물품",
      inquiry: "문의",
      complaint: "민원",
      other: "기타",
      complex: "복합",
    }
    return labels[category] || category
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Archive className="h-8 w-8 text-purple-600" />
            보관함
          </h1>
          <p className="text-muted-foreground mt-2">마감된 티켓을 조회할 수 있습니다</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard")} className="flex items-center gap-2">
          <Home className="h-4 w-4" />
          홈으로
        </Button>
      </div>

      {/* 검색 */}
      <Card>
        <CardHeader>
          <CardTitle>검색</CardTitle>
          <CardDescription>티켓 번호, 회원명, 키워드로 검색할 수 있습니다</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Select value={searchType} onValueChange={(value: any) => setSearchType(value)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keyword">키워드</SelectItem>
                <SelectItem value="member">회원명</SelectItem>
                <SelectItem value="ticket">티켓번호</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="검색어를 입력하세요"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              검색
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 티켓 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>마감된 티켓 목록</CardTitle>
          <CardDescription>총 {tasks.length}개의 마감된 티켓</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-gray-500">로딩 중...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">마감된 티켓이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>티켓번호</TableHead>
                    <TableHead>업무유형</TableHead>
                    <TableHead>회원</TableHead>
                    <TableHead>금액</TableHead>
                    <TableHead>마감일시</TableHead>
                    <TableHead>마감자</TableHead>
                    <TableHead className="text-center">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.ticket_no || "-"}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          {task.work_type || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {task.customer
                          ? `${task.customer.name} (${task.customer.member_number})`
                          : "미지정"}
                      </TableCell>
                      <TableCell>{formatNumber(task.total_amount)}P</TableCell>
                      <TableCell className="text-sm">{formatDate(task.closed_at)}</TableCell>
                      <TableCell>
                        {task.closed_by_user?.name || task.closed_by_user?.username || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTask(task)
                            setIsDialogOpen(true)
                          }}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          상세
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 상세보기 다이얼로그 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              티켓 상세 정보
            </DialogTitle>
            <DialogDescription>마감된 티켓의 상세 정보입니다</DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">티켓번호</Label>
                  <p className="mt-1 font-semibold">{selectedTask.ticket_no || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">업무유형</Label>
                  <p className="mt-1 font-semibold">{selectedTask.work_type || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">회원</Label>
                  <p className="mt-1">
                    {selectedTask.customer
                      ? `${selectedTask.customer.name} (${selectedTask.customer.member_number})`
                      : "미지정"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">금액</Label>
                  <p className="mt-1 font-semibold text-green-600">
                    {formatNumber(selectedTask.total_amount)}P
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">생성일시</Label>
                  <p className="mt-1 text-sm">{formatDate(selectedTask.created_at)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">마감일시</Label>
                  <p className="mt-1 text-sm">{formatDate(selectedTask.closed_at)}</p>
                </div>
              </div>

              {selectedTask.items && selectedTask.items.length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">아이템 목록</Label>
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>구분</TableHead>
                          <TableHead>내용</TableHead>
                          <TableHead className="text-right">금액</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedTask.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{getCategoryLabel(item.category || "")}</TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell className="text-right">{formatNumber(item.amount || 0)}P</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {selectedTask.description && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">설명</Label>
                  <p className="mt-1 text-sm whitespace-pre-wrap p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                    {selectedTask.description}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
