"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Customer {
  id: string
  member_number: string
  name: string
  institution: string | null
  prison_number: string | null
}

interface CartItem {
  id: string // 임시 ID
  category: "book" | "game" | "goods" | "inquiry" | "complaint" | "other" | "complex"
  description: string
  amount: number
}

export default function ReceptionClient() {
  const router = useRouter()
  const supabase = createClient()

  // 회원 선택
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState("")
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)

  // 아이템 추가 폼
  const [itemCategory, setItemCategory] = useState<"book" | "game" | "goods" | "inquiry" | "complaint" | "other" | "complex">("book")
  const [itemDescription, setItemDescription] = useState("")
  const [itemAmount, setItemAmount] = useState("")

  // 장바구니
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  // 업무 유형 선택
  const [workType, setWorkType] = useState<string>("")

  // 티켓 생성
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [createdTicketNo, setCreatedTicketNo] = useState<string | null>(null)

  // 편지 이미지 및 OCR
  const [letterImage, setLetterImage] = useState<File | null>(null)
  const [letterImageUrl, setLetterImageUrl] = useState<string | null>(null)
  const [letterSummary, setLetterSummary] = useState<string>("")
  const [processingOCR, setProcessingOCR] = useState(false)
  const [ocrData, setOcrData] = useState<any>(null)
  const [showImageDialog, setShowImageDialog] = useState(false)
  const [mounted, setMounted] = useState(false)

  // 신규 회원 등록 다이얼로그
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
    loadCustomers()
  }, [])

  const getCurrentUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    } catch (error) {
      console.error("Error getting current user:", error)
    }
  }

  const loadCustomers = async () => {
    setLoadingCustomers(true)
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, member_number, name, institution, prison_number")
        .order("name", { ascending: true })
        .limit(100)

      if (error) throw error
      setCustomers(data || [])
    } catch (error: any) {
      console.error("Error loading customers:", error)
    } finally {
      setLoadingCustomers(false)
    }
  }

  const handleCustomerSearch = () => {
    if (!customerSearch.trim()) {
      setSearchResults([])
      setShowSearchResults(false)
      setSelectedCustomer(null)
      return
    }

    const filtered = customers.filter(
      (c) =>
        c.member_number.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.institution && c.institution.toLowerCase().includes(customerSearch.toLowerCase())) ||
        (c.prison_number && c.prison_number.toLowerCase().includes(customerSearch.toLowerCase()))
    )

    setSearchResults(filtered)
    setShowSearchResults(true)
  }

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setCustomerSearch(customer.institution && customer.prison_number 
      ? `${customer.institution} ${customer.prison_number} ${customer.name}`
      : `${customer.member_number} - ${customer.name}`)
    setShowSearchResults(false)
    setSearchResults([])
  }

  // 신규 회원 등록
  const handleCreateNewMember = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMemberForm.name.trim()) {
      setError("이름을 입력하세요.")
      return
    }

    try {
      setCreatingMember(true)
      setError(null)

      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMemberForm.name.trim(),
          institution: newMemberForm.institution.trim() || null,
          prison_number: newMemberForm.prison_number.trim() || null,
          mailbox_address: newMemberForm.mailbox_address.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "회원 등록에 실패했습니다.")
      }

      // 새로 생성된 회원 선택
      const newCustomer: Customer = {
        id: data.customer.id,
        member_number: data.customer.member_number,
        name: data.customer.name,
        institution: data.customer.institution,
        prison_number: data.customer.prison_number,
      }

      setSelectedCustomer(newCustomer)
      setCustomerSearch(newCustomer.institution && newCustomer.prison_number 
        ? `${newCustomer.institution} ${newCustomer.prison_number} ${newCustomer.name}`
        : `${newCustomer.member_number} - ${newCustomer.name}`)
      
      // 회원 목록 새로고침
      await loadCustomers()
      
      // 다이얼로그 닫기
      setShowNewMemberDialog(false)
      setNewMemberForm({ name: "", institution: "", prison_number: "", mailbox_address: "" })
      
      setSuccess("새 회원이 등록되었습니다.")
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreatingMember(false)
    }
  }

  // 이미지 리사이징 및 압축 함수
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          // 최대 크기 계산 (긴 축 기준 1024px)
          const maxDimension = 1024
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > maxDimension) {
              height = (height * maxDimension) / width
              width = maxDimension
            }
          } else {
            if (height > maxDimension) {
              width = (width * maxDimension) / height
              height = maxDimension
            }
          }

          // Canvas로 리사이징
          const canvas = document.createElement("canvas")
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            reject(new Error("Canvas context를 가져올 수 없습니다."))
            return
          }

          ctx.drawImage(img, 0, 0, width, height)

          // JPEG로 변환 (Quality 0.8)
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("이미지 압축에 실패했습니다."))
                return
              }
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              })
              resolve(compressedFile)
            },
            "image/jpeg",
            0.8
          )
        }
        img.onerror = () => reject(new Error("이미지를 로드할 수 없습니다."))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."))
      reader.readAsDataURL(file)
    })
  }

  const handleLetterImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const originalFile = e.target.files[0]
      
      try {
        // 이미지 압축
        const compressedFile = await compressImage(originalFile)
        setLetterImage(compressedFile)
        
        // 이미지 미리보기 (압축된 이미지 사용)
        const reader = new FileReader()
        reader.onloadend = () => {
          setLetterImageUrl(reader.result as string)
        }
        reader.readAsDataURL(compressedFile)

        // OCR 처리
        setProcessingOCR(true)
        setError(null)
        try {
          const formData = new FormData()
          formData.append("image", compressedFile)

          const response = await fetch("/api/ocr", {
            method: "POST",
            body: formData,
          })

          let result: any = {}
          try {
            const text = await response.text()
            try {
              result = JSON.parse(text)
            } catch (parseError) {
              // JSON이 아닌 경우 텍스트 그대로 사용
              throw new Error(text || "서버 응답을 파싱할 수 없습니다.")
            }
          } catch (jsonError: any) {
            console.error("Failed to parse response:", jsonError)
            throw new Error(jsonError.message || "서버 응답을 파싱할 수 없습니다.")
          }

          if (!response.ok) {
            console.error("OCR API Error:", result)
            // 다양한 에러 메시지 형식 지원
            const errorMsg = 
              result?.error || 
              result?.details?.error?.message ||
              result?.details?.message ||
              (typeof result?.details === "string" ? result.details : "OCR 처리에 실패했습니다.")
            throw new Error(errorMsg)
          }

          if (result.success && result.data) {
            setOcrData(result.data)
            
            // OCR 결과를 요약 API로 전달하여 요약 생성
            if (result.data.request_content) {
              try {
                const summaryResponse = await fetch("/api/summarize", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text: result.data.request_content }),
                })
                const summaryResult = await summaryResponse.json()
                if (summaryResult.success) {
                  setLetterSummary(summaryResult.summary)
                } else {
                  setLetterSummary(result.data.request_content)
                }
              } catch (error) {
                console.error("Error generating summary:", error)
                setLetterSummary(result.data.request_content)
              }
            } else {
              setLetterSummary("")
            }
          } else {
            setError("OCR 결과를 받을 수 없습니다.")
          }
        } catch (error: any) {
          console.error("OCR processing error:", error)
          const errorMessage = error.message || error.toString() || "OCR 처리 중 오류가 발생했습니다."
          setError(errorMessage)
        } finally {
          setProcessingOCR(false)
        }
      } catch (compressionError: any) {
        console.error("Image compression error:", compressionError)
        setError("이미지 압축 중 오류가 발생했습니다: " + compressionError.message)
        setProcessingOCR(false)
      }
    }
  }

  const handleAddToCart = () => {
    if (!itemDescription.trim()) {
      setError("내용을 입력해주세요.")
      return
    }

    const amount = itemAmount ? parseInt(itemAmount) : 0

    const newItem: CartItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      category: itemCategory,
      description: itemDescription.trim(),
      amount: amount,
    }

    setCartItems([...cartItems, newItem])
    setItemDescription("")
    setItemAmount("")
    setError(null)
  }

  const handleRemoveFromCart = (itemId: string) => {
    setCartItems(cartItems.filter((item) => item.id !== itemId))
  }

  const handleCreateTicket = async () => {
    if (cartItems.length === 0) {
      setError("장바구니에 아이템이 없습니다.")
      return
    }

    if (!userId) {
      setError("로그인이 필요합니다.")
      return
    }

    setCreating(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: selectedCustomer?.id || null,
          work_type: workType || null, // 선택한 업무 유형
          items: cartItems.map((item) => ({
            category: item.category,
            description: item.description,
            amount: item.amount,
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "티켓 생성에 실패했습니다.")
      }

      setSuccess(data.message || "티켓이 성공적으로 생성되었습니다.")
      setCreatedTicketNo(data.ticket_no)
      setCartItems([])
      setWorkType("")
      setSelectedCustomer(null)
      setCustomerSearch("")

      setTimeout(() => {
        setSuccess(null)
        setCreatedTicketNo(null)
      }, 5000)
    } catch (error: any) {
      setError(error.message || "티켓 생성에 실패했습니다.")
    } finally {
      setCreating(false)
    }
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

  const totalAmount = cartItems.reduce((sum, item) => sum + item.amount, 0)

  const formatNumber = (num: number) => {
    return num.toLocaleString("ko-KR")
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.back()} className="border-gray-300 dark:border-gray-700">
              ← 뒤로가기
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")} className="border-gray-300 dark:border-gray-700">
              홈
            </Button>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">티켓 접수</h1>
          </div>
        </div>

        {/* 알림 메시지 */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-md">
            {success}
            {createdTicketNo && (
              <div className="mt-2 font-semibold">
                티켓번호: <span className="font-mono">{createdTicketNo}</span>
              </div>
            )}
          </div>
        )}

        {/* 상단: 편지 사진/요약 */}
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">편지 정보</CardTitle>
            <CardDescription>편지 사진을 업로드하고 요약을 확인하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLetterImageChange}
                  className="hidden"
                  id="letter-image-upload"
                />
                <label
                  htmlFor="letter-image-upload"
                  className="cursor-pointer inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                >
                  이미지 업로드
                </label>
              </div>
              {processingOCR && (
                <div className="text-sm text-gray-600 dark:text-gray-400">OCR 처리 중...</div>
              )}
              {letterImageUrl && (
                <div className="space-y-4">
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900 inline-block">
                    <img
                      src={letterImageUrl}
                      alt="편지 이미지"
                      onClick={() => setShowImageDialog(true)}
                      className="max-w-[200px] h-auto rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  </div>
                  {letterSummary && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">편지 요약</div>
                      <p className="text-sm text-gray-900 dark:text-gray-50 whitespace-pre-wrap">{letterSummary}</p>
                    </div>
                  )}
                  {ocrData && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">추출된 정보</div>
                      <div className="text-sm space-y-1">
                        {ocrData.customer_name && (
                          <p><strong>회원명:</strong> {ocrData.customer_name}</p>
                        )}
                        {ocrData.amount > 0 && (
                          <p><strong>금액:</strong> {formatNumber(ocrData.amount)}원</p>
                        )}
                        {ocrData.point_category && (
                          <p><strong>포인트 종류:</strong> {ocrData.point_category}</p>
                        )}
                        {ocrData.work_type && (
                          <p><strong>업무 구분:</strong> {ocrData.work_type}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 이미지 확대 Dialog */}
        <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>편지 이미지</DialogTitle>
            </DialogHeader>
            {letterImageUrl && (
              <div className="flex justify-center">
                <img
                  src={letterImageUrl}
                  alt="편지 이미지 확대"
                  className="max-w-full h-auto rounded-md"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* 신규 회원 등록 Dialog */}
        <Dialog open={showNewMemberDialog} onOpenChange={setShowNewMemberDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>신규 회원 등록</DialogTitle>
              <DialogDescription>새로운 회원 정보를 입력하세요.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateNewMember}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="new-name">이름 *</Label>
                  <Input
                    id="new-name"
                    value={newMemberForm.name}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
                    placeholder="회원 이름을 입력하세요"
                    disabled={creatingMember}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-institution">수용 기관</Label>
                  <Input
                    id="new-institution"
                    value={newMemberForm.institution}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, institution: e.target.value })}
                    placeholder="예: 서울구치소"
                    disabled={creatingMember}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-prison-number">수용 번호</Label>
                  <Input
                    id="new-prison-number"
                    value={newMemberForm.prison_number}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, prison_number: e.target.value })}
                    placeholder="수용 번호를 입력하세요"
                    disabled={creatingMember}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-mailbox">사서함 주소</Label>
                  <Input
                    id="new-mailbox"
                    value={newMemberForm.mailbox_address}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, mailbox_address: e.target.value })}
                    placeholder="사서함 주소를 입력하세요"
                    disabled={creatingMember}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowNewMemberDialog(false)
                    setNewMemberForm({ name: "", institution: "", prison_number: "", mailbox_address: "" })
                  }}
                  disabled={creatingMember}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={creatingMember || !newMemberForm.name.trim()}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {creatingMember ? "등록 중..." : "등록"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* 회원 선택 */}
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">회원 선택</CardTitle>
            <CardDescription>회원을 검색하고 선택하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="flex gap-2">
                <Input
                  placeholder="회원번호, 이름, 수용기관, 수용번호로 검색"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value)
                    if (e.target.value.trim()) {
                      handleCustomerSearch()
                    } else {
                      setShowSearchResults(false)
                      setSearchResults([])
                    }
                  }}
                  onKeyPress={(e) => e.key === "Enter" && handleCustomerSearch()}
                  className="flex-1 border-gray-300 dark:border-gray-700"
                />
                <Button onClick={handleCustomerSearch} disabled={loadingCustomers} className="bg-blue-600 hover:bg-blue-700">
                  검색
                </Button>
              </div>
              
              {/* 검색 결과 드롭다운 */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((customer) => (
                    <div
                      key={customer.id}
                      onClick={() => handleSelectCustomer(customer)}
                      className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                    >
                      <div className="font-medium text-gray-900 dark:text-gray-50">
                        {customer.institution && customer.prison_number
                          ? `${customer.institution} ${customer.prison_number} ${customer.name}`
                          : `${customer.member_number} - ${customer.name}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {showSearchResults && searchResults.length === 0 && customerSearch.trim() && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md shadow-lg p-4">
                  <div className="text-center text-gray-500 dark:text-gray-400 mb-3">
                    검색 결과가 없습니다.
                  </div>
                  <Button
                    onClick={() => {
                      setShowNewMemberDialog(true)
                      setShowSearchResults(false)
                    }}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    + 신규 회원 등록
                  </Button>
                </div>
              )}
            </div>
            
            {selectedCustomer && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <div className="font-medium text-gray-900 dark:text-gray-50">
                  {selectedCustomer.institution && selectedCustomer.prison_number
                    ? `${selectedCustomer.institution} ${selectedCustomer.prison_number} ${selectedCustomer.name}`
                    : `${selectedCustomer.member_number} - ${selectedCustomer.name}`}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 하단: 아이템 추가 및 장바구니 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 아이템 추가 */}
          <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">아이템 추가</CardTitle>
              <CardDescription>업무 유형을 선택하고 아이템을 추가하세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            {/* 카테고리 선택 */}
            <div className="space-y-2">
              <Label htmlFor="item-category" className="text-sm font-medium">업무 유형 *</Label>
              {mounted ? (
                <Select
                  value={itemCategory}
                  onValueChange={(value: any) => setItemCategory(value)}
                >
                  <SelectTrigger id="item-category" className="border-gray-300 dark:border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="book">도서</SelectItem>
                    <SelectItem value="game">경기 (배팅)</SelectItem>
                    <SelectItem value="goods">물품</SelectItem>
                    <SelectItem value="inquiry">문의</SelectItem>
                    <SelectItem value="complaint">민원</SelectItem>
                    <SelectItem value="other">기타</SelectItem>
                    <SelectItem value="complex">복합</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900" />
              )}
            </div>

            {/* 설명 입력 */}
            <div className="space-y-2">
              <Label htmlFor="item-description" className="text-sm font-medium">
                {itemCategory === "book" && "책 제목 또는 설명"}
                {itemCategory === "game" && "경기 정보 (예: 맨유 승)"}
                {itemCategory === "goods" && "물품 내용"}
                {(itemCategory === "inquiry" || itemCategory === "complaint") && "내용"}
                {(itemCategory === "other" || itemCategory === "complex") && "설명"}
              </Label>
              <Textarea
                id="item-description"
                placeholder={
                  itemCategory === "book"
                    ? "예: 수학의 정석"
                    : itemCategory === "game"
                    ? "예: 맨유 승, 레알 승"
                    : "내용을 입력하세요"
                }
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                rows={3}
                className="border-gray-300 dark:border-gray-700"
              />
            </div>

            {/* 금액 입력 */}
            <div className="space-y-2">
              <Label htmlFor="item-amount" className="text-sm font-medium">금액 (포인트) *</Label>
              <Input
                id="item-amount"
                type="number"
                placeholder="0"
                value={itemAmount}
                onChange={(e) => setItemAmount(e.target.value)}
                className="border-gray-300 dark:border-gray-700"
              />
            </div>

            {/* 담기 버튼 */}
            <Button onClick={handleAddToCart} className="w-full bg-blue-600 hover:bg-blue-700">
              담기
            </Button>
          </CardContent>
        </Card>

          {/* 장바구니 */}
          <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">장바구니</CardTitle>
              <CardDescription>
                총 {cartItems.length}개 아이템 | 합계: {formatNumber(totalAmount)}P
              </CardDescription>
            </CardHeader>
            <CardContent>
            {cartItems.length === 0 ? (
              <div className="text-center p-12 text-gray-500 dark:text-gray-400">
                장바구니가 비어있습니다.
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>구분</TableHead>
                      <TableHead>내용</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                      <TableHead className="w-[100px]">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cartItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{getCategoryLabel(item.category)}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatNumber(item.amount)}P
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveFromCart(item.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            삭제
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* 업무 유형 선택 */}
                <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-800">
                  <Label htmlFor="work-type" className="text-sm font-medium">
                    💼 업무 유형 (선택사항)
                  </Label>
                  <Select value={workType} onValueChange={setWorkType}>
                    <SelectTrigger id="work-type" className="w-full">
                      <SelectValue placeholder="업무 유형을 선택하세요 (미선택 시 자동 분류)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">자동 분류</SelectItem>
                      <SelectItem value="도서">도서</SelectItem>
                      <SelectItem value="경기">경기</SelectItem>
                      <SelectItem value="물품">물품</SelectItem>
                      <SelectItem value="문의">문의</SelectItem>
                      <SelectItem value="민원">민원</SelectItem>
                      <SelectItem value="기타">기타</SelectItem>
                      <SelectItem value="복합">복합</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    업무 유형을 선택하지 않으면 아이템 카테고리 기반으로 자동 분류됩니다.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                    총 합계: {formatNumber(totalAmount)}P
                  </div>
                  <Button
                    onClick={handleCreateTicket}
                    disabled={creating || cartItems.length === 0}
                    className="bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    {creating ? "생성 중..." : "티켓 생성"}
                  </Button>
                </div>
              </div>
            )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
