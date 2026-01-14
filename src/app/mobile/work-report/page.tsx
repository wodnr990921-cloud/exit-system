"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Clock, Save, LogIn, LogOut as LogOutIcon } from "lucide-react"

interface WorkReport {
  id: string
  clock_in: string
  clock_out: string | null
  consumables: any[]
  expenses: any[]
  message: string | null
  status: string
}

export default function MobileWorkReportPage() {
  const router = useRouter()
  const supabase = createClient()
  const [currentReport, setCurrentReport] = useState<WorkReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadCurrentReport()
  }, [])

  const loadCurrentReport = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/")
        return
      }

      const today = new Date().toISOString().split("T")[0]
      const { data, error } = await supabase
        .from("work_reports")
        .select("*")
        .eq("employee_id", user.id)
        .eq("status", "in_progress")
        .gte("clock_in", `${today}T00:00:00Z`)
        .lte("clock_in", `${today}T23:59:59Z`)
        .single()

      if (error && error.code !== "PGRST116") throw error

      setCurrentReport(data)
      setMessage(data?.message || "")
    } catch (error) {
      console.error("Error loading work report:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleClockIn = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const response = await fetch("/api/work-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          consumables: [],
          expenses: [],
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "출근 기록에 실패했습니다.")
      }

      setSuccess("출근이 기록되었습니다.")
      loadCurrentReport()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleClockOut = async () => {
    if (!currentReport) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const response = await fetch("/api/work-reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: currentReport.id,
          clockOut: true,
          message,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "퇴근 기록에 실패했습니다.")
      }

      setSuccess("퇴근이 기록되었습니다.")
      setCurrentReport(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (!currentReport) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const response = await fetch("/api/work-reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: currentReport.id,
          message,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "저장에 실패했습니다.")
      }

      setSuccess("저장되었습니다.")
      loadCurrentReport()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const calculateWorkHours = () => {
    if (!currentReport) return "0시간 0분"

    const clockIn = new Date(currentReport.clock_in)
    const now = new Date()
    const diff = now.getTime() - clockIn.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    return `${hours}시간 ${minutes}분`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">업무 보고</h1>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 pb-20">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-600">
            {success}
          </div>
        )}

        {/* Status Card */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              근무 상태
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentReport ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">상태</span>
                  <Badge className="bg-green-100 text-green-800">근무 중</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">출근 시간</span>
                  <span className="font-medium">
                    {new Date(currentReport.clock_in).toLocaleTimeString("ko-KR")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">근무 시간</span>
                  <span className="font-medium text-blue-600">{calculateWorkHours()}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <Badge variant="outline" className="bg-gray-100 text-gray-800">
                  출근 전
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Card */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>업무 메모</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="오늘의 업무 내용을 입력하세요..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              disabled={!currentReport}
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          {!currentReport ? (
            <Button
              className="w-full h-14 text-lg"
              onClick={handleClockIn}
              disabled={saving}
            >
              <LogIn className="h-5 w-5 mr-2" />
              {saving ? "처리 중..." : "출근"}
            </Button>
          ) : (
            <>
              <Button
                className="w-full h-14 text-lg"
                variant="outline"
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="h-5 w-5 mr-2" />
                {saving ? "저장 중..." : "저장"}
              </Button>
              <Button
                className="w-full h-14 text-lg"
                variant="destructive"
                onClick={handleClockOut}
                disabled={saving}
              >
                <LogOutIcon className="h-5 w-5 mr-2" />
                {saving ? "처리 중..." : "퇴근"}
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
