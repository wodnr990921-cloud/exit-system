"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

interface DailyReply {
  taskId: string
  ticketNo: string | null
  customer: {
    id: string
    name: string
    institution: string | null
    prison_number: string | null
    mailbox_address: string | null
  }
  ticketReply: string
  notifications: Array<{
    id: string
    message: string
  }>
  notices: Array<{
    id: string
    title: string
    content: string
  }>
}

export default function DailyRepliesClient() {
  const [replies, setReplies] = useState<DailyReply[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [printMode, setPrintMode] = useState(false)

  useEffect(() => {
    loadDailyReplies()
  }, [selectedDate])

  const loadDailyReplies = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/replies/daily?date=${selectedDate}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "답변 목록을 불러오는데 실패했습니다.")
      }

      setReplies(data.replies || [])
    } catch (error: any) {
      console.error("Error loading daily replies:", error)
      setError(error.message || "답변 목록을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const formatReply = (reply: DailyReply) => {
    const { customer, ticketReply, notifications, notices } = reply

    // 상단: 수용기관 사서함주소 수번 이름
    const header = [
      customer.institution || "",
      customer.mailbox_address || "",
      customer.prison_number || "",
      customer.name,
    ]
      .filter(Boolean)
      .join(" ")

    let content = ""

    // 인사말
    content += `안녕하세요! ${customer.name}님\n`
    content += `문의주신 내용 잘 받아보았습니다.\n\n`

    // 티켓 답변
    if (ticketReply) {
      content += `[티켓 답변]\n`
      content += `${ticketReply}\n\n`
    }

    // 자동답변 (알림 메시지)
    if (notifications.length > 0) {
      content += `[자동답변]\n`
      notifications.forEach((notif) => {
        content += `${notif.message}\n`
      })
      content += `\n`
    }

    // 공지사항
    if (notices.length > 0) {
      notices.forEach((notice) => {
        content += `${notice.content}\n\n`
      })
    }

    // 마무리
    content += `감사합니다.`

    return { header, content }
  }

  const handlePrintAll = () => {
    setPrintMode(true)
    setTimeout(() => {
      window.print()
      setPrintMode(false)
    }, 100)
  }

  const handleMarkAsSent = async (reply: DailyReply) => {
    try {
      const notificationIds = reply.notifications.map((n) => n.id)
      if (notificationIds.length === 0) return

      const response = await fetch("/api/notifications/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationIds,
          taskId: reply.taskId,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "전송 완료 처리에 실패했습니다.")
      }

      // 목록 새로고침
      loadDailyReplies()
    } catch (error: any) {
      console.error("Error marking as sent:", error)
      alert(error.message || "전송 완료 처리에 실패했습니다.")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>로딩 중...</div>
      </div>
    )
  }

  return (
    <div className={`container mx-auto p-6 space-y-6 ${printMode ? "print-mode" : ""}`}>
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">일일 티켓 답변</h1>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Label htmlFor="date">날짜</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40"
            />
          </div>
          {replies.length > 0 && (
            <Button onClick={handlePrintAll}>일괄 출력</Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {replies.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-gray-500">해당 날짜에 답변이 필요한 티켓이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {replies.map((reply, index) => {
            const { header, content } = formatReply(reply)
            return (
              <Card key={reply.taskId} className={`${printMode ? "break-inside-avoid" : ""}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>티켓 #{reply.ticketNo || "N/A"}</CardTitle>
                      <CardDescription>{reply.customer.name}</CardDescription>
                    </div>
                    {!printMode && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkAsSent(reply)}
                        disabled={reply.notifications.length === 0}
                      >
                        전송 완료
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* 주소 정보 */}
                    <div className="font-semibold text-sm text-gray-700">{header}</div>

                    {/* 답변 내용 */}
                    <div className="whitespace-pre-wrap text-sm border-t pt-4">{content}</div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <style jsx global>{`
        @media print {
          .print-mode .no-print {
            display: none;
          }
          .print-mode .break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  )
}
