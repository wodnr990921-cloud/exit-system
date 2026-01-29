"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Mail,
  Search,
  AlertCircle,
  Loader2,
  RotateCw,
  Home,
  User,
  UserPlus,
  MessageSquare,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"

interface Letter {
  id: string
  file_path: string
  file_url: string
  ocr_text: string | null
  ocr_summary?: string | null
  status: string
  created_at: string
  ocr_confidence?: number
  ocr_image_type?: string
  ocr_prohibited_content?: any
}

interface Customer {
  id: string
  member_number: string
  name: string
  institution: string | null
  prison_number: string | null
}

interface User {
  id: string
  name: string | null
  username: string
  role: string
}

export default function MailroomClient() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const transformRef = useRef<any>(null)

  // 편지 관리
  const [letters, setLetters] = useState<Letter[]>([])
  const [selectedLetters, setSelectedLetters] = useState<Letter[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [rotation, setRotation] = useState(0)

  // 회원 관리
  const [customerSearch, setCustomerSearch] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchingCustomers, setSearchingCustomers] = useState(false)

  // 담당자 관리
  const [staff, setStaff] = useState<User[]>([])
  const [selectedStaff, setSelectedStaff] = useState<string>("")

  // 티켓 정보
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [workType, setWorkType] = useState<string>("")
  const [creating, setCreating] = useState(false)

  // 신규 회원 등록
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: "",
    institution: "",
    prison_number: "",
    mailbox_address: "",
  })
  const [creatingCustomer, setCreatingCustomer] = useState(false)

  useEffect(() => {
    loadLetters()
    loadStaff()
  }, [])

  const loadLetters = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("letters")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error
      setLetters(data || [])
    } catch (error: any) {
      console.error("Error loading letters:", error)
      toast({
        variant: "destructive",
        title: "오류",
        description: "편지 목록을 불러오는데 실패했습니다.",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadStaff = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, username, role")
        .eq("is_approved", true)
        .order("name", { ascending: true })

      if (error) throw error
      setStaff(data || [])
    } catch (error: any) {
      console.error("Error loading staff:", error)
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
    } finally {
      setSearchingCustomers(false)
    }
  }

  const handleCreateCustomer = async () => {
    if (!newCustomerForm.name || !newCustomerForm.institution) {
      toast({
        variant: "destructive",
        title: "오류",
        description: "이름과 시설명은 필수입니다.",
      })
      return
    }

    setCreatingCustomer(true)
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustomerForm.name,
          institution: newCustomerForm.institution,
          prison_number: newCustomerForm.prison_number || null,
          mailbox_address: newCustomerForm.mailbox_address || null,
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
      setShowNewCustomerForm(false)
      setNewCustomerForm({ name: "", institution: "", prison_number: "", mailbox_address: "" })

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
      setCreatingCustomer(false)
    }
  }

  const handleLetterSelect = (letter: Letter) => {
    if (selectedLetters.find((l) => l.id === letter.id)) {
      setSelectedLetters(selectedLetters.filter((l) => l.id !== letter.id))
    } else {
      setSelectedLetters([...selectedLetters, letter])
    }
  }

  const handleAssign = () => {
    if (selectedLetters.length === 0) {
      toast({
        variant: "destructive",
        title: "오류",
        description: "편지를 선택해주세요.",
      })
      return
    }

    // OCR 요약에서 제목 자동 생성
    const firstLetter = selectedLetters[0]
    if (firstLetter.ocr_summary) {
      setTitle(firstLetter.ocr_summary.substring(0, 100))
    } else if (firstLetter.ocr_text) {
      setTitle(firstLetter.ocr_text.substring(0, 100))
    }

    // 여러 편지의 OCR 내용 결합
    const combinedOcr = selectedLetters
      .map((letter, index) => {
        const summary = letter.ocr_summary || letter.ocr_text || ""
        return `[편지 ${index + 1}]\n${summary}`
      })
      .join("\n\n")
    setDescription(combinedOcr)

    setShowDialog(true)
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

    setCreating(true)
    try {
      // 티켓 생성
      const response = await fetch("/api/tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: selectedCustomer.id,
          title: title.trim(),
          description: description.trim() || null,
          work_type: workType || null,
          assigned_to: selectedStaff || null,
          items: [],
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "티켓 생성에 실패했습니다.")
      }

      // 편지 상태 업데이트 (pending → assigned)
      const letterIds = selectedLetters.map((l) => l.id)
      await supabase
        .from("letters")
        .update({
          status: "assigned",
          task_id: data.task_id,
        })
        .in("id", letterIds)

      toast({
        title: "✅ 티켓 생성 완료",
        description: `티켓번호: ${data.ticket_no}`,
      })

      // Intake 페이지로 이동
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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
              <Home className="w-4 h-4 mr-1" />
              홈
            </Button>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
              <Mail className="w-6 h-6" />
              우편실 - 편지 배정
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              미처리 {letters.length}건
            </Badge>
            {selectedLetters.length > 0 && (
              <Badge className="bg-blue-600 text-sm">
                선택됨 {selectedLetters.length}건
              </Badge>
            )}
          </div>
        </div>

        {/* 편지 목록 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">📮 미처리 편지</h2>
              <Button onClick={loadLetters} variant="outline" size="sm">
                <RotateCw className="w-4 h-4 mr-1" />
                새로고침
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : letters.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                미처리 편지가 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {letters.map((letter) => (
                  <Card
                    key={letter.id}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      selectedLetters.find((l) => l.id === letter.id)
                        ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : ""
                    }`}
                    onClick={() => handleLetterSelect(letter)}
                  >
                    <CardContent className="p-4">
                      <img
                        src={letter.file_url}
                        alt="Letter"
                        className="w-full h-32 object-cover rounded mb-2"
                      />
                      <div className="text-xs text-gray-500 mb-1">
                        {new Date(letter.created_at).toLocaleDateString("ko-KR")}
                      </div>
                      {letter.ocr_summary && (
                        <div className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
                          {letter.ocr_summary}
                        </div>
                      )}
                      {letter.ocr_prohibited_content?.found && (
                        <Badge variant="destructive" className="mt-2 text-xs">
                          ⚠️ 금지어 감지
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {selectedLetters.length > 0 && (
              <div className="mt-6 flex justify-end">
                <Button onClick={handleAssign} className="bg-blue-600 hover:bg-blue-700">
                  선택한 편지 배정하기 ({selectedLetters.length}건)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 배정 다이얼로그 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-7xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              편지 배정
              {selectedLetters.length > 0 && (
                <Badge className="bg-blue-600">
                  {selectedLetters.length}개 편지
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 flex-1 overflow-hidden px-6 py-4">
            {/* Left: 이미지 */}
            <div className="flex flex-col space-y-3 h-full overflow-hidden">
              {selectedLetters.length === 1 ? (
                <Card className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900">
                  <CardContent className="p-2 h-full flex items-center justify-center">
                    <TransformWrapper
                      ref={transformRef}
                      initialScale={0.25}
                      minScale={0.1}
                      maxScale={5}
                      centerOnInit
                      wheel={{ step: 0.1 }}
                    >
                      <TransformComponent
                        wrapperClass="w-full h-full"
                        contentClass="w-full h-full flex items-center justify-center"
                      >
                        <img
                          src={selectedLetters[0].file_url}
                          alt="Letter"
                          className="object-contain"
                          style={{
                            transform: `rotate(${rotation}deg)`,
                            transition: "transform 0.3s ease",
                            maxWidth: "100%",
                            maxHeight: "100%",
                          }}
                        />
                      </TransformComponent>
                    </TransformWrapper>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {selectedLetters.map((letter, index) => (
                    <Card key={letter.id}>
                      <CardContent className="p-2 flex items-start gap-3">
                        <Badge className="bg-blue-600 text-xs">
                          편지 {index + 1}
                        </Badge>
                        <img
                          src={letter.file_url}
                          alt={`Letter ${index + 1}`}
                          className="w-16 h-16 object-contain rounded"
                        />
                        {letter.ocr_summary && (
                          <div className="flex-1 text-xs text-gray-600 dark:text-gray-400 line-clamp-3">
                            {letter.ocr_summary}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* 이미지 컨트롤 (단일 편지만) */}
              {selectedLetters.length === 1 && (
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRotation((r) => r - 90)}
                  >
                    <RotateCw className="w-4 h-4 rotate-180" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRotation((r) => r + 90)}
                  >
                    <RotateCw className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Right: 폼 */}
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {/* OCR 결과 */}
                {selectedLetters.some((l) => l.ocr_text) && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-bold mb-3 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        OCR 추출 내용
                      </h4>
                      <div className="text-sm text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto space-y-2">
                        {selectedLetters.map((letter, index) => (
                          letter.ocr_text && (
                            <div key={letter.id} className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-xs">
                              <Badge variant="outline" className="mb-1">
                                편지 {index + 1}
                              </Badge>
                              <div>{letter.ocr_text.substring(0, 200)}...</div>
                            </div>
                          )
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 금지어 경고 */}
                {selectedLetters.some((l) => l.ocr_prohibited_content?.found) && (
                  <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-bold text-red-900 dark:text-red-100 mb-2">
                            ⚠️ 금지어 감지됨
                          </h4>
                          {selectedLetters.map((letter, index) => (
                            letter.ocr_prohibited_content?.found && (
                              <div key={letter.id} className="mb-2">
                                <Badge variant="outline" className="mb-1">
                                  편지 {index + 1}
                                </Badge>
                                <div className="text-xs text-red-600">
                                  {letter.ocr_prohibited_content.matches
                                    ?.slice(0, 3)
                                    .map((m: any, i: number) => (
                                      <div key={i}>• {m.description}</div>
                                    ))}
                                </div>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 회원 검색 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <User className="w-4 h-4" />
                      회원 선택
                    </Label>
                    {!selectedCustomer && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowNewCustomerForm(true)}
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
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y max-h-48 overflow-y-auto">
                          {customers.map((customer) => (
                            <button
                              key={customer.id}
                              onClick={() => {
                                setSelectedCustomer(customer)
                                setCustomerSearch(`${customer.member_number} - ${customer.name}`)
                                setCustomers([])
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                              <div className="font-medium">{customer.name}</div>
                              <div className="text-sm text-gray-500">
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

                {/* 담당자 선택 */}
                <div className="space-y-2">
                  <Label>담당자 배정 (선택사항)</Label>
                  <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                    <SelectTrigger>
                      <SelectValue placeholder="담당자 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.filter(s => s.id && s.id.trim() !== '').map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name || s.username} ({s.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    placeholder="티켓 제목"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {/* 설명 */}
                <div className="space-y-2">
                  <Label>내용</Label>
                  <Textarea
                    placeholder="티켓 내용"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                  />
                </div>
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                  className="flex-1"
                >
                  취소
                </Button>
                <Button
                  onClick={handleCreateTicket}
                  disabled={creating || !selectedCustomer || !title.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {creating ? "생성 중..." : "티켓 생성 및 업무 처리하기"}
                </Button>
              </div>

              <p className="text-xs text-gray-500 text-center mt-2">
                티켓 생성 후 상세 페이지에서 도서, 구매, 베팅 등의 업무를 처리할 수 있습니다.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 신규 회원 등록 다이얼로그 */}
      <Dialog open={showNewCustomerForm} onOpenChange={setShowNewCustomerForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>신규 회원 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>이름 *</Label>
              <Input
                placeholder="회원 이름"
                value={newCustomerForm.name}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>시설명 *</Label>
              <Input
                placeholder="교정시설 이름"
                value={newCustomerForm.institution}
                onChange={(e) =>
                  setNewCustomerForm({ ...newCustomerForm, institution: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>수번</Label>
              <Input
                placeholder="수용번호"
                value={newCustomerForm.prison_number}
                onChange={(e) =>
                  setNewCustomerForm({ ...newCustomerForm, prison_number: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>우편함 주소</Label>
              <Input
                placeholder="우편함 번호"
                value={newCustomerForm.mailbox_address}
                onChange={(e) =>
                  setNewCustomerForm({ ...newCustomerForm, mailbox_address: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCustomerForm(false)}>
              취소
            </Button>
            <Button
              onClick={handleCreateCustomer}
              disabled={creatingCustomer || !newCustomerForm.name || !newCustomerForm.institution}
            >
              {creatingCustomer ? "등록 중..." : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
