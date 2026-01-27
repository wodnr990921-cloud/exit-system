"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, Trash2, CornerUpLeft, Home, UserPlus, X, CheckCircle2, Search, BookOpen, ShoppingCart, Trophy, Plus, Minus } from "lucide-react"
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
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    institution: "",
    prison_number: "",
    depositor_name: "",
    mailbox_address: "",
  })

  // 장바구니 기능 관련 state
  const [activeCartTab, setActiveCartTab] = useState("books")
  const [bookSearch, setBookSearch] = useState("")
  const [books, setBooks] = useState<any[]>([])
  const [searchingBooks, setSearchingBooks] = useState(false)
  const [selectedBooks, setSelectedBooks] = useState<any[]>([])
  const [purchaseItems, setPurchaseItems] = useState<Array<{description: string, amount: number}>>([{description: "", amount: 0}])
  const [otherInquiry, setOtherInquiry] = useState("")
  const [bettingData, setBettingData] = useState({
    match_id: "",
    match_name: "",
    betting_choice: "",
    betting_odds: 0,
    bet_amount: 0
  })

  // 회원번호 자동 생성
  const generateMemberNumber = async (): Promise<string> => {
    const today = new Date()
    const datePrefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
    
    const { data: existingMembers } = await supabase
      .from("customers")
      .select("member_number")
      .like("member_number", `${datePrefix}%`)
      .order("member_number", { ascending: false })
      .limit(1)

    if (existingMembers && existingMembers.length > 0) {
      const lastNumber = existingMembers[0].member_number
      const lastSequence = parseInt(lastNumber.slice(-3)) || 0
      const newSequence = lastSequence + 1
      return `${datePrefix}${String(newSequence).padStart(3, "0")}`
    } else {
      return `${datePrefix}001`
    }
  }

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

  // 도서 검색
  const searchBooks = async () => {
    if (!bookSearch.trim()) return
    
    setSearchingBooks(true)
    try {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .or(`title.ilike.%${bookSearch}%,author.ilike.%${bookSearch}%,publisher.ilike.%${bookSearch}%`)
        .limit(20)

      if (error) throw error
      setBooks(data || [])
    } catch (error: any) {
      console.error("도서 검색 오류:", error)
      setError("도서 검색 중 오류가 발생했습니다.")
    } finally {
      setSearchingBooks(false)
    }
  }

  // 도서 선택/해제
  const toggleBookSelection = (book: any) => {
    const isSelected = selectedBooks.some(b => b.id === book.id)
    if (isSelected) {
      setSelectedBooks(selectedBooks.filter(b => b.id !== book.id))
    } else {
      setSelectedBooks([...selectedBooks, book])
    }
  }

  // 구매 항목 추가
  const addPurchaseItem = () => {
    setPurchaseItems([...purchaseItems, { description: "", amount: 0 }])
  }

  // 구매 항목 제거
  const removePurchaseItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index))
  }

  // 구매 항목 변경
  const updatePurchaseItem = (index: number, field: "description" | "amount", value: string | number) => {
    const updated = [...purchaseItems]
    updated[index] = { ...updated[index], [field]: value }
    setPurchaseItems(updated)
  }

  // 신규 회원 등록 (개선 버전)
  const handleRegisterNewCustomer = async () => {
    // 필수 필드 검증
    if (!newCustomer.name.trim()) {
      setError("이름은 필수입니다.")
      return
    }

    if (!newCustomer.institution.trim()) {
      setError("수용기관은 필수입니다.")
      return
    }

    if (!newCustomer.prison_number.trim()) {
      setError("수용번호는 필수입니다.")
      return
    }

    try {
      // 회원번호 자동 생성
      const autoMemberNumber = await generateMemberNumber()

      const customerData = {
        member_number: autoMemberNumber,
        name: newCustomer.name.trim(),
        institution: newCustomer.institution.trim(),
        prison_number: newCustomer.prison_number.trim(),
        depositor_name: newCustomer.depositor_name.trim() || null,
        mailbox_address: newCustomer.mailbox_address.trim() || null,
        normal_points: 0,
        betting_points: 0,
        total_deposit: 0,
        total_usage: 0,
        total_betting: 0,
      }

      const { data: createdCustomer, error: customerError } = await supabase
        .from("customers")
        .insert([customerData])
        .select()
        .single()

      if (customerError) throw customerError

      setSelectedCustomer({
        id: createdCustomer.id,
        name: createdCustomer.name,
        member_number: createdCustomer.member_number,
      })

      setShowNewCustomerForm(false)
      setNewCustomer({
        name: "",
        institution: "",
        prison_number: "",
        depositor_name: "",
        mailbox_address: "",
      })
      setSearchQuery("")

      setSuccess(`${createdCustomer.name} (${autoMemberNumber}) 회원이 등록되었습니다.`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (error: any) {
      console.error("Register customer error:", error)
      setError(error.message || "회원 등록 중 오류가 발생했습니다.")
    }
  }

  // 신규 티켓 생성 (장바구니 기능 통합)
  const handleCreateTicket = async () => {
    if (!selectedCustomer) {
      setError("회원을 선택해주세요.")
      return
    }

    // 장바구니에 아무것도 없으면 에러
    const hasBooks = selectedBooks.length > 0
    const hasPurchase = purchaseItems.some(item => item.description.trim() && item.amount > 0)
    const hasBetting = bettingData.match_id && bettingData.bet_amount > 0
    const hasInquiry = otherInquiry.trim()
    const hasBasicInquiry = taskDescription.trim()

    if (!hasBooks && !hasPurchase && !hasBetting && !hasInquiry && !hasBasicInquiry) {
      setError("최소 하나의 항목을 추가해주세요.")
      return
    }

    setCreating(true)
    setError(null)

    try {
      // 총 금액 계산
      const booksTotal = selectedBooks.reduce((sum, book) => sum + (book.price || 0), 0)
      const purchaseTotal = purchaseItems.reduce((sum, item) => sum + (item.amount || 0), 0)
      const bettingTotal = bettingData.bet_amount || 0
      const basicAmount = parseFloat(taskAmount) || 0
      const totalAmount = booksTotal + purchaseTotal + bettingTotal + basicAmount

      // 1. Task 생성
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .insert({
          customer_id: selectedCustomer.id,
          member_id: selectedCustomer.id,
          status: "pending",
          total_amount: totalAmount,
          title: `[통합주문] ${selectedCustomer.name}`,
          description: `도서:${selectedBooks.length}, 구매:${purchaseItems.filter(i => i.description.trim()).length}, 배팅:${hasBetting ? 1 : 0}, 문의:${(hasInquiry || hasBasicInquiry) ? 1 : 0}`,
        })
        .select()
        .single()

      if (taskError) throw taskError

      const taskItems: any[] = []

      // 2. 도서 항목 추가 (category: "book" → 발주)
      for (const book of selectedBooks) {
        taskItems.push({
          task_id: taskData.id,
          category: "book",
          description: `${book.title} - ${book.author || ''} (${book.publisher || ''})`,
          amount: book.price || 0,
          status: "pending",
        })
      }

      // 3. 구매 항목 추가 (category: "product" → 발주)
      for (const item of purchaseItems) {
        if (item.description.trim() && item.amount > 0) {
          taskItems.push({
            task_id: taskData.id,
            category: "product",
            description: item.description.trim(),
            amount: item.amount,
            status: "pending",
          })
        }
      }

      // 4. 배팅 항목 추가 (category: "betting" → 배팅 업무)
      if (hasBetting) {
        taskItems.push({
          task_id: taskData.id,
          category: "betting",
          description: `${bettingData.match_name} - ${bettingData.betting_choice} (배당: ${bettingData.betting_odds})`,
          amount: bettingData.bet_amount,
          status: "pending",
          match_id: bettingData.match_id,
          betting_choice: bettingData.betting_choice,
          betting_odds: bettingData.betting_odds,
        })
      }

      // 5. 기타 문의 항목 추가 (category: "inquiry" → 문의답변)
      if (hasInquiry) {
        taskItems.push({
          task_id: taskData.id,
          category: "inquiry",
          description: otherInquiry.trim(),
          amount: 0,
          status: "pending",
        })
      }

      // 6. 기본 문의 항목 추가 (하위 호환성)
      if (hasBasicInquiry) {
        taskItems.push({
          task_id: taskData.id,
          category: taskCategory || "inquiry",
          description: taskDescription.trim(),
          amount: basicAmount,
          status: "pending",
        })
      }

      // Task Items 일괄 생성
      if (taskItems.length > 0) {
        const { error: itemError } = await supabase
          .from("task_items")
          .insert(taskItems)

        if (itemError) throw itemError
      }

      setSuccess("✅ 티켓이 생성되었습니다! 각 항목이 적절한 업무 탭으로 자동 분류되었습니다.")
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

  // Dialog 닫기 (장바구니 초기화 포함)
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
    setNewCustomer({
      name: "",
      institution: "",
      prison_number: "",
      depositor_name: "",
      mailbox_address: "",
    })
    // 장바구니 초기화
    setActiveCartTab("books")
    setBookSearch("")
    setBooks([])
    setSearchingBooks(false)
    setSelectedBooks([])
    setPurchaseItems([{description: "", amount: 0}])
    setOtherInquiry("")
    setBettingData({
      match_id: "",
      match_name: "",
      betting_choice: "",
      betting_odds: 0,
      bet_amount: 0
    })
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
            customer:customers(name, member_number, address)
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
            .recipient-address { font-size: 20px; font-weight: bold; margin-bottom: 20px; padding: 15px; background: white; border: 2px solid #333; border-radius: 4px; text-align: left; line-height: 1.6; }
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
              <div class="recipient-address">
                ${reply.task?.customer?.address || "주소 없음"} ${reply.task?.customer?.name || "미등록"}
              </div>
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
                    
                    <div className="text-xs text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/30 p-2 rounded border border-blue-200 dark:border-blue-800">
                      ℹ️ 회원번호는 자동으로 생성됩니다 (YYYYMMDD001)
                    </div>
                    
                    {/* 회원 정보 입력 폼 */}
                    <div>
                      <Label className="text-sm font-semibold">이름 *</Label>
                      <Input
                        value={newCustomer.name}
                        onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                        placeholder="홍길동"
                        className="mt-1"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-sm font-semibold">수용기관 *</Label>
                        <Input
                          value={newCustomer.institution}
                          onChange={(e) => setNewCustomer({ ...newCustomer, institution: e.target.value })}
                          placeholder="서울구치소"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold">수용번호 *</Label>
                        <Input
                          value={newCustomer.prison_number}
                          onChange={(e) => setNewCustomer({ ...newCustomer, prison_number: e.target.value })}
                          placeholder="2024-12345"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-sm font-semibold">입금자명</Label>
                        <Input
                          value={newCustomer.depositor_name}
                          onChange={(e) => setNewCustomer({ ...newCustomer, depositor_name: e.target.value })}
                          placeholder="홍길동"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold">사서함 주소</Label>
                        <Input
                          value={newCustomer.mailbox_address}
                          onChange={(e) => setNewCustomer({ ...newCustomer, mailbox_address: e.target.value })}
                          placeholder="남인천 333-333"
                          className="mt-1"
                        />
                      </div>
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

            {/* 장바구니 탭 */}
            <Tabs value={activeCartTab} onValueChange={setActiveCartTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="books" className="gap-1">
                  <BookOpen className="w-4 h-4" />
                  도서
                </TabsTrigger>
                <TabsTrigger value="purchase" className="gap-1">
                  <ShoppingCart className="w-4 h-4" />
                  구매
                </TabsTrigger>
                <TabsTrigger value="betting" className="gap-1">
                  <Trophy className="w-4 h-4" />
                  배팅
                </TabsTrigger>
                <TabsTrigger value="inquiry" className="gap-1">
                  <MessageSquare className="w-4 h-4" />
                  문의
                </TabsTrigger>
              </TabsList>

              {/* 도서 탭 */}
              <TabsContent value="books" className="space-y-3">
                <div className="space-y-2">
                  <Label>도서 검색</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="제목, 저자, 출판사로 검색"
                      value={bookSearch}
                      onChange={(e) => setBookSearch(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && searchBooks()}
                    />
                    <Button onClick={searchBooks} disabled={searchingBooks}>
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* 검색 결과 */}
                {books.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1 border rounded p-2">
                    {books.map((book) => (
                      <div
                        key={book.id}
                        onClick={() => toggleBookSelection(book)}
                        className={`p-2 rounded cursor-pointer text-sm ${
                          selectedBooks.some(b => b.id === book.id)
                            ? 'bg-blue-100 dark:bg-blue-900'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="font-semibold">{book.title}</div>
                        <div className="text-xs text-gray-500">{book.author} | {book.publisher} | {book.price}원</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 선택된 도서 */}
                {selectedBooks.length > 0 && (
                  <div className="space-y-2">
                    <Label>선택된 도서 ({selectedBooks.length}권)</Label>
                    <div className="space-y-1">
                      {selectedBooks.map((book) => (
                        <div key={book.id} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm">
                          <span>{book.title} - {book.price}원</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleBookSelection(book)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* 구매 탭 */}
              <TabsContent value="purchase" className="space-y-3">
                <Label>구매 항목</Label>
                {purchaseItems.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="상품명"
                      value={item.description}
                      onChange={(e) => updatePurchaseItem(index, "description", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="금액"
                      value={item.amount || ""}
                      onChange={(e) => updatePurchaseItem(index, "amount", parseInt(e.target.value) || 0)}
                      className="w-32"
                    />
                    {purchaseItems.length > 1 && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removePurchaseItem(index)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button onClick={addPurchaseItem} variant="outline" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  항목 추가
                </Button>
              </TabsContent>

              {/* 배팅 탭 */}
              <TabsContent value="betting" className="space-y-3">
                <div className="space-y-2">
                  <Label>경기 ID</Label>
                  <Input
                    placeholder="경기 ID"
                    value={bettingData.match_id}
                    onChange={(e) => setBettingData({ ...bettingData, match_id: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>경기명</Label>
                  <Input
                    placeholder="예: 맨시티 vs 첼시"
                    value={bettingData.match_name}
                    onChange={(e) => setBettingData({ ...bettingData, match_name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>배팅 선택</Label>
                    <Input
                      placeholder="예: 홈승"
                      value={bettingData.betting_choice}
                      onChange={(e) => setBettingData({ ...bettingData, betting_choice: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>배당률</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="1.85"
                      value={bettingData.betting_odds || ""}
                      onChange={(e) => setBettingData({ ...bettingData, betting_odds: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>배팅 금액</Label>
                  <Input
                    type="number"
                    placeholder="10000"
                    value={bettingData.bet_amount || ""}
                    onChange={(e) => setBettingData({ ...bettingData, bet_amount: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </TabsContent>

              {/* 문의 탭 */}
              <TabsContent value="inquiry" className="space-y-3">
                <Label>기타 문의 내용</Label>
                <Textarea
                  placeholder="문의 내용을 입력하세요"
                  value={otherInquiry}
                  onChange={(e) => setOtherInquiry(e.target.value)}
                  className="min-h-[120px]"
                />
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              📦 장바구니: 도서 {selectedBooks.length}권 | 구매 {purchaseItems.filter(i => i.description.trim()).length}건 | 
              배팅 {bettingData.match_id ? 1 : 0}건 | 문의 {otherInquiry.trim() ? 1 : 0}건
            </div>
            <div className="flex gap-2">
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
                disabled={!selectedCustomer || creating}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {creating ? "생성 중..." : "🛒 티켓 생성"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
