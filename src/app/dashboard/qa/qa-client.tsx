"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, Trash2, CornerUpLeft, Home, UserPlus, X, CheckCircle2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import dynamic from "next/dynamic"

// 동적 임포트 (기존 컴포넌트 재사용)
const IntakeContent = dynamic(() => import("../intake/intake-client"), {
  loading: () => <div className="p-6">내 작업 목록 로딩 중...</div>,
  ssr: false,
})

const DocumentRetentionContent = dynamic(() => import("../document-retention/document-retention-client"), {
  loading: () => <div className="p-6">원본 파기 로딩 중...</div>,
  ssr: false,
})

const ReturnsContent = dynamic(() => import("../returns/returns-client"), {
  loading: () => <div className="p-6">반송 처리 로딩 중...</div>,
  ssr: false,
})

interface Customer {
  id: string
  name: string
  member_number: string
}

export default function QAClient() {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState("intake")
  
  // 신규 티켓 생성 관련 state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [taskCategory, setTaskCategory] = useState<string>("문의")
  const [taskDescription, setTaskDescription] = useState("")
  const [taskAmount, setTaskAmount] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 신규 회원 등록 관련 state
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerMemberNumber, setNewCustomerMemberNumber] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const [newCustomerAddress, setNewCustomerAddress] = useState("")

  // 회원 검색
  const handleSearchCustomer = async (query: string) => {
    setSearchQuery(query)

    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }

    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, member_number")
        .or(`name.ilike.%${query}%,member_number.ilike.%${query}%`)
        .limit(10)

      if (error) throw error

      setSearchResults(data || [])
    } catch (error: any) {
      console.error("Error searching customers:", error)
      setSearchResults([])
    }
  }

  // 신규 회원 등록
  const handleRegisterNewCustomer = async () => {
    if (!newCustomerName.trim() || !newCustomerMemberNumber.trim()) {
      setError("이름과 회원번호는 필수입니다.")
      return
    }

    try {
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          name: newCustomerName.trim(),
          member_number: newCustomerMemberNumber.trim(),
          phone: newCustomerPhone.trim() || null,
          address: newCustomerAddress.trim() || null,
        })
        .select()
        .single()

      if (customerError) throw customerError

      setSelectedCustomer({
        id: newCustomer.id,
        name: newCustomer.name,
        member_number: newCustomer.member_number,
      })

      setShowNewCustomerForm(false)
      setNewCustomerName("")
      setNewCustomerMemberNumber("")
      setNewCustomerPhone("")
      setNewCustomerAddress("")
      setSearchQuery("")

      setSuccess(`${newCustomer.name} (${newCustomer.member_number}) 회원이 등록되었습니다.`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (error: any) {
      console.error("Register customer error:", error)
      setError(error.message || "회원 등록 중 오류가 발생했습니다.")
    }
  }

  // 신규 티켓 생성
  const handleCreateTicket = async () => {
    if (!selectedCustomer) {
      setError("회원을 선택해주세요.")
      return
    }

    if (!taskDescription.trim()) {
      setError("요청 내용을 입력해주세요.")
      return
    }

    const amount = parseFloat(taskAmount) || 0

    setCreating(true)
    setError(null)

    try {
      // 1. Task 생성
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .insert({
          customer_id: selectedCustomer.id,
          member_id: selectedCustomer.id,
          status: "pending",
          total_amount: amount,
          title: `[문의답변] ${taskCategory} - ${selectedCustomer.name}`,
        })
        .select()
        .single()

      if (taskError) throw taskError

      // 2. Task Item 생성
      const { error: itemError } = await supabase.from("task_items").insert({
        task_id: taskData.id,
        category: taskCategory,
        description: taskDescription.trim(),
        amount: amount,
        status: "pending",
      })

      if (itemError) throw itemError

      setSuccess("티켓이 생성되었습니다.")
      handleCloseDialog()

      setTimeout(() => {
        setSuccess(null)
        window.location.reload()
      }, 1500)
    } catch (error: any) {
      console.error("Create ticket error:", error)
      setError(error.message || "티켓 생성 중 오류가 발생했습니다.")
    } finally {
      setCreating(false)
    }
  }

  // Dialog 닫기
  const handleCloseDialog = () => {
    setShowCreateDialog(false)
    setSelectedCustomer(null)
    setSearchQuery("")
    setSearchResults([])
    setTaskCategory("문의")
    setTaskDescription("")
    setTaskAmount("")
    setError(null)
    setShowNewCustomerForm(false)
    setNewCustomerName("")
    setNewCustomerMemberNumber("")
    setNewCustomerPhone("")
    setNewCustomerAddress("")
  }

  // 답변 일괄 출력
  const handleBatchPrintReplies = async () => {
    try {
      const { data: replies, error } = await supabase
        .from("task_items")
        .select(`
          id,
          description,
          created_at,
          task:tasks!inner(
            ticket_no,
            customer:customers(name, member_number)
          )
        `)
        .eq("category", "답변")
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error

      if (!replies || replies.length === 0) {
        setError("출력할 답변이 없습니다.")
        setTimeout(() => setError(null), 3000)
        return
      }

      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        setError("팝업 차단을 해제해주세요.")
        setTimeout(() => setError(null), 3000)
        return
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>답변 일괄 출력</title>
          <style>
            @media print {
              @page { margin: 1cm; }
              .page-break { page-break-after: always; }
            }
            body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; }
            h1 { text-align: center; margin-bottom: 30px; }
            .reply-item { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
            .reply-header { font-weight: bold; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid #333; }
            .reply-content { line-height: 1.8; white-space: pre-wrap; }
            .reply-footer { margin-top: 10px; text-align: right; color: #666; font-size: 0.9em; }
          </style>
        </head>
        <body>
          <h1>📮 문의답변 일괄 출력</h1>
          ${replies
            .map(
              (reply: any, index: number) => `
            <div class="reply-item ${index < replies.length - 1 ? "page-break" : ""}">
              <div class="reply-header">
                티켓: ${reply.task?.ticket_no || "미지정"} | 
                회원: ${reply.task?.customer?.name || "미지정"} (${reply.task?.customer?.member_number || ""})
              </div>
              <div class="reply-content">${reply.description}</div>
              <div class="reply-footer">
                작성일시: ${new Date(reply.created_at).toLocaleString("ko-KR")}
              </div>
            </div>
          `
            )
            .join("")}
        </body>
        </html>
      `

      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
      }, 500)

      setSuccess(`${replies.length}개의 답변을 출력 중입니다.`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (error: any) {
      console.error("Batch print error:", error)
      setError(error.message || "답변 출력 중 오류가 발생했습니다.")
      setTimeout(() => setError(null), 3000)
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-blue-600" />
            문의/답변
          </h1>
          <p className="text-muted-foreground mt-2">
            작업 목록, 원본 파기, 반송 처리를 한 곳에서 관리합니다
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-medium"
          >
            + 신규 티켓 생성
          </Button>
          <Button
            variant="outline"
            onClick={handleBatchPrintReplies}
            className="border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 font-medium"
          >
            답변 일괄 출력
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-medium"
          >
            <Home className="h-4 w-4" />
            홈으로
          </Button>
        </div>
      </div>

      {/* 알림 메시지 */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-md">
          {success}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="intake" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">내 작업 목록</span>
            <span className="sm:hidden">작업</span>
          </TabsTrigger>
          <TabsTrigger value="document" className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">원본 파기</span>
            <span className="sm:hidden">파기</span>
          </TabsTrigger>
          <TabsTrigger value="returns" className="flex items-center gap-2">
            <CornerUpLeft className="h-4 w-4" />
            <span className="hidden sm:inline">반송 처리</span>
            <span className="sm:hidden">반송</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="intake" className="space-y-6">
          <Card>
            <IntakeContent />
          </Card>
        </TabsContent>

        <TabsContent value="document" className="space-y-6">
          <Card>
            <DocumentRetentionContent />
          </Card>
        </TabsContent>

        <TabsContent value="returns" className="space-y-6">
          <Card>
            <ReturnsContent />
          </Card>
        </TabsContent>
      </Tabs>

      {/* 댓글(내부) vs 답글(회원) 구분 안내 */}
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-100 text-sm">
            💡 댓글과 답글 구분
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p>
            <strong>댓글 (Comment):</strong> 내부 직원 간 소통용 - 회원에게 보이지 않음
          </p>
          <p>
            <strong>답글 (Reply):</strong> 회원에게 발송되는 공식 답변
          </p>
        </CardContent>
      </Card>

      {/* 신규 티켓 생성 Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>신규 티켓 생성</DialogTitle>
            <DialogDescription>
              문의답변 티켓을 새로 생성합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 회원 검색 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
                  <Label htmlFor="customer-search" className="font-bold text-gray-900 dark:text-gray-100">👤 회원 검색</Label>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
                  className="h-7 text-xs text-gray-900 dark:text-gray-100 hover:text-blue-700 hover:bg-blue-50 font-medium"
                >
                  <UserPlus className="w-3 h-3 mr-1" />
                  신규 회원 등록
                </Button>
              </div>
              <Input
                id="customer-search"
                placeholder="회원명 또는 회원번호 입력"
                value={searchQuery}
                onChange={(e) => handleSearchCustomer(e.target.value)}
                className="border-gray-300 dark:border-gray-700"
              />
              
              {/* 검색 결과 */}
              {searchResults.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-md max-h-[200px] overflow-y-auto">
                  {searchResults.map((customer) => (
                    <div
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomer(customer)
                        setSearchQuery(customer.name)
                        setSearchResults([])
                      }}
                      className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0"
                    >
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {customer.member_number}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 선택된 회원 */}
              {selectedCustomer && searchResults.length === 0 && (
                <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-blue-900 dark:text-blue-100">
                        {selectedCustomer.name}
                      </div>
                      <div className="text-sm text-blue-700 dark:text-blue-300">
                        {selectedCustomer.member_number}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCustomer(null)
                        setSearchQuery("")
                      }}
                      className="text-blue-600 dark:text-blue-400"
                    >
                      변경
                    </Button>
                  </div>
                </div>
              )}

              {/* 신규 회원 등록 폼 */}
              {showNewCustomerForm && (
                <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-900/20">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-green-900 dark:text-green-100">
                        ✨ 신규 회원 등록
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowNewCustomerForm(false)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div>
                      <Label className="text-sm">이름 *</Label>
                      <Input
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        placeholder="홍길동"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-sm">회원번호 *</Label>
                      <Input
                        value={newCustomerMemberNumber}
                        onChange={(e) => setNewCustomerMemberNumber(e.target.value)}
                        placeholder="M001"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-sm">전화번호</Label>
                      <Input
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        placeholder="010-1234-5678"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-sm">주소</Label>
                      <Input
                        value={newCustomerAddress}
                        onChange={(e) => setNewCustomerAddress(e.target.value)}
                        placeholder="서울시..."
                        className="mt-1"
                      />
                    </div>
                    
                    <Button
                      onClick={handleRegisterNewCustomer}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      회원 등록 및 선택
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* 카테고리 선택 */}
            <div className="space-y-2">
              <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
                <Label htmlFor="category" className="font-bold text-gray-900 dark:text-gray-100">📂 카테고리</Label>
              </div>
              <Select value={taskCategory} onValueChange={setTaskCategory}>
                <SelectTrigger className="border-gray-300 dark:border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="문의">문의</SelectItem>
                  <SelectItem value="입금">입금</SelectItem>
                  <SelectItem value="출금">출금</SelectItem>
                  <SelectItem value="환불">환불</SelectItem>
                  <SelectItem value="상품">상품</SelectItem>
                  <SelectItem value="배팅">배팅</SelectItem>
                  <SelectItem value="기타">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 요청 내용 */}
            <div className="space-y-2">
              <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
                <Label htmlFor="description" className="font-bold text-gray-900 dark:text-gray-100">📝 요청 내용</Label>
              </div>
              <Textarea
                id="description"
                placeholder="티켓 내용을 입력하세요"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                className="min-h-[120px] border-gray-300 dark:border-gray-700"
              />
            </div>

            {/* 금액 */}
            <div className="space-y-2">
              <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
                <Label htmlFor="amount" className="font-bold text-gray-900 dark:text-gray-100">💰 금액 (선택)</Label>
              </div>
              <Input
                id="amount"
                type="number"
                placeholder="0"
                value={taskAmount}
                onChange={(e) => setTaskAmount(e.target.value)}
                className="border-gray-300 dark:border-gray-700"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              disabled={creating}
              className="border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 font-medium"
            >
              취소
            </Button>
            <Button
              onClick={handleCreateTicket}
              disabled={!selectedCustomer || !taskDescription.trim() || creating}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {creating ? "생성 중..." : "티켓 생성"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
