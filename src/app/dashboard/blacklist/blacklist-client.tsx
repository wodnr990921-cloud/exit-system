"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
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
import { AlertTriangle, UserX } from "lucide-react"

interface BlacklistEntry {
  id: string
  customer_id: string
  reason: string
  flagged_by: string
  created_at: string
  is_active: boolean
  customer: {
    member_number: string
    name: string
  } | null
  flagged_by_user: {
    name: string | null
    username: string
  } | null
}

interface Customer {
  id: string
  member_number: string
  name: string
}

export default function BlacklistClient() {
  const router = useRouter()
  const supabase = createClient()

  const [entries, setEntries] = useState<BlacklistEntry[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<BlacklistEntry | null>(null)
  const [processing, setProcessing] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [newEntry, setNewEntry] = useState({
    customer_id: "",
    reason: "",
  })

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadCustomers()
    loadBlacklist()
    getCurrentUser()
  }, [])

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    } catch (error) {
      console.error("Error getting current user:", error)
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

  const loadBlacklist = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("blacklist")
        .select(`
          *,
          customer:customers!blacklist_customer_id_fkey (member_number, name),
          flagged_by_user:users!blacklist_flagged_by_fkey (name, username)
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false })

      if (error) throw error
      setEntries(data || [])
    } catch (error: any) {
      console.error("Error loading blacklist:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddToBlacklist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUserId) return

    setProcessing(true)
    setError(null)
    setSuccess(null)

    try {
      if (!newEntry.customer_id || !newEntry.reason.trim()) {
        throw new Error("모든 필드를 입력해주세요.")
      }

      // Check if already blacklisted
      const { data: existing } = await supabase
        .from("blacklist")
        .select("id")
        .eq("customer_id", newEntry.customer_id)
        .eq("is_active", true)
        .single()

      if (existing) {
        throw new Error("이미 블랙리스트에 등록된 회원입니다.")
      }

      const { error } = await supabase
        .from("blacklist")
        .insert([{
          customer_id: newEntry.customer_id,
          reason: newEntry.reason.trim(),
          flagged_by: currentUserId,
          is_active: true,
        }])

      if (error) throw error

      setSuccess("블랙리스트에 추가되었습니다.")
      setNewEntry({ customer_id: "", reason: "" })
      setShowAddDialog(false)
      loadBlacklist()

      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (error: any) {
      setError(error.message || "블랙리스트 추가에 실패했습니다.")
    } finally {
      setProcessing(false)
    }
  }

  const handleRemoveFromBlacklist = async () => {
    if (!selectedEntry) return

    setProcessing(true)
    setError(null)
    setSuccess(null)

    try {
      const { error } = await supabase
        .from("blacklist")
        .update({ is_active: false })
        .eq("id", selectedEntry.id)

      if (error) throw error

      setSuccess("블랙리스트에서 제거되었습니다.")
      setShowRemoveDialog(false)
      setSelectedEntry(null)
      loadBlacklist()

      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (error: any) {
      setError(error.message || "블랙리스트 제거에 실패했습니다.")
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
            <UserX className="w-6 h-6 text-red-600" />
            블랙리스트 관리
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">악성 유저 및 주의 회원 관리</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="bg-red-600 hover:bg-red-700">
          + 블랙리스트 추가
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-md">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-md">
          {success}
        </div>
      )}

      <Card className="border-gray-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle>블랙리스트 목록</CardTitle>
          <CardDescription>악성 유저 및 주의 회원 관리</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center p-12 text-gray-500 dark:text-gray-400">로딩 중...</div>
          ) : entries.length === 0 ? (
            <div className="text-center p-12 text-gray-500 dark:text-gray-400">
              블랙리스트가 비어있습니다.
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>상태</TableHead>
                    <TableHead>회원</TableHead>
                    <TableHead>사유</TableHead>
                    <TableHead>등록자</TableHead>
                    <TableHead>등록일시</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id} className="bg-red-50/30 dark:bg-red-950/10">
                      <TableCell>
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3 h-3" />
                          위험
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-gray-900 dark:text-gray-50">
                        {entry.customer
                          ? `${entry.customer.member_number} - ${entry.customer.name}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-red-700 dark:text-red-400">
                        {entry.reason}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">
                        {entry.flagged_by_user?.name || entry.flagged_by_user?.username || "-"}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">
                        {formatDate(entry.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedEntry(entry)
                            setShowRemoveDialog(true)
                          }}
                          className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/20"
                        >
                          제거
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

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>블랙리스트 추가</DialogTitle>
            <DialogDescription>악성 유저를 블랙리스트에 등록합니다</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddToBlacklist}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="customer">회원 *</Label>
                <select
                  id="customer"
                  className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-background"
                  value={newEntry.customer_id}
                  onChange={(e) => setNewEntry({ ...newEntry, customer_id: e.target.value })}
                  required
                  disabled={processing}
                >
                  <option value="">회원을 선택하세요</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.member_number} - {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">사유 *</Label>
                <Textarea
                  id="reason"
                  placeholder="블랙리스트 등록 사유를 상세히 입력하세요"
                  value={newEntry.reason}
                  onChange={(e) => setNewEntry({ ...newEntry, reason: e.target.value })}
                  rows={4}
                  required
                  disabled={processing}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                disabled={processing}
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={processing}
                className="bg-red-600 hover:bg-red-700"
              >
                {processing ? "처리 중..." : "추가"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>블랙리스트 제거</DialogTitle>
            <DialogDescription>블랙리스트에서 제거하시겠습니까?</DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="py-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">회원: </span>
                  <span className="font-medium text-gray-900 dark:text-gray-50">
                    {selectedEntry.customer
                      ? `${selectedEntry.customer.member_number} - ${selectedEntry.customer.name}`
                      : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">사유: </span>
                  <span className="text-gray-900 dark:text-gray-50">{selectedEntry.reason}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRemoveDialog(false)}
              disabled={processing}
            >
              취소
            </Button>
            <Button
              onClick={handleRemoveFromBlacklist}
              disabled={processing}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {processing ? "처리 중..." : "제거"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
