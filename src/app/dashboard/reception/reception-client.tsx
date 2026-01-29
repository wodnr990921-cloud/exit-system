"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Search, UserPlus, Loader2 } from "lucide-react"

interface Customer {
  id: string
  member_number: string
  name: string
  institution: string | null
  prison_number: string | null
}

export default function ReceptionClient() {
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  // 회원 선택
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState("")
  const [searchingCustomers, setSearchingCustomers] = useState(false)

  // 티켓 정보
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [workType, setWorkType] = useState<string>("")
  const [userId, setUserId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // 신규 회원 등록
  const [showNewMemberDialog, setShowNewMemberDialog] = useState(false)
  const [newMemberForm, setNewMemberForm] = useState({
    name: "",
    institution: "",
    prison_number: "",
    mailbox_address: "",
  })
  const [creatingMember, setCreatingMember] = useState(false)

  useEffect(() => {
    getCurrentUser()
  }, [])

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    } catch (error) {
      console.error("Error getting current user:", error)
    }
  }

  const searchCustomers = async (query: string) => {
    if (query.length < 2) {
      setCustomers([])
      return
    }

    setSearchingCustomers(true)
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, member_number, name, institution, prison_number")
        .or(`name.ilike.%${query}%,member_number.ilike.%${query}%`)
        .limit(10)

      if (error) throw error
      setCustomers(data || [])
    } catch (error: any) {
      console.error("Error searching customers:", error)
      toast({
        variant: "destructive",
        title: "검색 실패",
        description: error.message,
      })
    } finally {
      setSearchingCustomers(false)
    }
  }

  const handleCreateMember = async () => {
    if (!newMemberForm.name || !newMemberForm.institution) {
      toast({
        variant: "destructive",
        title: "오류",
        description: "이름과 시설명은 필수입니다.",
      })
      return
    }

    setCreatingMember(true)
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMemberForm.name,
          institution: newMemberForm.institution,
          prison_number: newMemberForm.prison_number || null,
          mailbox_address: newMemberForm.mailbox_address || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "회원 생성에 실패했습니다.")
      }

      const newCustomer: Customer = {
        id: data.customer.id,
        member_number: data.customer.member_number,
        name: data.customer.name,
        institution: data.customer.institution,
        prison_number: data.customer.prison_number,
      }

      setSelectedCustomer(newCustomer)
      setCustomerSearch(`${newCustomer.member_number} - ${newCustomer.name}`)
      setShowNewMemberDialog(false)
      setNewMemberForm({ name: "", institution: "", prison_number: "", mailbox_address: "" })

      toast({
        title: "성공",
        description: "새 회원이 등록되었습니다.",
      })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "오류",
        description: err.message,
      })
    } finally {
      setCreatingMember(false)
    }
  }

  const handleCreateTicket = async () => {
    if (!selectedCustomer) {
      toast({
        variant: "destructive",
        title: "오류",
        description: "회원을 선택해주세요.",
      })
      return
    }

    if (!title.trim()) {
      toast({
        variant: "destructive",
        title: "오류",
        description: "제목을 입력해주세요.",
      })
      return
    }

    if (!userId) {
      toast({
        variant: "destructive",
        title: "오류",
        description: "로그인이 필요합니다.",
      })
      return
    }

    setCreating(true)
    try {
      const response = await fetch("/api/tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: selectedCustomer.id,
          title: title.trim(),
          description: description.trim() || null,
          work_type: workType || null,
          items: [], // 빈 배열로 생성, 나중에 업무 처리에서 추가
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "티켓 생성에 실패했습니다.")
      }

      toast({
        title: "✅ 티켓 생성 완료",
        description: `티켓번호: ${data.ticket_no}`,
      })

      // Intake 페이지로 이동 (티켓 ID 전달)
      router.push(`/dashboard/intake?ticket=${data.task_id}`)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "티켓 생성 실패",
        description: error.message,
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            ← 뒤로가기
          </Button>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            신규 티켓 작성
          </h1>
        </div>

        {/* 메인 폼 */}
        <Card>
          <CardHeader>
            <CardTitle>티켓 기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 회원 검색 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">회원 선택</Label>
                {!selectedCustomer && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowNewMemberDialog(true)}
                    className="text-blue-600"
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    신규 회원 등록
                  </Button>
                )}
              </div>

              {!selectedCustomer ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="이름 또는 회원번호 입력..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value)
                        searchCustomers(e.target.value)
                      }}
                      className="pl-9"
                    />
                  </div>

                  {searchingCustomers && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  )}

                  {!searchingCustomers && customers.length > 0 && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 max-h-48 overflow-y-auto">
                      {customers.map((customer) => (
                        <button
                          key={customer.id}
                          onClick={() => {
                            setSelectedCustomer(customer)
                            setCustomerSearch(`${customer.member_number} - ${customer.name}`)
                            setCustomers([])
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="font-medium text-gray-900 dark:text-gray-50">
                            {customer.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {customer.member_number} · {customer.institution}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-blue-900 dark:text-blue-100">
                        {selectedCustomer.name}
                      </div>
                      <div className="text-sm text-blue-600 dark:text-blue-400">
                        {selectedCustomer.member_number} · {selectedCustomer.institution}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCustomer(null)
                        setCustomerSearch("")
                      }}
                    >
                      변경
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* 업무 유형 */}
            <div className="space-y-2">
              <Label>업무 유형</Label>
              <Select value={workType} onValueChange={setWorkType}>
                <SelectTrigger>
                  <SelectValue placeholder="업무 유형 선택 (선택사항)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="도서">도서</SelectItem>
                  <SelectItem value="경기">경기</SelectItem>
                  <SelectItem value="물품">물품</SelectItem>
                  <SelectItem value="문의">문의</SelectItem>
                  <SelectItem value="민원">민원</SelectItem>
                  <SelectItem value="기타">기타</SelectItem>
                  <SelectItem value="복합">복합</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 제목 */}
            <div className="space-y-2">
              <Label>제목 *</Label>
              <Input
                placeholder="티켓 제목을 입력하세요"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* 설명 */}
            <div className="space-y-2">
              <Label>내용</Label>
              <Textarea
                placeholder="티켓 내용을 입력하세요 (선택사항)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
              />
            </div>

            {/* 생성 버튼 */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleCreateTicket}
                disabled={creating || !selectedCustomer || !title.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                {creating ? "생성 중..." : "티켓 생성 및 업무 처리하기"}
              </Button>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              티켓 생성 후 상세 페이지에서 도서, 구매, 베팅 등의 업무를 처리할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 신규 회원 등록 다이얼로그 */}
      <Dialog open={showNewMemberDialog} onOpenChange={setShowNewMemberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>신규 회원 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>이름 *</Label>
              <Input
                placeholder="회원 이름"
                value={newMemberForm.name}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>시설명 *</Label>
              <Input
                placeholder="교정시설 이름"
                value={newMemberForm.institution}
                onChange={(e) =>
                  setNewMemberForm({ ...newMemberForm, institution: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>수번</Label>
              <Input
                placeholder="수용번호"
                value={newMemberForm.prison_number}
                onChange={(e) =>
                  setNewMemberForm({ ...newMemberForm, prison_number: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>우편함 주소</Label>
              <Input
                placeholder="우편함 번호"
                value={newMemberForm.mailbox_address}
                onChange={(e) =>
                  setNewMemberForm({ ...newMemberForm, mailbox_address: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewMemberDialog(false)}>
              취소
            </Button>
            <Button
              onClick={handleCreateMember}
              disabled={creatingMember || !newMemberForm.name || !newMemberForm.institution}
            >
              {creatingMember ? "등록 중..." : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
