"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
} from "@/components/ui/dialog"
import {
  Mail,
  Search,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Move,
  Save,
  ArrowRight,
  Book,
  ShoppingCart,
  Trophy,
  MessageSquare,
  User,
  Target,
  TrendingUp,
  Camera,
  Upload,
  X,
  UserPlus,
  FileText,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"

interface Letter {
  id: string
  file_path: string
  file_url: string
  ocr_text: string | null
  status: string
  created_at: string
  ocr_confidence?: number
  ocr_image_type?: string
  ocr_prohibited_content?: any
  ocr_processing?: boolean
}

interface Customer {
  id: string
  member_number: string
  name: string
}

interface User {
  id: string
  name: string | null
  username: string
  role: string
}

interface Book {
  id: string
  title: string
  author: string
  isbn: string
  price: number
}

interface DailyStats {
  processed: number
  target: number
  percentage: number
}

export default function MailroomClient() {
  const [letters, setLetters] = useState<Letter[]>([])
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null)
  const [selectedLetters, setSelectedLetters] = useState<Letter[]>([]) // 여러 편지 선택
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [showDialog, setShowDialog] = useState(false)

  // User and role
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [dailyStats, setDailyStats] = useState<DailyStats>({ processed: 0, target: 50, percentage: 0 })

  // Customer search
  const [customerSearch, setCustomerSearch] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchingCustomers, setSearchingCustomers] = useState(false)

  // Staff assignment
  const [staff, setStaff] = useState<User[]>([])
  const [selectedStaff, setSelectedStaff] = useState<string>("")

  // Reply/Response
  const [replyText, setReplyText] = useState("")

  // Form tabs
  const [activeTab, setActiveTab] = useState<string>("books")

  // Book form
  const [bookSearch, setBookSearch] = useState("")
  const [books, setBooks] = useState<Book[]>([])
  const [selectedBooks, setSelectedBooks] = useState<Book[]>([])
  const [searchingBooks, setSearchingBooks] = useState(false)

  // Purchase form
  const [purchaseItems, setPurchaseItems] = useState<{ description: string; amount: number }[]>([
    { description: "", amount: 0 },
  ])

  // Sports form
  const [sportsData, setSportsData] = useState({
    game_type: "",
    bet_amount: 0,
    result: "",
  })

  // Other inquiry
  const [otherInquiry, setOtherInquiry] = useState("")

  // Image viewer
  const [rotation, setRotation] = useState(0)
  const transformRef = useRef<any>(null)

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    loadCurrentUser()
    loadLetters()
    loadStaff()
    loadDailyStats()
  }, [])

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null)
        setSuccess(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, success])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter" && selectedLetter && selectedCustomer && selectedStaff && showDialog) {
        e.preventDefault()
        handleSaveAndNext()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedLetter, selectedCustomer, selectedStaff, activeTab, showDialog])

  const loadCurrentUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data, error } = await supabase.from("users").select("*").eq("id", user.id).single()

      if (error) throw error

      setCurrentUser(data)
    } catch (error: any) {
      console.error("Error loading user:", error)
    }
  }

  const loadLetters = async () => {
    try {
      const { data, error } = await supabase
        .from("letters")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true })

      if (error) throw error

      setLetters(data || [])
    } catch (error: any) {
      console.error("Error loading letters:", error)
      setError("편지 목록을 불러올 수 없습니다.")
    } finally {
      setLoading(false)
    }
  }

  const loadStaff = async () => {
    try {
      const { data, error} = await supabase
        .from("users")
        .select("*")
        .in("role", ["staff", "employee"])
        .order("name")

      if (error) throw error

      setStaff(data || [])
    } catch (error: any) {
      console.error("Error loading staff:", error)
    }
  }

  const loadDailyStats = async () => {
    try {
      if (!currentUser) return

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { count, error } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", currentUser.id)
        .gte("created_at", today.toISOString())

      if (error) throw error

      const processed = count || 0
      const target = 50
      const percentage = Math.round((processed / target) * 100)

      setDailyStats({ processed, target, percentage })
    } catch (error: any) {
      console.error("Error loading daily stats:", error)
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
        .select("id, member_number, name")
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

  const searchBooks = async (query: string) => {
    if (query.length < 2) {
      setBooks([])
      return
    }

    setSearchingBooks(true)
    try {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .or(`title.ilike.%${query}%,author.ilike.%${query}%,isbn.ilike.%${query}%`)
        .limit(10)

      if (error) throw error

      setBooks(data || [])
    } catch (error: any) {
      console.error("Error searching books:", error)
    } finally {
      setSearchingBooks(false)
    }
  }

  const resetForm = () => {
    setSelectedCustomer(null)
    setCustomerSearch("")
    setCustomers([])
    setSelectedStaff("")
    setActiveTab("books")
    setBookSearch("")
    setBooks([])
    setSelectedBooks([])
    setPurchaseItems([{ description: "", amount: 0 }])
    setSportsData({ game_type: "", bet_amount: 0, result: "" })
    setOtherInquiry("")
    setReplyText("")
    setRotation(0)
    if (transformRef.current) {
      transformRef.current.resetTransform()
    }
  }

  const handleLetterClick = (letter: Letter) => {
    // 카드 클릭 시 확대 팝업 열기
    setSelectedLetter(letter)
    setSelectedLetters([letter])
    setShowDialog(true)
    resetForm()
  }

  const toggleLetterSelection = (letter: Letter, e: React.MouseEvent) => {
    e.stopPropagation()
    
    const isSelected = selectedLetters.some((l) => l.id === letter.id)
    
    if (isSelected) {
      setSelectedLetters(selectedLetters.filter((l) => l.id !== letter.id))
    } else {
      setSelectedLetters([...selectedLetters, letter])
    }
  }

  const handleBatchAssignment = () => {
    if (selectedLetters.length === 0) {
      setError("선택된 편지가 없습니다.")
      return
    }
    
    setSelectedLetter(selectedLetters[0]) // 첫 번째 편지를 대표로
    setShowDialog(true)
    resetForm()
  }

  const clearSelection = () => {
    setSelectedLetters([])
  }

  const handlePrintReplies = async () => {
    try {
      // Fetch all tasks with replies
      const { data, error } = await supabase
        .from("task_items")
        .select(`
          id,
          category,
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

      // Open print window
      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        toast({
          title: "오류",
          description: "팝업이 차단되었습니다. 팝업 차단을 해제해주세요.",
          variant: "destructive",
        })
        return
      }

      // Generate HTML for printing
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>답변 일괄 출력</title>
  <style>
    @media print {
      @page { margin: 2cm; }
      .page-break { page-break-after: always; }
    }
    body {
      font-family: 'Malgun Gothic', sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #333;
    }
    .header h1 {
      font-size: 28px;
      margin: 0 0 10px 0;
    }
    .header p {
      color: #666;
      font-size: 14px;
    }
    .reply-item {
      margin-bottom: 40px;
      padding: 20px;
      border: 2px solid #ddd;
      border-radius: 8px;
      background: #f9f9f9;
    }
    .reply-header {
      display: flex;
      justify-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #ddd;
    }
    .ticket-info {
      font-weight: bold;
      font-size: 16px;
    }
    .customer-info {
      color: #666;
      font-size: 14px;
    }
    .reply-content {
      white-space: pre-wrap;
      line-height: 1.8;
      font-size: 15px;
      padding: 15px;
      background: white;
      border-left: 4px solid #4CAF50;
      min-height: 100px;
    }
    .date {
      text-align: right;
      color: #999;
      font-size: 12px;
      margin-top: 10px;
    }
    .no-data {
      text-align: center;
      padding: 50px;
      color: #999;
    }
    @media print {
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📮 우편실 답변 일괄 출력</h1>
    <p>출력일시: ${new Date().toLocaleString("ko-KR")}</p>
    <p>총 ${data?.length || 0}건의 답변</p>
  </div>

  ${
    data && data.length > 0
      ? data
          .map(
            (item: any, index: number) => `
    <div class="reply-item ${index < data.length - 1 ? "page-break" : ""}">
      <div class="reply-header">
        <div>
          <div class="ticket-info">티켓 #${item.task?.ticket_no || "N/A"}</div>
          <div class="customer-info">${item.task?.customer?.name || "미등록"} (${item.task?.customer?.member_number || "-"})</div>
        </div>
        <div class="date">${new Date(item.created_at).toLocaleString("ko-KR")}</div>
      </div>
      <div class="reply-content">${item.description}</div>
    </div>
  `
          )
          .join("")
      : '<div class="no-data">등록된 답변이 없습니다.</div>'
  }

  <div class="no-print" style="text-align: center; margin-top: 30px; padding-top: 30px; border-top: 2px solid #ddd;">
    <button onclick="window.print()" style="padding: 10px 30px; font-size: 16px; cursor: pointer; background: #4CAF50; color: white; border: none; border-radius: 5px;">
      🖨️ 인쇄하기
    </button>
    <button onclick="window.close()" style="padding: 10px 30px; font-size: 16px; cursor: pointer; background: #f44336; color: white; border: none; border-radius: 5px; margin-left: 10px;">
      ✕ 닫기
    </button>
  </div>
</body>
</html>
      `

      printWindow.document.write(html)
      printWindow.document.close()

      toast({
        title: "출력 준비 완료",
        description: `${data?.length || 0}건의 답변을 새 창에서 확인하세요`,
      })
    } catch (error: any) {
      console.error("Print replies error:", error)
      toast({
        title: "출력 실패",
        description: error.message || "답변 목록을 불러올 수 없습니다",
        variant: "destructive",
      })
    }
  }

  const deleteLetter = async (letterId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }

    if (!confirm("이 편지를 삭제하시겠습니까?")) {
      return
    }

    try {
      const letter = letters.find((l) => l.id === letterId)
      if (!letter) return

      // Delete from storage
      const { error: storageError } = await supabase.storage.from("letters").remove([letter.file_path])

      if (storageError) throw storageError

      // Delete from database
      const { error: dbError } = await supabase.from("letters").delete().eq("id", letterId)

      if (dbError) throw dbError

      toast({
        title: "삭제 완료",
        description: "편지가 삭제되었습니다.",
      })

      // Refresh list
      await loadLetters()

      // Close dialog if current letter was deleted
      if (selectedLetter?.id === letterId) {
        setSelectedLetter(null)
        setShowDialog(false)
        resetForm()
      }
    } catch (error: any) {
      console.error("Delete error:", error)
      toast({
        title: "삭제 실패",
        description: error.message || "편지 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  }

  const handleSaveAndNext = async () => {
    if (!selectedLetter || !selectedCustomer || !selectedStaff) {
      setError("회원과 담당자를 선택해주세요.")
      return
    }

    console.log(`🎯 [우편실] 배정 시작 - ${selectedLetters.length}개 편지`)
    setProcessing(true)

    try {
      const isUnknownCustomer = selectedCustomer.id === "unknown"
      let actualCustomerId = selectedCustomer.id

      // Create customer if unknown
      if (isUnknownCustomer) {
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert({
            name: "미등록 회원",
            member_number: `TEMP-${Date.now()}`,
          })
          .select()
          .single()

        if (customerError) throw customerError
        actualCustomerId = newCustomer.id
      }

      // Determine if this is a new task or appending to existing
      let taskId: string | null = null

      if (selectedLetter.ocr_image_type === "letter_content" && !isUnknownCustomer) {
        // Try to find recent task for this customer
        const { data: recentTask, error: taskError } = await supabase
          .from("tasks")
          .select("id")
          .eq("customer_id", actualCustomerId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!taskError && recentTask) {
          taskId = recentTask.id
        }
      }

      // Create new task if needed
      if (!taskId) {
        // Generate title based on letter type
        const letterType = selectedLetter.ocr_image_type === "envelope" ? "신규 편지" : "편지 내용"
        const taskTitle = `[우편실] ${letterType} - ${selectedCustomer.name || "미등록 회원"}`
        
        console.log(`📝 새 티켓 생성 중... 제목: ${taskTitle}`)
        
        const { data: task, error: taskError } = await supabase
          .from("tasks")
          .insert({
            user_id: currentUser?.id || selectedStaff,
            title: taskTitle,
            customer_id: actualCustomerId,
            member_id: actualCustomerId,
            assigned_to: selectedStaff,
            status: "pending",
          })
          .select()
          .single()

        if (taskError) {
          console.error("❌ 티켓 생성 실패:", taskError)
          throw taskError
        }
        
        taskId = task.id
        console.log(`✅ 티켓 생성 완료! ID: ${taskId}`)
      }

      // Create task items based on activeTab
      const taskItems: any[] = []

      if (activeTab === "books" && selectedBooks.length > 0) {
        taskItems.push(
          ...selectedBooks.map((book) => ({
            task_id: taskId,
            category: "도서",
            description: `${book.title} - ${book.author}`,
            amount: book.price,
            status: "pending",
          }))
        )
      } else if (activeTab === "purchase") {
        const validItems = purchaseItems.filter((item) => item.description.trim())
        taskItems.push(
          ...validItems.map((item) => ({
            task_id: taskId,
            category: "구매",
            description: item.description,
            amount: item.amount,
            status: "pending",
          }))
        )
      } else if (activeTab === "sports" && sportsData.game_type) {
        taskItems.push({
          task_id: taskId,
          category: "배팅",
          description: `${sportsData.game_type} ${sportsData.result ? `(${sportsData.result})` : ""}`,
          amount: sportsData.bet_amount,
          status: "pending",
        })
      } else if (activeTab === "other" && otherInquiry.trim()) {
        taskItems.push({
          task_id: taskId,
          category: "문의",
          description: otherInquiry.trim(),
          amount: 0,
          status: "pending",
        })
      }

      // Add OCR text from all selected letters as task items
      if (selectedLetters.length > 0) {
        console.log(`📮 [우편실] ${selectedLetters.length}개 편지 처리 중...`)
        
        const combinedOcrTexts = selectedLetters
          .filter((letter) => letter.ocr_text)
          .map((letter, index) => {
            console.log(`  - 편지 ${index + 1}: OCR 텍스트 ${letter.ocr_text?.length || 0}자`)
            return `[편지 ${index + 1}]\n${letter.ocr_text}`
          })
          .join("\n\n")

        console.log(`📝 합쳐진 텍스트 총 ${combinedOcrTexts.length}자`)

        if (combinedOcrTexts) {
          taskItems.push({
            task_id: taskId,
            category: "편지 내용",
            description: combinedOcrTexts,
            amount: 0,
            status: "pending",
          })
          console.log(`✅ 편지 내용 task_item 생성됨`)
        }
      }

      // Add reply if provided
      if (replyText.trim()) {
        taskItems.push({
          task_id: taskId,
          category: "답변",
          description: replyText.trim(),
          amount: 0,
          status: "pending",
        })
        console.log(`✅ 답변 task_item 생성됨 (${replyText.length}자)`)
      }

      if (taskItems.length > 0) {
        const { error: itemsError } = await supabase.from("task_items").insert(taskItems)
        if (itemsError) throw itemsError
      }

      // Update all selected letters' status
      const letterIds = selectedLetters.map((l) => l.id)
      const { error: letterError } = await supabase
        .from("letters")
        .update({ status: "processed" })
        .in("id", letterIds)

      if (letterError) throw letterError

      console.log(`🎉 배정 완료! ${selectedLetters.length}개 편지 → ${isUnknownCustomer ? "미등록 회원" : selectedCustomer.name}`)
      
      toast({
        title: "배정 완료",
        description: `${selectedLetters.length}개 편지가 ${isUnknownCustomer ? "미등록 회원" : selectedCustomer.name}에게 배정되었습니다.`,
      })

      setSuccess(
        `배정 완료: ${selectedLetters.length}개 편지 → ${isUnknownCustomer ? "(미등록 회원)" : selectedCustomer.name}`
      )

      // Reset form and move to next letter
      resetForm()
      clearSelection()
      setShowDialog(false)
      await loadLetters()
      await loadDailyStats()

    } catch (error: any) {
      console.error("❌ [우편실] 배정 실패:", error)
      console.error("오류 상세:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      
      // 사용자 친화적인 오류 메시지
      let userMessage = "저장 중 오류가 발생했습니다."
      if (error.code === "23502") {
        const column = error.message.match(/column "([^"]+)"/)?.[1]
        userMessage = `필수 정보가 누락되었습니다: ${column || "알 수 없음"}`
      } else if (error.code === "42702") {
        userMessage = "데이터베이스 설정 오류입니다. 관리자에게 문의하세요."
      } else if (error.message) {
        userMessage = error.message
      }
      
      setError(userMessage)
      
      toast({
        title: "배정 실패",
        description: userMessage,
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setUploadProgress(0)

    try {
      const totalFiles = files.length
      let uploadedCount = 0

      for (const file of Array.from(files)) {
        // Compress image
        const compressedFile = await compressImage(file)

        // Upload to storage
        const fileName = `${Date.now()}-${file.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("letters")
          .upload(fileName, compressedFile)

        if (uploadError) throw uploadError

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("letters").getPublicUrl(fileName)

        // Insert into database
        const { data: letterData, error: letterError } = await supabase
          .from("letters")
          .insert({
            file_path: fileName,
            file_url: publicUrl,
            user_id: currentUser?.id,
            file_name: file.name,
            file_size: compressedFile.size,
            file_type: compressedFile.type,
            status: "pending",
          })
          .select()
          .single()

        if (letterError) throw letterError

        // Trigger OCR
        console.log("[OCR] 처리 시작:", letterData.id)
        const ocrResponse = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: publicUrl,
            letterId: letterData.id,
          }),
        })

        console.log("[OCR] API 응답 상태:", ocrResponse.status)
        const ocrResult = await ocrResponse.json()
        console.log("[OCR] API 응답:", ocrResult)

        if (ocrResult.success) {
          console.log("[OCR] 추출 완료:", {
            textLength: ocrResult.rawText?.length,
            confidence: ocrResult.confidence,
            imageType: ocrResult.imageType,
          })

          // Update letter with OCR results
          const { error: updateError } = await supabase
            .from("letters")
            .update({
              ocr_text: ocrResult.rawText,
              ocr_confidence: ocrResult.confidence,
              ocr_image_type: ocrResult.imageType,
              ocr_prohibited_content: ocrResult.prohibitedContent,
            })
            .eq("id", letterData.id)

          if (updateError) {
            console.error("[OCR] 업데이트 오류:", updateError)
          } else {
            console.log("[OCR] 업데이트 완료:", letterData.id)
          }
        } else {
          console.error("[OCR] 처리 실패:", ocrResult.error)
        }

        uploadedCount++
        setUploadProgress(Math.round((uploadedCount / totalFiles) * 100))
      }

      toast({
        title: "업로드 완료",
        description: `${uploadedCount}개의 편지가 업로드되었습니다. OCR 처리 중... (F12 콘솔에서 진행 상황 확인)`,
      })

      // 목록 새로고침
      await loadLetters()
    } catch (error: any) {
      console.error("Upload error:", error)
      toast({
        title: "업로드 실패",
        description: error.message || "파일 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement("canvas")
          const MAX_WIDTH = 1920
          const MAX_HEIGHT = 1920
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height
              height = MAX_HEIGHT
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext("2d")
          ctx?.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(new File([blob], file.name, { type: "image/jpeg" }))
              } else {
                reject(new Error("압축 실패"))
              }
            },
            "image/jpeg",
            0.85
          )
        }
        img.onerror = reject
      }
      reader.onerror = reject
    })
  }

  const getOcrSummary = (letter: Letter): string => {
    if (!letter.ocr_text) return "OCR 처리 중..."
    
    const maxLength = 100
    const text = letter.ocr_text.trim()
    if (text.length <= maxLength) return text
    
    return text.substring(0, maxLength) + "..."
  }

  const getLetterTitle = (letter: Letter): string => {
    if (letter.ocr_image_type === "envelope") return "📮 봉투 (새 업무)"
    if (letter.ocr_image_type === "letter_content") return "📄 편지 내용"
    if (letter.ocr_image_type === "product_photo") return "📦 상품 사진"
    if (letter.ocr_image_type === "remittance_proof") return "💰 송금 증빙"
    return "📧 편지"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {/* Top Header */}
      <div className="sticky top-0 z-40 h-16 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">우편실 검수</h1>
          </div>
          <Badge variant="outline" className="text-sm">
            {letters.length}건 대기중
          </Badge>
          {selectedLetters.length > 0 ? (
            <>
              <Badge className="text-sm bg-blue-600">
                {selectedLetters.length}개 선택됨
              </Badge>
              <Button
                onClick={handleBatchAssignment}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                선택한 편지 배정하기
              </Button>
              <Button
                onClick={clearSelection}
                size="sm"
                variant="outline"
                className="text-gray-900 dark:text-gray-100"
              >
                <X className="w-4 h-4 mr-2" />
                선택 취소
              </Button>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              💡 카드 클릭하여 확대 | 체크박스로 여러 개 선택
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Upload Button */}
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-gray-900 dark:text-gray-900"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  업로드 중 {uploadProgress}%
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  편지 촬영/업로드
                </>
              )}
            </Button>
          </div>

          {/* Print Replies Button */}
          <Button
            onClick={handlePrintReplies}
            size="sm"
            variant="outline"
            className="text-gray-900 dark:text-gray-100 border-green-500 hover:bg-green-50"
          >
            <FileText className="w-4 h-4 mr-2" />
            답변 일괄 출력
          </Button>

          {/* Staff Stats */}
          {currentUser && ["staff", "employee"].includes(currentUser.role) && (
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800">
              <Target className="w-5 h-5 text-blue-600" />
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">오늘 처리</div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-50">
                  {dailyStats.processed} / {dailyStats.target} ({dailyStats.percentage}%)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 min-w-96">
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 shadow-xl animate-in slide-in-from-top">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {success && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 min-w-96">
          <Card className="border-green-200 bg-green-50 dark:bg-green-900/20 shadow-xl animate-in slide-in-from-top">
            <CardContent className="p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content - Letter Cards Grid */}
      <div className="max-w-7xl mx-auto p-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : letters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Mail className="w-20 h-20 text-gray-400 mb-4" />
            <p className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">대기 중인 편지가 없습니다</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">편지를 촬영하거나 업로드해주세요</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {letters.map((letter) => {
              const isSelected = selectedLetters.some((l) => l.id === letter.id)
              
              return (
                <Card
                  key={letter.id}
                  className={`group cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02] relative overflow-hidden border-2 ${
                    isSelected
                      ? "border-blue-500 ring-2 ring-blue-300"
                      : "hover:border-blue-500"
                  }`}
                  onClick={() => handleLetterClick(letter)}
                >
                  {/* Checkbox */}
                  <div
                    className="absolute top-2 left-2 z-20"
                    onClick={(e) => toggleLetterSelection(letter, e)}
                  >
                    <div
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? "bg-blue-600 border-blue-600"
                          : "bg-white border-gray-300 group-hover:border-blue-500"
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => deleteLetter(letter.id, e)}
                    className="absolute top-2 right-2 p-2 rounded-full bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                    title="편지 삭제"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Prohibited Content Alert */}
                  {letter.ocr_prohibited_content?.found && (
                    <div className="absolute top-10 left-2 z-10">
                      <Badge variant="destructive" className="animate-pulse">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        금지어 감지
                      </Badge>
                    </div>
                  )}

                <CardContent className="p-0">
                  {/* Image Preview - Reduced size */}
                  <div className="h-20 bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <img
                      src={letter.file_url}
                      alt="Letter"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-2">
                    {/* Title with Badge */}
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-50">
                        {getLetterTitle(letter)}
                      </h3>
                      {letter.ocr_confidence && (
                        <Badge
                          variant={
                            letter.ocr_confidence >= 90
                              ? "default"
                              : letter.ocr_confidence >= 70
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {letter.ocr_confidence}%
                        </Badge>
                      )}
                    </div>

                    {/* OCR Summary */}
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                      {getOcrSummary(letter)}
                    </p>

                    {/* Timestamp */}
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {new Date(letter.created_at).toLocaleString("ko-KR")}
                    </p>
                  </div>
                </CardContent>
              </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Assignment Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
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

          {selectedLetter && selectedLetters.length > 0 && (
            <div className="grid grid-cols-2 gap-6 mt-4">
              {/* Left: Images */}
              <div className="space-y-4">
                {selectedLetters.length === 1 ? (
                  <div className="bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden h-[600px]">
                    <TransformWrapper
                      ref={transformRef}
                      initialScale={1}
                      minScale={0.5}
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
                          className="max-w-full max-h-full object-contain"
                          style={{
                            transform: `rotate(${rotation}deg)`,
                            transition: "transform 0.3s ease",
                          }}
                        />
                      </TransformComponent>
                    </TransformWrapper>
                  </div>
                ) : (
                  <div className="space-y-3 h-[600px] overflow-y-auto p-2">
                    {selectedLetters.map((letter, index) => (
                      <div key={letter.id} className="relative">
                        <Badge className="absolute top-2 left-2 z-10 bg-blue-600">
                          편지 {index + 1}
                        </Badge>
                        <img
                          src={letter.file_url}
                          alt={`Letter ${index + 1}`}
                          className="w-full max-h-[300px] object-contain rounded-lg border-2 border-gray-200 dark:border-gray-700"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Image Controls */}
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => transformRef.current?.zoomIn()}
                    className="text-gray-900 dark:text-gray-100"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => transformRef.current?.zoomOut()}
                    className="text-gray-900 dark:text-gray-100"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRotation((prev) => (prev + 90) % 360)}
                    className="text-gray-900 dark:text-gray-100"
                  >
                    <RotateCw className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => transformRef.current?.resetTransform()}
                    className="text-gray-900 dark:text-gray-100"
                  >
                    <Move className="w-4 h-4" />
                  </Button>
                </div>

                {/* OCR Result */}
                {selectedLetters.some((l) => l.ocr_text) && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-bold mb-3 flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-md">
                        <MessageSquare className="w-4 h-4" />
                        OCR 추출 내용
                        <Badge variant="secondary" className="ml-auto">
                          {selectedLetters.length}개 편지
                        </Badge>
                      </h4>
                      <div className="text-sm text-gray-600 dark:text-gray-400 max-h-48 overflow-y-auto space-y-3">
                        {selectedLetters.map((letter, index) => (
                          letter.ocr_text && (
                            <div key={letter.id} className="whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-3 rounded">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-xs">
                                  편지 {index + 1}
                                </Badge>
                                {letter.ocr_confidence && (
                                  <Badge variant="secondary" className="text-xs">
                                    {letter.ocr_confidence}%
                                  </Badge>
                                )}
                              </div>
                              {letter.ocr_text}
                            </div>
                          )
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Prohibited Content Warning */}
                {selectedLetters.some((l) => l.ocr_prohibited_content?.found) && (
                  <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-bold text-red-900 dark:text-red-100 mb-3 bg-red-100 dark:bg-red-900/30 px-3 py-2 rounded-md">
                            ⚠️ 금지어 감지됨
                          </h4>
                          {selectedLetters.map((letter, index) => (
                            letter.ocr_prohibited_content?.found && letter.ocr_prohibited_content.matches?.length > 0 && (
                              <div key={letter.id} className="mb-3">
                                <Badge variant="outline" className="mb-2">
                                  편지 {index + 1}
                                </Badge>
                                <div className="space-y-1">
                                  {letter.ocr_prohibited_content.matches
                                    .slice(0, 3)
                                    .map((match: any, idx: number) => (
                                      <div key={idx} className="text-xs text-red-600 dark:text-red-400">
                                        • {match.description}: "{match.text}"
                                      </div>
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
              </div>

              {/* Right: Assignment Form */}
              <div className="space-y-4">
                {/* Customer Search */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-md">
                      <User className="w-4 h-4" />
                      회원 검색
                    </Label>
                    {!selectedCustomer && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedCustomer({ id: "unknown", member_number: "미등록", name: "미등록 회원" })
                          setCustomerSearch("")
                        }}
                        className="h-7 text-xs text-gray-900 dark:text-gray-100 hover:bg-amber-50"
                      >
                        <UserPlus className="w-3 h-3 mr-1" />
                        회원 없이 진행
                      </Button>
                    )}
                  </div>
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
                      disabled={selectedCustomer?.id === "unknown"}
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
                            setCustomerSearch(customer.name)
                            setCustomers([])
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="font-medium text-gray-900 dark:text-gray-50">{customer.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{customer.member_number}</div>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedCustomer && (
                    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                      <CardContent className="p-3 flex items-center justify-between">
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
                            setCustomerSearch("")
                          }}
                          className="text-gray-900 dark:text-gray-100"
                        >
                          변경
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Staff Assignment */}
                <div className="space-y-2">
                  <Label className="text-sm font-bold flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-md">
                    <User className="w-4 h-4" />
                    담당자 지정
                  </Label>
                  <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                    <SelectTrigger>
                      <SelectValue placeholder="담당자를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name || s.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tabs for different request types */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="books">
                      <Book className="w-4 h-4 mr-1" />
                      도서
                    </TabsTrigger>
                    <TabsTrigger value="purchase">
                      <ShoppingCart className="w-4 h-4 mr-1" />
                      구매
                    </TabsTrigger>
                    <TabsTrigger value="sports">
                      <Trophy className="w-4 h-4 mr-1" />
                      배팅
                    </TabsTrigger>
                    <TabsTrigger value="other">
                      <MessageSquare className="w-4 h-4 mr-1" />
                      기타
                    </TabsTrigger>
                  </TabsList>

                  {/* Books Tab */}
                  <TabsContent value="books" className="space-y-3">
                    <div className="space-y-2">
                      <Label>도서 검색</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          placeholder="책 제목, 저자, ISBN..."
                          value={bookSearch}
                          onChange={(e) => {
                            setBookSearch(e.target.value)
                            searchBooks(e.target.value)
                          }}
                          className="pl-9"
                        />
                      </div>

                      {searchingBooks && (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        </div>
                      )}

                      {!searchingBooks && books.length > 0 && (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 max-h-48 overflow-y-auto">
                          {books.map((book) => (
                            <button
                              key={book.id}
                              onClick={() => {
                                if (!selectedBooks.find((b) => b.id === book.id)) {
                                  setSelectedBooks([...selectedBooks, book])
                                }
                                setBookSearch("")
                                setBooks([])
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                              <div className="font-medium text-gray-900 dark:text-gray-50">{book.title}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {book.author} · {book.price.toLocaleString()}원
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {selectedBooks.length > 0 && (
                        <div className="space-y-2">
                          {selectedBooks.map((book) => (
                            <Card key={book.id}>
                              <CardContent className="p-3 flex items-center justify-between">
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-gray-50">{book.title}</div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {book.author} · {book.price.toLocaleString()}원
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setSelectedBooks(selectedBooks.filter((b) => b.id !== book.id))
                                  }
                                  className="text-gray-900 dark:text-gray-100"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Purchase Tab */}
                  <TabsContent value="purchase" className="space-y-3">
                    {purchaseItems.map((item, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="상품명"
                          value={item.description}
                          onChange={(e) => {
                            const newItems = [...purchaseItems]
                            newItems[index].description = e.target.value
                            setPurchaseItems(newItems)
                          }}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          placeholder="금액"
                          value={item.amount || ""}
                          onChange={(e) => {
                            const newItems = [...purchaseItems]
                            newItems[index].amount = parseFloat(e.target.value) || 0
                            setPurchaseItems(newItems)
                          }}
                          className="w-32"
                        />
                        {index === purchaseItems.length - 1 ? (
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => setPurchaseItems([...purchaseItems, { description: "", amount: 0 }])}
                            className="text-gray-900 dark:text-gray-100"
                          >
                            +
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => setPurchaseItems(purchaseItems.filter((_, i) => i !== index))}
                            className="text-gray-900 dark:text-gray-100"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </TabsContent>

                  {/* Sports Tab */}
                  <TabsContent value="sports" className="space-y-3">
                    <div className="space-y-2">
                      <Label>경기 종목</Label>
                      <Input
                        placeholder="예: K리그, EPL, NBA..."
                        value={sportsData.game_type}
                        onChange={(e) => setSportsData({ ...sportsData, game_type: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>배팅 금액</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={sportsData.bet_amount || ""}
                        onChange={(e) =>
                          setSportsData({ ...sportsData, bet_amount: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>결과 (선택)</Label>
                      <Input
                        placeholder="승/패/무 또는 기타 결과"
                        value={sportsData.result}
                        onChange={(e) => setSportsData({ ...sportsData, result: e.target.value })}
                      />
                    </div>
                  </TabsContent>

                  {/* Other Tab */}
                  <TabsContent value="other" className="space-y-3">
                    <div className="space-y-2">
                      <Label>문의 내용</Label>
                      <Textarea
                        placeholder="기타 문의사항을 입력하세요..."
                        value={otherInquiry}
                        onChange={(e) => setOtherInquiry(e.target.value)}
                        rows={10}
                        className="resize-none"
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Required Conditions Warning */}
                {(!selectedCustomer || !selectedStaff) && (
                  <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>
                          {!selectedCustomer && "회원을 선택해주세요. "}
                          {!selectedStaff && "담당자를 선택해주세요."}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Reply Section */}
                <Card className="border-2 border-green-200 dark:border-green-800">
                  <CardContent className="p-4">
                    <Label className="text-sm font-bold flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-md mb-3">
                      <MessageSquare className="w-4 h-4" />
                      답변 작성
                      <Badge variant="outline" className="ml-auto">
                        선택사항
                      </Badge>
                    </Label>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="회원에게 보낼 답변을 작성하세요... (선택사항)"
                      className="w-full h-32 p-3 text-sm border rounded-md resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span>💡 팁: 답변은 일괄 출력하여 편지와 함께 발송할 수 있습니다</span>
                      <span>{replyText.length}자</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Submit Button */}
                <Button
                  onClick={handleSaveAndNext}
                  disabled={processing || !selectedCustomer || !selectedStaff}
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-gray-900 dark:text-gray-900"
                  size="lg"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      배정 완료
                      <ArrowRight className="w-5 h-5 ml-2" />
                      <span className="ml-2 text-xs opacity-75">(Ctrl+Enter)</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
