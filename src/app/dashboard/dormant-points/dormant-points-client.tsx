"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Clock, TrendingDown, Settings, DollarSign } from "lucide-react"

interface DormantPoint {
  id: string
  customer_id: string
  dormant_months: number
  general_points: number
  betting_points: number
  total_points: number
  last_activity_date: string
  is_reclaimed: boolean
  reclaimed_at: string | null
  reclaimed_by: string | null
  customer?: {
    member_number: string
    name: string
    email: string
  } | null
  reclaimed_by_user?: {
    name: string
  } | null
}

export default function DormantPointsClient() {
  const router = useRouter()
  const supabase = createClient()

  const [dormantAccounts, setDormantAccounts] = useState<DormantPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  // Settings
  const [dormantThreshold, setDormantThreshold] = useState(12) // months
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)

  // Selection
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())

  // Dialogs
  const [showReclaimDialog, setShowReclaimDialog] = useState(false)
  const [reclaimType, setReclaimType] = useState<"selected" | "all">("selected")

  useEffect(() => {
    checkPermissions()
  }, [])

  useEffect(() => {
    if (hasAccess) {
      loadDormantAccounts()
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

      if (data && ["ceo", "operator"].includes(data.role)) {
        setHasAccess(true)
      } else {
        router.push("/dashboard")
      }
    } catch (error) {
      console.error("Error checking permissions:", error)
      router.push("/")
    }
  }

  const loadDormantAccounts = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/points/dormant?months=${dormantThreshold}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "휴면 계정 목록을 불러올 수 없습니다.")
      }

      setDormantAccounts(data.data || [])
    } catch (error: any) {
      console.error("Error loading dormant accounts:", error)
      setError("휴면 계정 목록을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAccount = (accountId: string, checked: boolean) => {
    const newSelection = new Set(selectedAccounts)
    if (checked) {
      newSelection.add(accountId)
    } else {
      newSelection.delete(accountId)
    }
    setSelectedAccounts(newSelection)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const activeAccounts = dormantAccounts.filter(acc => !acc.is_reclaimed)
      setSelectedAccounts(new Set(activeAccounts.map(acc => acc.id)))
    } else {
      setSelectedAccounts(new Set())
    }
  }

  const openReclaimDialog = (type: "selected" | "all") => {
    setReclaimType(type)
    setShowReclaimDialog(true)
  }

  const handleReclaimPoints = async () => {
    setProcessing(true)
    setError(null)
    setSuccess(null)

    try {
      const accountIds = reclaimType === "all"
        ? dormantAccounts.filter(acc => !acc.is_reclaimed).map(acc => acc.id)
        : Array.from(selectedAccounts)

      if (accountIds.length === 0) {
        throw new Error("회수할 계정을 선택해주세요.")
      }

      const response = await fetch("/api/points/dormant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reclaim",
          accountIds,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "포인트 회수에 실패했습니다.")
      }

      setSuccess(`${accountIds.length}개 계정의 포인트가 회수되었습니다.`)
      setShowReclaimDialog(false)
      setSelectedAccounts(new Set())
      loadDormantAccounts()

      setTimeout(() => setSuccess(null), 3000)
    } catch (error: any) {
      setError(error.message || "포인트 회수에 실패했습니다.")
    } finally {
      setProcessing(false)
    }
  }

  const handleUpdateThreshold = async () => {
    if (dormantThreshold < 1) {
      setError("기준 월수는 1 이상이어야 합니다.")
      return
    }

    setShowSettingsDialog(false)
    loadDormantAccounts()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString("ko-KR")
  }

  const activeAccounts = dormantAccounts.filter(acc => !acc.is_reclaimed)
  const reclaimedAccounts = dormantAccounts.filter(acc => acc.is_reclaimed)

  const totalDormantPoints = activeAccounts.reduce((sum, acc) => sum + acc.total_points, 0)
  const totalReclaimedPoints = reclaimedAccounts.reduce((sum, acc) => sum + acc.total_points, 0)

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
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
              <Clock className="w-6 h-6 text-amber-600" />
              휴면 포인트 관리
            </h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSettingsDialog(true)}
            >
              <Settings className="w-4 h-4 mr-2" />
              기준 설정
            </Button>
            {selectedAccounts.size > 0 && (
              <Button
                onClick={() => openReclaimDialog("selected")}
                className="bg-amber-600 hover:bg-amber-700"
              >
                <TrendingDown className="w-4 h-4 mr-2" />
                선택 회수 ({selectedAccounts.size})
              </Button>
            )}
            {activeAccounts.length > 0 && (
              <Button
                onClick={() => openReclaimDialog("all")}
                variant="destructive"
              >
                <TrendingDown className="w-4 h-4 mr-2" />
                전체 회수
              </Button>
            )}
          </div>
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

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-gray-200 dark:border-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">휴면 계정</Label>
                  <p className="mt-2 text-2xl font-semibold text-amber-600 dark:text-amber-400">
                    {activeAccounts.length}개
                  </p>
                </div>
                <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 dark:border-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">회수 가능 포인트</Label>
                  <p className="mt-2 text-2xl font-semibold text-blue-600 dark:text-blue-400">
                    {formatNumber(totalDormantPoints)}P
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 dark:border-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">낙전 수익 (누적)</Label>
                  <p className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatNumber(totalReclaimedPoints)}P
                  </p>
                </div>
                <TrendingDown className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Dormant Accounts */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle>휴면 계정 목록</CardTitle>
            <CardDescription>
              {dormantThreshold}개월 이상 활동이 없는 계정 (총 {activeAccounts.length}개)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center p-12 text-gray-500 dark:text-gray-400">로딩 중...</div>
            ) : activeAccounts.length === 0 ? (
              <div className="text-center p-12 text-gray-500 dark:text-gray-400">
                휴면 계정이 없습니다.
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80 dark:bg-gray-800/50">
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedAccounts.size === activeAccounts.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>회원</TableHead>
                      <TableHead>이메일</TableHead>
                      <TableHead>휴면 개월</TableHead>
                      <TableHead>마지막 활동일</TableHead>
                      <TableHead>일반 포인트</TableHead>
                      <TableHead>배팅 포인트</TableHead>
                      <TableHead>총 포인트</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeAccounts.map((account) => (
                      <TableRow key={account.id} className="border-b border-gray-100 dark:border-gray-800/50">
                        <TableCell>
                          <Checkbox
                            checked={selectedAccounts.has(account.id)}
                            onCheckedChange={(checked) => handleSelectAccount(account.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-gray-900 dark:text-gray-50">
                          {account.customer
                            ? `${account.customer.member_number} - ${account.customer.name}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-gray-300">
                          {account.customer?.email || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-amber-600">
                            {account.dormant_months}개월
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">
                          {formatDate(account.last_activity_date)}
                        </TableCell>
                        <TableCell className="text-blue-600 dark:text-blue-400">
                          {formatNumber(account.general_points)}P
                        </TableCell>
                        <TableCell className="text-purple-600 dark:text-purple-400">
                          {formatNumber(account.betting_points)}P
                        </TableCell>
                        <TableCell className="font-semibold text-gray-900 dark:text-gray-50">
                          {formatNumber(account.total_points)}P
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reclaimed Accounts */}
        {reclaimedAccounts.length > 0 && (
          <Card className="border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle>회수 완료 내역</CardTitle>
              <CardDescription>포인트가 회수된 계정 (총 {reclaimedAccounts.length}개)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80 dark:bg-gray-800/50">
                      <TableHead>회원</TableHead>
                      <TableHead>휴면 개월</TableHead>
                      <TableHead>마지막 활동일</TableHead>
                      <TableHead>회수 포인트</TableHead>
                      <TableHead>회수일</TableHead>
                      <TableHead>회수자</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reclaimedAccounts.map((account) => (
                      <TableRow key={account.id} className="border-b border-gray-100 dark:border-gray-800/50">
                        <TableCell className="font-medium text-gray-900 dark:text-gray-50">
                          {account.customer
                            ? `${account.customer.member_number} - ${account.customer.name}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">
                          {account.dormant_months}개월
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">
                          {formatDate(account.last_activity_date)}
                        </TableCell>
                        <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatNumber(account.total_points)}P
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">
                          {formatDate(account.reclaimed_at || "")}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">
                          {account.reclaimed_by_user?.name || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Settings Dialog */}
        <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>휴면 계정 기준 설정</DialogTitle>
              <DialogDescription>
                몇 개월 이상 활동이 없는 계정을 휴면으로 처리할지 설정합니다.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="threshold">휴면 기준 (개월)</Label>
                <Input
                  id="threshold"
                  type="number"
                  value={dormantThreshold}
                  onChange={(e) => setDormantThreshold(parseInt(e.target.value) || 1)}
                  min="1"
                  max="60"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  현재: {dormantThreshold}개월 이상 활동이 없으면 휴면 계정으로 표시됩니다.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
                취소
              </Button>
              <Button onClick={handleUpdateThreshold} className="bg-blue-600 hover:bg-blue-700">
                적용
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reclaim Confirmation Dialog */}
        <Dialog open={showReclaimDialog} onOpenChange={setShowReclaimDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>포인트 회수 확인</DialogTitle>
              <DialogDescription>
                {reclaimType === "all"
                  ? "모든 휴면 계정의 포인트를 회수하시겠습니까?"
                  : `선택한 ${selectedAccounts.size}개 계정의 포인트를 회수하시겠습니까?`}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3 bg-amber-50 dark:bg-amber-950/30 p-4 rounded-md border border-amber-200 dark:border-amber-900">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                이 작업은 되돌릴 수 없습니다. 회수된 포인트는 낙전 수익으로 처리됩니다.
              </p>
              <div className="flex justify-between text-sm">
                <span className="font-medium">회수 대상 계정:</span>
                <span className="font-semibold">
                  {reclaimType === "all" ? activeAccounts.length : selectedAccounts.size}개
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium">회수 예상 포인트:</span>
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  {formatNumber(
                    reclaimType === "all"
                      ? totalDormantPoints
                      : activeAccounts
                          .filter(acc => selectedAccounts.has(acc.id))
                          .reduce((sum, acc) => sum + acc.total_points, 0)
                  )}P
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowReclaimDialog(false)}
                disabled={processing}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleReclaimPoints}
                disabled={processing}
              >
                {processing ? "처리 중..." : "회수"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
