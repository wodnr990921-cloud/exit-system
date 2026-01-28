"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertTriangle,
  Clock,
  FileText,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { useRouter } from "next/navigation"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface UnprocessedTicket {
  id: string
  ticket_no: string
  title: string
  status: string
  customer_name: string
  member_number: string
  total_amount: number
  created_at: string
  ai_summary: string | null
  assigned_to_name: string | null
}

interface UnprocessedTicketsAlertProps {
  userRole: string
  userId: string
}

export default function UnprocessedTicketsAlert({
  userRole,
  userId,
}: UnprocessedTicketsAlertProps) {
  const router = useRouter()
  const supabase = createClient()

  const [tickets, setTickets] = useState<UnprocessedTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  useEffect(() => {
    loadUnprocessedTickets()

    // 자동 새로고침 (30초마다)
    const interval = setInterval(() => {
      loadUnprocessedTickets()
    }, 30000)

    return () => clearInterval(interval)
  }, [userId, userRole])

  const loadUnprocessedTickets = async () => {
    try {
      setLoading(true)

      // 미처리 상태: pending, approved, processing
      const unprocessedStatuses = ["pending", "approved", "processing"]

      let query = supabase
        .from("tasks")
        .select(`
          id,
          ticket_no,
          title,
          status,
          total_amount,
          created_at,
          ai_summary,
          customer:customers!tasks_customer_id_fkey(name, member_number),
          assigned_user:users!tasks_assigned_to_fkey(name)
        `)
        .in("status", unprocessedStatuses)
        .order("created_at", { ascending: true })

      // 직원은 자신에게 배정된 티켓만 표시
      if (userRole === "staff") {
        query = query.eq("assigned_to", userId)
      }

      const { data, error } = await query

      if (error) throw error

      // 데이터 변환
      const ticketsData = (data || []).map((item: any) => ({
        id: item.id,
        ticket_no: item.ticket_no,
        title: item.title || "제목 없음",
        status: item.status,
        customer_name: item.customer?.name || "알 수 없음",
        member_number: item.customer?.member_number || "N/A",
        total_amount: item.total_amount || 0,
        created_at: item.created_at,
        ai_summary: item.ai_summary,
        assigned_to_name: item.assigned_user?.name,
      }))

      setTickets(ticketsData)
      setLastRefresh(new Date())
    } catch (error) {
      console.error("Error loading unprocessed tickets:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffHours < 1) {
      return "방금 전"
    } else if (diffHours < 24) {
      return `${diffHours}시간 전`
    } else {
      return date.toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-red-100 text-red-800 border-red-300"
      case "approved":
        return "bg-yellow-100 text-yellow-800 border-yellow-300"
      case "processing":
        return "bg-blue-100 text-blue-800 border-blue-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "승인 대기"
      case "approved":
        return "승인됨"
      case "processing":
        return "처리 중"
      default:
        return status
    }
  }

  const handleTicketClick = (ticketId: string) => {
    router.push(`/dashboard/intake?ticketId=${ticketId}`)
  }

  if (loading) {
    return (
      <Alert className="border-gray-300">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <AlertTitle>미처리 티켓 확인 중...</AlertTitle>
        <AlertDescription>잠시만 기다려주세요</AlertDescription>
      </Alert>
    )
  }

  if (tickets.length === 0) {
    return (
      <Alert className="border-green-300 bg-green-50">
        <FileText className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">모든 티켓 처리 완료</AlertTitle>
        <AlertDescription className="text-green-700">
          미처리 티켓이 없습니다. 훌륭합니다!
        </AlertDescription>
      </Alert>
    )
  }

  // 긴급도 계산 (24시간 이상 경과한 티켓은 긴급)
  const urgentTickets = tickets.filter((ticket) => {
    const hoursAgo = (new Date().getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60)
    return hoursAgo >= 24
  })

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-red-300 shadow-lg">
        <CardHeader className="bg-red-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600 animate-pulse" />
              <div>
                <CardTitle className="text-red-900 flex items-center gap-2">
                  미처리 티켓 알림
                  <Badge variant="destructive" className="text-lg px-3 py-1">
                    {tickets.length}건
                  </Badge>
                  {urgentTickets.length > 0 && (
                    <Badge variant="destructive" className="bg-red-700 animate-pulse">
                      긴급 {urgentTickets.length}건
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-red-700">
                  처리가 필요한 티켓이 있습니다 | 마지막 확인: {lastRefresh.toLocaleTimeString("ko-KR")}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={loadUnprocessedTickets}
                variant="outline"
                size="sm"
                className="border-red-300"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                새로고침
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {tickets.map((ticket) => {
                const hoursAgo =
                  (new Date().getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60)
                const isUrgent = hoursAgo >= 24

                return (
                  <div
                    key={ticket.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                      isUrgent
                        ? "border-red-500 bg-red-50 hover:bg-red-100"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                    onClick={() => handleTicketClick(ticket.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant="outline"
                            className={`font-mono ${getStatusColor(ticket.status)}`}
                          >
                            {ticket.ticket_no}
                          </Badge>
                          <Badge variant="outline" className={getStatusColor(ticket.status)}>
                            {getStatusLabel(ticket.status)}
                          </Badge>
                          {isUrgent && (
                            <Badge variant="destructive" className="animate-pulse">
                              <Clock className="w-3 h-3 mr-1" />
                              긴급
                            </Badge>
                          )}
                        </div>

                        <h4 className="font-semibold text-lg mb-1">{ticket.title}</h4>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">회원:</span>{" "}
                            {ticket.customer_name} ({ticket.member_number})
                          </div>
                          <div>
                            <span className="font-medium">금액:</span>{" "}
                            {ticket.total_amount.toLocaleString()}원
                          </div>
                          <div>
                            <span className="font-medium">생성:</span> {formatDate(ticket.created_at)}
                          </div>
                          {ticket.assigned_to_name && (
                            <div>
                              <span className="font-medium">담당자:</span> {ticket.assigned_to_name}
                            </div>
                          )}
                        </div>

                        {ticket.ai_summary && (
                          <div className="mt-2 p-2 bg-gray-100 rounded text-sm text-gray-700 line-clamp-2">
                            {ticket.ai_summary}
                          </div>
                        )}
                      </div>

                      <Button variant="ghost" size="sm" className="ml-4">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
