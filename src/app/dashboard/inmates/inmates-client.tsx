"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Users, Info, Plus, Filter } from "lucide-react"

interface Inmate {
  id: string
  customer_id: string
  current_prison: string
  prison_id_number: string
  expected_release_date: string | null
  notes: string | null
  is_released: boolean
  created_at: string
  updated_at: string
  customer: {
    member_number: string
    name: string
  } | null
}

interface Customer {
  id: string
  member_number: string
  name: string
}

interface PrisonRestriction {
  prison_name: string
  prohibited_items: string[]
  address?: string
  contact?: string
}

export default function InmatesClient() {
  const router = useRouter()
  const supabase = createClient()

  const [inmates, setInmates] = useState<Inmate[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [filterPrison, setFilterPrison] = useState<string>("all")
  const [filterReleased, setFilterReleased] = useState<string>("active")

  // Dialogs
  const [showPrisonInfoDialog, setShowPrisonInfoDialog] = useState(false)
  const [showInmateDialog, setShowInmateDialog] = useState(false)
  const [selectedPrison, setSelectedPrison] = useState<PrisonRestriction | null>(null)
  const [editingInmate, setEditingInmate] = useState<Inmate | null>(null)
  const [processing, setProcessing] = useState(false)

  // Form state
  const [inmateForm, setInmateForm] = useState({
    customer_id: "",
    current_prison: "",
    prison_id_number: "",
    expected_release_date: "",
    is_released: false,
    notes: "",
  })

  useEffect(() => {
    checkPermissions()
  }, [])

  useEffect(() => {
    if (hasAccess) {
      loadInmates()
      loadCustomers()
    }
  }, [hasAccess])

  const checkPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/")
        return
      }

      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()

      if (data && ["ceo", "operator", "admin"].includes(data.role)) {
        setHasAccess(true)
      } else {
        router.push("/dashboard")
      }
    } catch (error) {
      console.error("Error checking permissions:", error)
      router.push("/")
    }
  }

  const loadInmates = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("inmates")
        .select(`
          *,
          customer:customers!inmates_customer_id_fkey (member_number, name)
        `)
        .order("updated_at", { ascending: false })

      if (error) throw error
      setInmates(data || [])
    } catch (error: any) {
      console.error("Error loading inmates:", error)
      setError("수용자 목록을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, member_number, name")
        .order("name", { ascending: true })

      if (error) throw error
      setCustomers(data || [])
    } catch (error: any) {
      console.error("Error loading customers:", error)
    }
  }

  const loadPrisonRestrictions = async (prisonName: string) => {
    try {
      const response = await fetch(`/api/prisons/restrictions?prison=${encodeURIComponent(prisonName)}`)
      const data = await response.json()

      if (data.success) {
        setSelectedPrison(data.data)
        setShowPrisonInfoDialog(true)
      } else {
        setError("금지 물품 정보를 불러올 수 없습니다.")
      }
    } catch (error) {
      console.error("Error loading prison restrictions:", error)
      setError("금지 물품 정보를 불러오는데 실패했습니다.")
    }
  }

  const handleShowPrisonInfo = (prisonName: string) => {
    loadPrisonRestrictions(prisonName)
  }

  const openNewInmateDialog = () => {
    setEditingInmate(null)
    setInmateForm({
      customer_id: "",
      current_prison: "",
      prison_id_number: "",
      expected_release_date: "",
      is_released: false,
      notes: "",
    })
    setShowInmateDialog(true)
  }

  const openEditInmateDialog = (inmate: Inmate) => {
    setEditingInmate(inmate)
    setInmateForm({
      customer_id: inmate.customer_id,
      current_prison: inmate.current_prison,
      prison_id_number: inmate.prison_id_number,
      expected_release_date: inmate.expected_release_date || "",
      is_released: inmate.is_released,
      notes: inmate.notes || "",
    })
    setShowInmateDialog(true)
  }

  const handleSaveInmate = async (e: React.FormEvent) => {
    e.preventDefault()
    setProcessing(true)
    setError(null)
    setSuccess(null)

    try {
      if (!inmateForm.customer_id || !inmateForm.current_prison || !inmateForm.prison_id_number) {
        throw new Error("필수 항목을 모두 입력해주세요.")
      }

      const inmateData = {
        customer_id: inmateForm.customer_id,
        current_prison: inmateForm.current_prison,
        prison_id_number: inmateForm.prison_id_number,
        expected_release_date: inmateForm.expected_release_date || null,
        is_released: inmateForm.is_released,
        notes: inmateForm.notes || null,
      }

      if (editingInmate) {
        // Update existing inmate
        const { error } = await supabase
          .from("inmates")
          .update(inmateData)
          .eq("id", editingInmate.id)

        if (error) throw error
        setSuccess("수용자 정보가 수정되었습니다.")
      } else {
        // Insert new inmate
        const { error } = await supabase
          .from("inmates")
          .insert([inmateData])

        if (error) throw error
        setSuccess("수용자가 등록되었습니다.")
      }

      setShowInmateDialog(false)
      loadInmates()

      setTimeout(() => setSuccess(null), 3000)
    } catch (error: any) {
      setError(error.message || "수용자 저장에 실패했습니다.")
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  const isReleaseNear = (dateString: string | null) => {
    if (!dateString) return false
    const releaseDate = new Date(dateString)
    const today = new Date()
    const diffDays = Math.ceil((releaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays <= 30 && diffDays >= 0
  }

  const filteredInmates = inmates.filter((inmate) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        inmate.customer?.name.toLowerCase().includes(query) ||
        inmate.customer?.member_number.toLowerCase().includes(query) ||
        inmate.current_prison.toLowerCase().includes(query) ||
        inmate.prison_id_number.toLowerCase().includes(query)

      if (!matchesSearch) return false
    }

    // Prison filter
    if (filterPrison !== "all" && inmate.current_prison !== filterPrison) {
      return false
    }

    // Released filter
    if (filterReleased === "active" && inmate.is_released) {
      return false
    } else if (filterReleased === "released" && !inmate.is_released) {
      return false
    }

    return true
  })

  const uniquePrisons = Array.from(new Set(inmates.map(i => i.current_prison))).sort()

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-gray-600 dark:text-gray-400">접근 권한이 없습니다.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              수용자 관리
            </h1>
          <Button onClick={openNewInmateDialog} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            수용자 등록
          </Button>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 rounded-md">
            {success}
          </div>
        )}

        {/* Filters */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              필터 및 검색
            </CardTitle>
            <CardDescription>수용자 정보를 검색하고 필터링합니다</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>검색</Label>
                <Input
                  placeholder="회원명, 회원번호, 교도소명, 수용번호..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>교도소</Label>
                <Select value={filterPrison} onValueChange={setFilterPrison}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {uniquePrisons.map(prison => (
                      <SelectItem key={prison} value={prison}>{prison}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>출소 여부</Label>
                <Select value={filterReleased} onValueChange={setFilterReleased}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="active">수용 중</SelectItem>
                    <SelectItem value="released">출소</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inmates Table */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle>수용자 목록</CardTitle>
            <CardDescription>총 {filteredInmates.length}명</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center p-12 text-gray-500 dark:text-gray-400">로딩 중...</div>
            ) : filteredInmates.length === 0 ? (
              <div className="text-center p-12 text-gray-500 dark:text-gray-400">
                수용자 정보가 없습니다.
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80 dark:bg-gray-800/50">
                      <TableHead>회원</TableHead>
                      <TableHead>현재 교도소</TableHead>
                      <TableHead>수용번호</TableHead>
                      <TableHead>출소 예정일</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>비고</TableHead>
                      <TableHead>작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInmates.map((inmate) => (
                      <TableRow key={inmate.id} className="border-b border-gray-100 dark:border-gray-800/50">
                        <TableCell className="font-medium text-gray-900 dark:text-gray-50">
                          {inmate.customer
                            ? `${inmate.customer.member_number} - ${inmate.customer.name}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto text-blue-600 hover:text-blue-700"
                            onClick={() => handleShowPrisonInfo(inmate.current_prison)}
                          >
                            {inmate.current_prison}
                            <Info className="w-4 h-4 ml-1" />
                          </Button>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-gray-700 dark:text-gray-300">
                          {inmate.prison_id_number}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-700 dark:text-gray-300">
                              {formatDate(inmate.expected_release_date)}
                            </span>
                            {isReleaseNear(inmate.expected_release_date) && !inmate.is_released && (
                              <Badge variant="destructive" className="text-xs">
                                출소 임박
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {inmate.is_released ? (
                            <Badge variant="outline" className="text-gray-600">출소</Badge>
                          ) : (
                            <Badge className="bg-blue-600">수용 중</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                          {inmate.notes || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditInmateDialog(inmate)}
                            >
                              수정
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/dashboard/members?id=${inmate.customer_id}`)}
                            >
                              상세보기
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prison Info Dialog */}
        <Dialog open={showPrisonInfoDialog} onOpenChange={setShowPrisonInfoDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedPrison?.prison_name} 정보</DialogTitle>
              <DialogDescription>금지 물품 안내</DialogDescription>
            </DialogHeader>

            {selectedPrison && (
              <div className="py-4 space-y-4">
                <div>
                  <Label className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                    금지 물품 목록
                  </Label>
                  <div className="mt-2 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
                    <ul className="space-y-2">
                      {selectedPrison.prohibited_items.map((item, index) => (
                        <li key={index} className="flex items-center gap-2 text-red-700 dark:text-red-400">
                          <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {selectedPrison.address && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">주소</Label>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{selectedPrison.address}</p>
                  </div>
                )}
                {selectedPrison.contact && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">연락처</Label>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{selectedPrison.contact}</p>
                  </div>
                )}
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  위 물품들은 해당 교도소에서 반입이 금지된 물품입니다. 발송 시 주의해주세요.
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPrisonInfoDialog(false)}>
                닫기
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Inmate Form Dialog */}
        <Dialog open={showInmateDialog} onOpenChange={setShowInmateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingInmate ? "수용자 정보 수정" : "수용자 등록"}</DialogTitle>
              <DialogDescription>
                {editingInmate ? "수용자 정보를 수정합니다." : "새로운 수용자를 등록합니다."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveInmate}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">회원 *</Label>
                  <Select
                    value={inmateForm.customer_id}
                    onValueChange={(value) => setInmateForm({ ...inmateForm, customer_id: value })}
                    disabled={processing || !!editingInmate}
                  >
                    <SelectTrigger id="customer">
                      <SelectValue placeholder="회원을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.member_number} - {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prison">현재 교도소 *</Label>
                  <Select
                    value={inmateForm.current_prison}
                    onValueChange={(value) => setInmateForm({ ...inmateForm, current_prison: value })}
                    disabled={processing}
                  >
                    <SelectTrigger id="prison">
                      <SelectValue placeholder="교도소를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="서울구치소">서울구치소</SelectItem>
                      <SelectItem value="서울남부교도소">서울남부교도소</SelectItem>
                      <SelectItem value="안양교도소">안양교도소</SelectItem>
                      <SelectItem value="의정부교도소">의정부교도소</SelectItem>
                      <SelectItem value="수원구치소">수원구치소</SelectItem>
                      <SelectItem value="인천교도소">인천교도소</SelectItem>
                      <SelectItem value="청주교도소">청주교도소</SelectItem>
                      <SelectItem value="대전교도소">대전교도소</SelectItem>
                      <SelectItem value="기타">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prison_id">수용번호 *</Label>
                  <Input
                    id="prison_id"
                    value={inmateForm.prison_id_number}
                    onChange={(e) => setInmateForm({ ...inmateForm, prison_id_number: e.target.value })}
                    placeholder="수용번호를 입력하세요"
                    disabled={processing}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="release_date">출소 예정일</Label>
                  <Input
                    id="release_date"
                    type="date"
                    value={inmateForm.expected_release_date}
                    onChange={(e) => setInmateForm({ ...inmateForm, expected_release_date: e.target.value })}
                    disabled={processing}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_released"
                    checked={inmateForm.is_released}
                    onChange={(e) => setInmateForm({ ...inmateForm, is_released: e.target.checked })}
                    disabled={processing}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="is_released" className="cursor-pointer">출소 완료</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">비고</Label>
                  <Textarea
                    id="notes"
                    value={inmateForm.notes}
                    onChange={(e) => setInmateForm({ ...inmateForm, notes: e.target.value })}
                    placeholder="특이사항을 입력하세요"
                    rows={4}
                    disabled={processing}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInmateDialog(false)}
                  disabled={processing}
                >
                  취소
                </Button>
                <Button type="submit" disabled={processing} className="bg-blue-600 hover:bg-blue-700">
                  {processing ? "처리 중..." : editingInmate ? "수정" : "등록"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
