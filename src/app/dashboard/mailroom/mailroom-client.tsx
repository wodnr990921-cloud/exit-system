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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

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

  // OCR processing
  const [ocrProcessing, setOcrProcessing] = useState(false)
  const [ocrResult, setOcrResult] = useState<any>(null)
  const [showOcrText, setShowOcrText] = useState(false)
  const [editingOcrText, setEditingOcrText] = useState(false)
  const [editedOcrText, setEditedOcrText] = useState("")

  // Image viewer rotation
  const [rotation, setRotation] = useState(0)
  const transformRef = useRef<any>(null)

  // File upload
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      // Ctrl+Enter: Save and next
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault()
        handleSaveAndNext()
      }
      // R: Rotate
      if (e.key === "r" || e.key === "R") {
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault()
          handleRotate()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedLetter, selectedCustomer, selectedStaff, activeTab])

  const loadCurrentUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("users")
        .select("id, name, username, role")
        .eq("id", user.id)
        .single()

      if (data) setCurrentUser(data)
    } catch (error) {
      console.error("Error loading user:", error)
    }
  }

  const loadDailyStats = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const today = new Date().toISOString().split("T")[0]

      const { count } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("assignee_id", user.id)
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)

      const processed = count || 0
      const target = 50
      const percentage = Math.round((processed / target) * 100)

      setDailyStats({ processed, target, percentage })
    } catch (error) {
      console.error("Error loading daily stats:", error)
    }
  }

  const loadLetters = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("letters")
        .select("*")
        .in("status", ["pending", "uploaded"])
        .order("created_at", { ascending: false })

      if (error) throw error
      setLetters(data || [])

      // Auto-select first letter
      if (data && data.length > 0) {
        setSelectedLetter(data[0])
      }
    } catch (error: any) {
      console.error("Error loading letters:", error)
      setError("편지 목록을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const deleteLetter = async (letterId: string, e?: React.MouseEvent) => {
    e?.stopPropagation() // 버블링 방지

    if (!confirm("이 편지를 삭제하시겠습니까?")) return

    try {
      const letter = letters.find(l => l.id === letterId)
      if (!letter) return

      // Storage에서 파일 삭제 (file_path가 있는 경우만)
      if (letter.file_path) {
        const { error: storageError } = await supabase.storage
          .from("letters")
          .remove([letter.file_path])

        if (storageError) {
          console.error("Storage 삭제 오류:", storageError)
          // Storage 삭제 실패해도 DB 레코드는 삭제 진행
        }
      }

      // DB에서 레코드 삭제
      const { error: dbError } = await supabase
        .from("letters")
        .delete()
        .eq("id", letterId)

      if (dbError) throw dbError

      toast({
        title: "삭제 완료",
        description: "편지가 삭제되었습니다.",
      })

      // 선택된 편지였다면 선택 해제
      if (selectedLetter?.id === letterId) {
        setSelectedLetter(null)
      }

      // 목록 새로고침
      await loadLetters()
    } catch (error: any) {
      console.error("편지 삭제 오류:", error)
      toast({
        title: "삭제 실패",
        description: error.message || "편지 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  }

  const loadStaff = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, username, role")
        .in("role", ["staff", "employee", "operator", "admin", "ceo"])
        .order("name")

      if (error) throw error
      setStaff(data || [])
    } catch (error: any) {
      console.error("Error loading staff:", error)
    }
  }

  const searchCustomers = async (query: string) => {
    if (!query.trim()) {
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
    if (!query.trim()) {
      setBooks([])
      return
    }

    setSearchingBooks(true)
    try {
      const { data, error } = await supabase
        .from("books")
        .select("id, title, author, isbn, price")
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

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const processOcr = async (letter: Letter) => {
    if (!letter.file_url) return

    setOcrProcessing(true)
    setOcrResult(null)
    setError(null)

    try {
      // 이미지 다운로드
      const response = await fetch(letter.file_url)
      const blob = await response.blob()
      const file = new File([blob], "letter.jpg", { type: blob.type })

      // FormData 생성
      const formData = new FormData()
      formData.append("image", file)
      formData.append("detectImageType", "true")
      formData.append("detectProhibited", "true")
      formData.append("extractHandwriting", "true")

      // OCR API 호출
      const ocrResponse = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      })

      const result = await ocrResponse.json()

      if (result.success && result.data) {
        setOcrResult(result.data)
        setEditedOcrText(result.data.rawText || "")

        // DB 업데이트
        await supabase
          .from("letters")
          .update({
            ocr_text: result.data.rawText,
            ocr_confidence: result.data.confidence,
            ocr_image_type: result.data.imageType,
            ocr_prohibited_content: result.data.prohibitedContent,
          })
          .eq("id", letter.id)

        // 로컬 상태 업데이트
        setSelectedLetter({
          ...letter,
          ocr_text: result.data.rawText,
          ocr_confidence: result.data.confidence,
          ocr_image_type: result.data.imageType,
          ocr_prohibited_content: result.data.prohibitedContent,
        })

        // 자동 회원 매칭
        if (result.data.customerMatch?.found) {
          const customer = {
            id: result.data.customerMatch.customerId,
            name: result.data.customerMatch.customerName,
            member_number: result.data.customerMatch.memberNumber,
          }
          setSelectedCustomer(customer)
          setCustomerSearch(customer.name)
        }

        toast({
          title: "OCR 처리 완료",
          description: `신뢰도: ${result.data.confidence}% | 타입: ${getImageTypeLabel(result.data.imageType)}`,
        })
      } else {
        throw new Error(result.error || "OCR 처리 실패")
      }
    } catch (error: any) {
      console.error("OCR Error:", error)
      setError(error.message || "OCR 처리 중 오류가 발생했습니다.")
      toast({
        title: "OCR 처리 실패",
        description: error.message || "이미지를 처리할 수 없습니다.",
        variant: "destructive",
      })
    } finally {
      setOcrProcessing(false)
    }
  }

  const getImageTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      envelope: "📮 봉투 (새업무)",
      letter_content: "📄 편지 (추가)",
      product_photo: "📦 물품사진",
      remittance_proof: "💰 송금증빙",
      unknown: "❓ 알수없음",
    }
    return labels[type] || type
  }

  const getImageTypeBadgeColor = (type: string): string => {
    const colors: Record<string, string> = {
      envelope: "bg-blue-500 text-white border-blue-600",
      letter_content: "bg-green-500 text-white border-green-600",
      product_photo: "bg-purple-500 text-white border-purple-600",
      remittance_proof: "bg-amber-500 text-white border-amber-600",
      unknown: "bg-gray-500 text-white border-gray-600",
    }
    return colors[type] || "bg-gray-500 text-white"
  }

  const saveOcrText = async () => {
    if (!selectedLetter) return

    try {
      await supabase
        .from("letters")
        .update({ ocr_text: editedOcrText })
        .eq("id", selectedLetter.id)

      setSelectedLetter({ ...selectedLetter, ocr_text: editedOcrText })
      setEditingOcrText(false)

      toast({
        title: "저장 완료",
        description: "OCR 텍스트가 수정되었습니다.",
      })
    } catch (error: any) {
      console.error("Save OCR text error:", error)
      toast({
        title: "저장 실패",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleSaveAndNext = async () => {
    if (!selectedLetter || !selectedCustomer || !selectedStaff) {
      setError("회원과 담당자를 선택해주세요.")
      return
    }

    setProcessing(true)
    setError(null)
    setSuccess(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("로그인이 필요합니다.")

      // Prepare task items based on active tab
      let taskItems: any[] = []
      let aiSummary = ""

      if (activeTab === "books" && selectedBooks.length > 0) {
        taskItems = selectedBooks.map((book) => ({
          category: "book",
          description: `${book.title} - ${book.author}`,
          amount: book.price,
          status: "pending",
        }))
        aiSummary = `도서 ${selectedBooks.length}권 신청`
      } else if (activeTab === "purchase" && purchaseItems.some((item) => item.description)) {
        taskItems = purchaseItems
          .filter((item) => item.description)
          .map((item) => ({
            category: "purchase",
            description: item.description,
            amount: item.amount,
            status: "pending",
          }))
        aiSummary = `구매/발주 ${taskItems.length}건`
      } else if (activeTab === "sports" && sportsData.game_type) {
        taskItems = [
          {
            category: "sports",
            description: `${sportsData.game_type} - ${sportsData.result}`,
            amount: sportsData.bet_amount,
            status: "pending",
          },
        ]
        aiSummary = `스포츠 배팅: ${sportsData.game_type}`
      } else if (activeTab === "other" && otherInquiry) {
        taskItems = [
          {
            category: "other",
            description: otherInquiry,
            amount: 0,
            status: "pending",
          },
        ]
        aiSummary = "기타 문의"
      }

      // 미등록 회원 여부 확인
      const isUnknownCustomer = selectedCustomer.id === "unknown"
      const customerId = isUnknownCustomer ? null : selectedCustomer.id
      const customerName = isUnknownCustomer ? "미등록 회원" : selectedCustomer.name

      // 🔍 봉투 판별 로직
      const isEnvelope = selectedLetter.ocr_image_type === "envelope"
      let task: any

      if (isEnvelope || isUnknownCustomer) {
        // 📮 봉투가 있거나 미등록 회원 → 새 업무 생성
        const { data: newTask, error: taskError } = await supabase
          .from("tasks")
          .insert({
            title: `${customerName} - ${aiSummary}`,
            description: selectedLetter.ocr_text || "",
            member_id: customerId,
            customer_id: customerId,
            letter_id: selectedLetter.id,
            assignee_id: selectedStaff,
            status: "assigned",
            ai_summary: aiSummary,
            total_amount: taskItems.reduce((sum, item) => sum + item.amount, 0),
          })
          .select()
          .single()

        if (taskError) throw taskError
        task = newTask

        if (isUnknownCustomer) {
          toast({
            title: "⚠️ 미등록 회원 업무 생성",
            description: `새로운 티켓이 생성되었습니다. (${task.ticket_no})`,
          })
        } else {
          toast({
            title: "📮 새 업무 생성",
            description: `봉투 감지 - 새로운 티켓이 생성되었습니다. (${task.ticket_no})`,
          })
        }
      } else {
        // 📄 편지 내용만 있는 경우 → 기존 업무에 추가
        // 같은 회원의 가장 최근 업무 찾기 (status가 'assigned' 또는 'pending'인 것만)
        const { data: existingTask, error: findError } = await supabase
          .from("tasks")
          .select("*")
          .eq("member_id", customerId)
          .in("status", ["assigned", "pending"])
          .order("created_at", { ascending: false })
          .limit(1)
          .single()

        if (findError && findError.code !== "PGRST116") {
          // PGRST116은 "no rows returned" 오류
          throw findError
        }

        if (existingTask) {
          // 기존 업무에 추가
          task = existingTask

          toast({
            title: "📄 기존 업무에 추가",
            description: `편지 내용 감지 - 티켓 ${task.ticket_no}에 추가되었습니다.`,
          })
        } else {
          // 기존 업무가 없으면 새로 생성
          const { data: newTask, error: taskError } = await supabase
            .from("tasks")
            .insert({
              title: `${customerName} - ${aiSummary}`,
              description: selectedLetter.ocr_text || "",
              member_id: customerId,
              customer_id: customerId,
              letter_id: selectedLetter.id,
              assignee_id: selectedStaff,
              status: "assigned",
              ai_summary: aiSummary,
              total_amount: taskItems.reduce((sum, item) => sum + item.amount, 0),
            })
            .select()
            .single()

          if (taskError) throw taskError
          task = newTask

          toast({
            title: "📄 새 업무 생성",
            description: `기존 업무 없음 - 새로운 티켓이 생성되었습니다. (${task.ticket_no})`,
          })
        }
      }

      // Create task items
      if (taskItems.length > 0) {
        const itemsToInsert = taskItems.map((item) => ({
          ...item,
          task_id: task.id,
        }))

        const { error: itemsError } = await supabase.from("task_items").insert(itemsToInsert)
        if (itemsError) throw itemsError
      }

      // Update letter status
      const { error: letterError } = await supabase
        .from("letters")
        .update({
          status: "assigned",
          employee_id: selectedStaff,
          member_id: customerId,
        })
        .eq("id", selectedLetter.id)

      if (letterError) throw letterError

      setSuccess(`배정 완료: ${task.ticket_no} ${isUnknownCustomer ? "(미등록 회원)" : ""}`)

      // Reset form and move to next letter
      resetForm()
      await loadLetters()
      await loadDailyStats()

      // Auto-select next letter
      const remainingLetters = letters.filter((l) => l.id !== selectedLetter.id)
      if (remainingLetters.length > 0) {
        setSelectedLetter(remainingLetters[0])
      } else {
        setSelectedLetter(null)
      }
    } catch (error: any) {
      setError(error.message || "처리에 실패했습니다.")
    } finally {
      setProcessing(false)
    }
  }

  const resetForm = () => {
    setSelectedCustomer(null)
    setCustomerSearch("")
    setCustomers([])
    setSelectedStaff("")
    setBookSearch("")
    setBooks([])
    setSelectedBooks([])
    setPurchaseItems([{ description: "", amount: 0 }])
    setSportsData({ game_type: "", bet_amount: 0, result: "" })
    setOtherInquiry("")
    setRotation(0)
  }

  const addPurchaseItem = () => {
    setPurchaseItems([...purchaseItems, { description: "", amount: 0 }])
  }

  const updatePurchaseItem = (index: number, field: "description" | "amount", value: any) => {
    const updated = [...purchaseItems]
    if (field === "description") {
      updated[index].description = value
    } else {
      updated[index].amount = value
    }
    setPurchaseItems(updated)
  }

  const removePurchaseItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index))
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setUploadProgress(0)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("로그인이 필요합니다.")

      const totalFiles = files.length
      let uploadedCount = 0

      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        // 이미지 압축 (mobile에서 고해상도 사진 방지)
        const compressedFile = await compressImage(file)

        // Supabase Storage에 업로드
        const fileName = `${Date.now()}_${i}_${file.name}`
        const { data: storageData, error: storageError } = await supabase.storage
          .from("letters")
          .upload(fileName, compressedFile)

        if (storageError) throw storageError

        // Public URL 가져오기
        const {
          data: { publicUrl },
        } = supabase.storage.from("letters").getPublicUrl(fileName)

        // letters 테이블에 레코드 생성
        const { data: letterData, error: insertError } = await supabase
          .from("letters")
          .insert({
            user_id: user.id,
            file_path: fileName,
            file_url: publicUrl,
            file_name: file.name,
            file_size: compressedFile.size,
            file_type: compressedFile.type,
            status: "uploaded",
          })
          .select()
          .single()

        if (insertError) throw insertError

        // 자동 OCR 처리
        try {
          console.log("OCR 처리 시작:", file.name)
          
          const formData = new FormData()
          formData.append("image", compressedFile)
          formData.append("detectImageType", "true")
          formData.append("detectProhibited", "true")
          formData.append("extractHandwriting", "true")

          const ocrResponse = await fetch("/api/ocr", {
            method: "POST",
            body: formData,
          })

          console.log("OCR API 응답 상태:", ocrResponse.status)

          if (!ocrResponse.ok) {
            const errorText = await ocrResponse.text()
            console.error("OCR API 오류:", errorText)
            throw new Error(`OCR API 오류: ${ocrResponse.status}`)
          }

          const ocrResult = await ocrResponse.json()
          console.log("OCR 결과:", ocrResult)

          if (ocrResult.success && ocrResult.data && letterData) {
            // OCR 결과를 letters 테이블에 업데이트
            await supabase
              .from("letters")
              .update({
                ocr_text: ocrResult.data.rawText || null,
                ocr_confidence: ocrResult.data.confidence || null,
                ocr_image_type: ocrResult.data.imageType || null,
                ocr_prohibited_content: ocrResult.data.prohibitedContent || null,
              })
              .eq("id", letterData.id)
            
            console.log("OCR 업데이트 완료:", letterData.id)
          } else {
            console.warn("OCR 실패 또는 데이터 없음:", ocrResult)
          }
        } catch (ocrError: any) {
          console.error("OCR 자동 처리 오류:", ocrError)
          console.error("OCR 오류 상세:", ocrError.message, ocrError.stack)
          // OCR 실패해도 업로드는 성공으로 처리
        }

        uploadedCount++
        setUploadProgress(Math.round((uploadedCount / totalFiles) * 100))
      }

      toast({
        title: "업로드 완료",
        description: `${uploadedCount}개의 편지가 업로드되었습니다. OCR 처리 중... (F12 콘솔에서 진행 상황 확인)`,
        duration: 5000,
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

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement("canvas")
          const MAX_WIDTH = 1600
          const MAX_HEIGHT = 1600
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = (height * MAX_WIDTH) / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = (width * MAX_HEIGHT) / height
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
                const compressedFile = new File([blob], file.name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                })
                resolve(compressedFile)
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

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {/* Top Header */}
      <div className="h-16 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">우편실 검수</h1>
          </div>
          <Badge variant="outline" className="text-sm">
            {letters.length}건 대기중
          </Badge>
          {/* Upload Button with Mobile Camera Support */}
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
              className="bg-green-600 hover:bg-green-700"
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
        </div>

        {/* Staff Stats - Only for employees */}
        {currentUser && ["staff", "employee"].includes(currentUser.role) && (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800">
              <Target className="w-5 h-5 text-blue-600" />
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">오늘 처리</div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-50">
                  {dailyStats.processed} / {dailyStats.target}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">달성률</div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-50">
                  {dailyStats.percentage}%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 min-w-96">
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 shadow-xl animate-in slide-in-from-top">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {success && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 min-w-96">
          <Card className="border-green-200 bg-green-50 dark:bg-green-900/20 shadow-xl animate-in slide-in-from-top">
            <CardContent className="p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content - 3 Columns */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Column 1: Letters List (20%) */}
        <div className="w-1/5 border-r border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="p-4 space-y-2">
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : letters.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Mail className="w-12 h-12 text-gray-400 mb-4" />
                <p className="text-sm text-gray-500 dark:text-gray-400">대기중인 편지가 없습니다</p>
              </div>
            ) : (
              letters.map((letter) => (
                <button
                  key={letter.id}
                  onClick={() => {
                    setSelectedLetter(letter)
                    resetForm()
                  }}
                  className={`group w-full p-3 rounded-lg text-left transition-all relative ${
                    selectedLetter?.id === letter.id
                      ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg scale-105"
                      : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                  }`}
                >
                  {/* 삭제 버튼 */}
                  <button
                    onClick={(e) => deleteLetter(letter.id, e)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title="편지 삭제"
                  >
                    <X className="w-3 h-3" />
                  </button>

                  {letter.ocr_prohibited_content?.found && (
                    <div className="absolute -top-1 -left-1">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                      <Mail
                        className={`w-4 h-4 ${selectedLetter?.id === letter.id ? "text-white" : "text-gray-400"}`}
                      />
                      {letter.ocr_confidence && (
                        <Badge
                          variant={
                            letter.ocr_confidence >= 90
                              ? "default"
                              : letter.ocr_confidence >= 70
                                ? "secondary"
                                : "destructive"
                          }
                          className="text-[10px] px-1 py-0 h-4"
                        >
                          {letter.ocr_confidence}%
                        </Badge>
                      )}
                    </div>
                    <span
                      className={`text-xs ${selectedLetter?.id === letter.id ? "text-white/80" : "text-gray-500"}`}
                    >
                      {new Date(letter.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <div
                    className={`text-xs line-clamp-2 ${selectedLetter?.id === letter.id ? "text-white/90" : "text-gray-600 dark:text-gray-400"}`}
                  >
                    {letter.ocr_text?.substring(0, 60) || "OCR 텍스트 없음"}
                  </div>
                  {letter.ocr_image_type && (
                    <div className="mt-1">
                      <Badge
                        className={`text-[10px] px-1.5 py-0 h-5 font-medium ${getImageTypeBadgeColor(letter.ocr_image_type)} ${selectedLetter?.id === letter.id ? "opacity-90" : ""}`}
                      >
                        {getImageTypeLabel(letter.ocr_image_type)}
                      </Badge>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Image Viewer (40%) */}
        <div className="w-2/5 border-r border-gray-200 dark:border-gray-800 bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm flex flex-col">
          {selectedLetter ? (
            <>
              {/* Image Controls */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">이미지 뷰어</div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => processOcr(selectedLetter)}
                      disabled={ocrProcessing}
                      className="h-8 px-3"
                    >
                      {ocrProcessing ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          OCR 처리중
                        </>
                      ) : (
                        "OCR 실행"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => transformRef.current?.zoomIn()}
                      className="h-8 w-8 p-0"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => transformRef.current?.zoomOut()}
                      className="h-8 w-8 p-0"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRotate}
                      className="h-8 w-8 p-0"
                      title="회전 (R키)"
                    >
                      <RotateCw className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => transformRef.current?.resetTransform()}
                      className="h-8 w-8 p-0"
                    >
                      <Move className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  마우스 휠: 확대/축소 | 드래그: 이동 | R키: 회전
                </div>
              </div>

              {/* OCR Result Panel */}
              {(selectedLetter.ocr_text || ocrResult) && (
                <div className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          OCR 결과
                        </span>
                        {selectedLetter.ocr_image_type && (
                          <Badge className={`text-xs font-medium ${getImageTypeBadgeColor(selectedLetter.ocr_image_type)}`}>
                            {getImageTypeLabel(selectedLetter.ocr_image_type)}
                          </Badge>
                        )}
                        {selectedLetter.ocr_confidence && (
                          <Badge
                            variant={
                              selectedLetter.ocr_confidence >= 90
                                ? "default"
                                : selectedLetter.ocr_confidence >= 70
                                  ? "secondary"
                                  : "destructive"
                            }
                            className="text-xs"
                          >
                            신뢰도 {selectedLetter.ocr_confidence}%
                          </Badge>
                        )}
                        {selectedLetter.ocr_prohibited_content?.found && (
                          <Badge variant="destructive" className="text-xs animate-pulse">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            금지어 발견
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowOcrText(!showOcrText)}
                        className="h-7 px-2 text-xs"
                      >
                        {showOcrText ? "숨기기" : "보기"}
                      </Button>
                    </div>

                    {showOcrText && (
                      <div className="space-y-2">
                        {editingOcrText ? (
                          <>
                            <Textarea
                              value={editedOcrText}
                              onChange={(e) => setEditedOcrText(e.target.value)}
                              className="min-h-[100px] text-xs font-mono"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveOcrText} className="h-7 text-xs">
                                저장
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingOcrText(false)
                                  setEditedOcrText(selectedLetter.ocr_text || "")
                                }}
                                className="h-7 text-xs"
                              >
                                취소
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="max-h-[120px] overflow-y-auto p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs leading-relaxed">
                              {selectedLetter.ocr_text}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingOcrText(true)}
                              className="h-7 text-xs"
                            >
                              수정
                            </Button>
                          </>
                        )}

                        {selectedLetter.ocr_prohibited_content?.found && (
                          <Card className="border-red-300 bg-red-50 dark:bg-red-900/20">
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-xs font-semibold">금지어 탐지</span>
                              </div>
                              <div className="text-xs text-red-600 dark:text-red-400">
                                위험도: {selectedLetter.ocr_prohibited_content.score}/100
                              </div>
                              {selectedLetter.ocr_prohibited_content.matches?.length > 0 && (
                                <div className="space-y-1">
                                  {selectedLetter.ocr_prohibited_content.matches
                                    .slice(0, 3)
                                    .map((match: any, idx: number) => (
                                      <div key={idx} className="text-xs text-red-600 dark:text-red-400">
                                        • {match.description}: "{match.text}"
                                      </div>
                                    ))}
                                  {selectedLetter.ocr_prohibited_content.matches.length > 3 && (
                                    <div className="text-xs text-red-500">
                                      외 {selectedLetter.ocr_prohibited_content.matches.length - 3}건
                                    </div>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Image Display */}
              <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-950">
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
                      src={selectedLetter.file_url}
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
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">편지를 선택해주세요</p>
              </div>
            </div>
          )}
        </div>

        {/* Column 3: Input Form (40%) */}
        <div className="w-2/5 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm flex flex-col max-h-screen">
          {selectedLetter ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
                {/* Customer Search */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold flex items-center gap-2">
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
                        className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
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
                      className="pl-9 h-10 border-gray-300 dark:border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
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
                          className="w-full p-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-50">
                            {customer.member_number} - {customer.name}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedCustomer && (
                    <Card className={`border-2 ${
                      selectedCustomer.id === "unknown" 
                        ? "border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20"
                        : "border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20"
                    }`}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-50">
                            {selectedCustomer.id === "unknown" ? "⚠️" : "✓"} {selectedCustomer.member_number} - {selectedCustomer.name}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedCustomer(null)
                              setCustomerSearch("")
                            }}
                            className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/20"
                          >
                            <X className="w-3 h-3 text-red-600" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Staff Assignment */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">담당자 배정</Label>
                  <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                    <SelectTrigger className="h-10 border-gray-300 dark:border-gray-700">
                      <SelectValue placeholder="담당자 선택..." />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name || s.username} ({s.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Task Type Tabs */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">업무 유형</Label>
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-4 h-10">
                      <TabsTrigger value="books" className="flex items-center gap-1.5 text-xs">
                        <Book className="w-4 h-4" />
                        도서
                      </TabsTrigger>
                      <TabsTrigger value="purchase" className="flex items-center gap-1.5 text-xs">
                        <ShoppingCart className="w-4 h-4" />
                        구매
                      </TabsTrigger>
                      <TabsTrigger value="sports" className="flex items-center gap-1.5 text-xs">
                        <Trophy className="w-4 h-4" />
                        경기
                      </TabsTrigger>
                      <TabsTrigger value="other" className="flex items-center gap-1.5 text-xs">
                        <MessageSquare className="w-4 h-4" />
                        기타
                      </TabsTrigger>
                    </TabsList>

                    {/* Books Tab */}
                    <TabsContent value="books" className="space-y-2 mt-2">
                      <div className="space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            placeholder="도서 제목, 저자, ISBN..."
                            value={bookSearch}
                            onChange={(e) => {
                              setBookSearch(e.target.value)
                              searchBooks(e.target.value)
                            }}
                            className="pl-9 h-11"
                          />
                        </div>

                        {searchingBooks && (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                          </div>
                        )}

                        {!searchingBooks && books.length > 0 && (
                          <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
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
                                className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                              >
                                <div className="text-sm font-medium">{book.title}</div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {book.author} | {book.price.toLocaleString()}원
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {selectedBooks.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-gray-500">선택된 도서</div>
                            {selectedBooks.map((book, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                              >
                                <div>
                                  <div className="text-sm font-medium">{book.title}</div>
                                  <div className="text-xs text-gray-500">{book.author}</div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setSelectedBooks(selectedBooks.filter((_, i) => i !== idx))
                                  }
                                  className="h-8 w-8 p-0"
                                >
                                  ×
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* Purchase Tab */}
                    <TabsContent value="purchase" className="space-y-2 mt-2">
                      {purchaseItems.map((item, idx) => (
                        <div key={idx} className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">항목 {idx + 1}</Label>
                            {purchaseItems.length > 1 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removePurchaseItem(idx)}
                                className="h-6 w-6 p-0 text-red-600"
                              >
                                ×
                              </Button>
                            )}
                          </div>
                          <Input
                            placeholder="물품명..."
                            value={item.description}
                            onChange={(e) => updatePurchaseItem(idx, "description", e.target.value)}
                          />
                          <Input
                            type="number"
                            placeholder="금액..."
                            value={item.amount || ""}
                            onChange={(e) =>
                              updatePurchaseItem(idx, "amount", parseInt(e.target.value) || 0)
                            }
                          />
                        </div>
                      ))}
                      <Button
                        onClick={addPurchaseItem}
                        variant="outline"
                        className="w-full"
                        size="sm"
                      >
                        + 항목 추가
                      </Button>
                    </TabsContent>

                    {/* Sports Tab */}
                    <TabsContent value="sports" className="space-y-2 mt-2">
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs">경기 종류</Label>
                          <Input
                            placeholder="예: 야구, 축구..."
                            value={sportsData.game_type}
                            onChange={(e) =>
                              setSportsData({ ...sportsData, game_type: e.target.value })
                            }
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">배팅 금액</Label>
                          <Input
                            type="number"
                            placeholder="금액..."
                            value={sportsData.bet_amount || ""}
                            onChange={(e) =>
                              setSportsData({
                                ...sportsData,
                                bet_amount: parseInt(e.target.value) || 0,
                              })
                            }
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">결과</Label>
                          <Textarea
                            placeholder="경기 결과 또는 요청사항..."
                            value={sportsData.result}
                            onChange={(e) => setSportsData({ ...sportsData, result: e.target.value })}
                            className="mt-1.5"
                            rows={4}
                          />
                        </div>
                      </div>
                    </TabsContent>

                    {/* Other Tab */}
                    <TabsContent value="other" className="space-y-2 mt-2">
                      <div className="space-y-3">
                        <Label className="text-xs">문의 내용</Label>
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
                </div>
              </div>

              {/* Footer Action Button */}
              <div className="sticky bottom-0 p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 backdrop-blur-sm space-y-2 shadow-lg">
                {/* 필수 조건 안내 */}
                {!selectedStaff && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>담당자를 선택해주세요</span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSaveAndNext}
                  disabled={processing || !selectedCustomer || !selectedStaff}
                  className="w-full h-12 text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  size="lg"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      배정 완료
                      <ArrowRight className="w-4 h-4 ml-2" />
                      <span className="ml-2 text-xs opacity-75">(Ctrl+Enter)</span>
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Send className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">편지를 선택하여 시작하세요</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
