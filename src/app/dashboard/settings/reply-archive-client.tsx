"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, Search, FileText, Download } from "lucide-react"

interface Reply {
  id: string
  description: string
  created_at: string
  status: string
  task: {
    ticket_no: string
    customer: {
      name: string
      member_number: string
      address: string
    } | null
  } | null
}

interface GroupedReplies {
  [date: string]: Reply[]
}

export default function ReplyArchiveClient() {
  const [replies, setReplies] = useState<Reply[]>([])
  const [groupedReplies, setGroupedReplies] = useState<GroupedReplies>({})
  const [loading, setLoading] = useState(true)
  const [searchDate, setSearchDate] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    loadReplies()
  }, [])

  const loadReplies = async () => {
    setLoading(true)
    try {
      console.log("📋 답변 보관함 로딩 중...")
      
      let query = supabase
        .from("task_items")
        .select(`
          id,
          description,
          created_at,
          status,
          task_id,
          tasks!inner(
            ticket_no,
            customers(name, member_number, address)
          )
        `)
        .eq("category", "inquiry")
        .order("created_at", { ascending: false })

      // Apply date filters if set
      if (startDate) {
        query = query.gte("created_at", new Date(startDate).toISOString())
      }
      if (endDate) {
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        query = query.lte("created_at", endDateTime.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      console.log("✅ 답변 로딩 완료:", data?.length || 0, "개")
      console.log("📊 Raw data sample:", data?.[0])
      
      // Normalize Supabase nested query result (handle both array and object responses)
      const normalizedData: Reply[] = (data || []).map((item: any) => {
        // Handle tasks relationship (could be array or object)
        let taskData = null
        if (item.tasks) {
          const task = Array.isArray(item.tasks) ? item.tasks[0] : item.tasks
          if (task) {
            // Handle customers relationship
            const customer = task.customers 
              ? (Array.isArray(task.customers) ? task.customers[0] : task.customers)
              : null
            
            taskData = {
              ticket_no: task.ticket_no || "N/A",
              customer: customer ? {
                name: customer.name || "미등록",
                member_number: customer.member_number || "-",
                address: customer.address || "주소 없음"
              } : null
            }
          }
        }
        
        return {
          id: item.id,
          description: item.description || "",
          created_at: item.created_at,
          status: item.status || "pending",
          task: taskData
        }
      })
      
      setReplies(normalizedData)
      
      // Group by date
      const grouped: GroupedReplies = {}
      normalizedData.forEach((reply) => {
        const date = new Date(reply.created_at).toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric"
        })
        if (!grouped[date]) {
          grouped[date] = []
        }
        grouped[date].push(reply)
      })
      
      setGroupedReplies(grouped)
    } catch (error: any) {
      console.error("❌ 답변 로딩 오류:", error)
      toast({
        variant: "destructive",
        title: "오류",
        description: error.message || "답변을 불러오는데 실패했습니다.",
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePrintDate = (date: string, dateReplies: Reply[]) => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast({
        title: "오류",
        description: "팝업이 차단되었습니다. 팝업 차단을 해제해주세요.",
        variant: "destructive",
      })
      return
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${date} 답변 출력</title>
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
    .reply-item {
      margin-bottom: 40px;
      padding: 20px;
      border: 2px solid #ddd;
      border-radius: 8px;
      background: #f9f9f9;
    }
    .recipient-address {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 15px;
      padding: 10px;
      background: #fff;
      border-left: 4px solid #4CAF50;
    }
    .reply-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #ddd;
    }
    .ticket-info {
      font-weight: bold;
      color: #333;
    }
    .customer-info {
      color: #666;
      font-size: 14px;
    }
    .date {
      color: #999;
      font-size: 12px;
    }
    .reply-content {
      line-height: 1.8;
      font-size: 14px;
      white-space: pre-wrap;
      padding: 15px;
      background: white;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📮 ${date} 답변 출력</h1>
    <p>출력 일시: ${new Date().toLocaleString("ko-KR")}</p>
    <p>총 ${dateReplies.length}건</p>
  </div>
  ${dateReplies
    .map(
      (item: any, index: number) => `
    <div class="reply-item ${index < dateReplies.length - 1 ? "page-break" : ""}">
      <div class="recipient-address">
        ${item.task?.customer?.address || "주소 없음"} ${item.task?.customer?.name || "미등록"}
      </div>
      <div class="reply-header">
        <div>
          <div class="ticket-info">티켓 #${item.task?.ticket_no || "N/A"}</div>
          <div class="customer-info">${item.task?.customer?.name || "미등록"} (${item.task?.customer?.member_number || "-"})</div>
        </div>
        <div class="date">${new Date(item.created_at).toLocaleString("ko-KR")}</div>
      </div>
      <div class="reply-content">${item.description || ""}</div>
    </div>
  `
    )
    .join("")}
</body>
</html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
    
    setTimeout(() => {
      printWindow.print()
      toast({
        title: "📄 출력 준비 완료",
        description: `${date} 답변 ${dateReplies.length}건을 출력합니다.\n💡 인쇄 대화상자에서 "PDF로 저장"을 선택하세요.`,
      })
    }, 250)
  }

  const handleExportAll = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast({
        title: "오류",
        description: "팝업이 차단되었습니다.",
        variant: "destructive",
      })
      return
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>답변 보관함 전체 출력</title>
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
    .date-section {
      margin: 30px 0;
      padding: 15px;
      background: #e3f2fd;
      border-left: 5px solid #2196F3;
      font-size: 20px;
      font-weight: bold;
    }
    .reply-item {
      margin-bottom: 30px;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: #f9f9f9;
    }
    .recipient-address {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 10px;
      padding: 8px;
      background: #fff;
      border-left: 4px solid #4CAF50;
    }
    .reply-content {
      line-height: 1.8;
      font-size: 13px;
      white-space: pre-wrap;
      padding: 10px;
      background: white;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📮 답변 보관함 전체 출력</h1>
    <p>출력 일시: ${new Date().toLocaleString("ko-KR")}</p>
    <p>총 ${replies.length}건</p>
  </div>
  ${Object.entries(groupedReplies)
    .map(
      ([date, dateReplies]) => `
    <div class="date-section">📅 ${date} (${dateReplies.length}건)</div>
    ${dateReplies
      .map(
        (item: any) => `
      <div class="reply-item">
        <div class="recipient-address">
          ${item.task?.customer?.address || "주소 없음"} ${item.task?.customer?.name || "미등록"}
        </div>
        <div style="margin-bottom: 10px; color: #666; font-size: 12px;">
          티켓 #${item.task?.ticket_no || "N/A"} | ${new Date(item.created_at).toLocaleString("ko-KR")}
        </div>
        <div class="reply-content">${item.description || ""}</div>
      </div>
    `
      )
      .join("")}
  `
    )
    .join("")}
</body>
</html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
    
    setTimeout(() => {
      printWindow.print()
      toast({
        title: "📄 전체 출력 준비 완료",
        description: `총 ${replies.length}건의 답변을 출력합니다.\n💡 PDF로 저장하려면 인쇄 대화상자에서 "PDF로 저장"을 선택하세요.`,
      })
    }, 250)
  }

  return (
    <div className="space-y-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          답변 보관함
        </CardTitle>
        <CardDescription>
          저장된 모든 답변을 날짜별로 확인하고 출력할 수 있습니다.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* 검색 필터 */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Label htmlFor="startDate">시작일</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="endDate">종료일</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <Button onClick={loadReplies} className="bg-blue-600 hover:bg-blue-700">
            <Search className="w-4 h-4 mr-2" />
            검색
          </Button>
          <Button 
            onClick={handleExportAll} 
            variant="outline"
            disabled={replies.length === 0}
            className="bg-green-50 hover:bg-green-100 border-green-500 text-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            전체 PDF 출력
          </Button>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {replies.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  총 답변 수
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {Object.keys(groupedReplies).length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  날짜 수
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-200 dark:border-purple-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {replies.filter(r => r.status === "approved").length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  승인된 답변
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 날짜별 답변 목록 */}
        {loading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            로딩 중...
          </div>
        ) : Object.keys(groupedReplies).length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
            <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">보관된 답변이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedReplies).map(([date, dateReplies]) => (
              <Card key={date} className="border-2 border-blue-200 dark:border-blue-800">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      {date}
                      <span className="text-sm font-normal text-gray-600 dark:text-gray-400">
                        ({dateReplies.length}건)
                      </span>
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePrintDate(date, dateReplies)}
                      className="bg-white dark:bg-gray-800 hover:bg-green-50 border-green-500 text-green-700"
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      이 날짜 PDF 출력
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {dateReplies.map((reply, index) => (
                      <div 
                        key={reply.id}
                        className="flex gap-3 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                      >
                        {/* 아바타 */}
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                            {index + 1}
                          </div>
                        </div>
                        
                        {/* 답변 내용 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                              {reply.task?.customer?.name || "미등록"} ({reply.task?.customer?.member_number || "-"})
                            </span>
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold">
                              #{reply.task?.ticket_no || "N/A"}
                            </span>
                            {reply.status === "approved" && (
                              <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-semibold">
                                ✅ 승인
                              </span>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                              {new Date(reply.created_at).toLocaleTimeString("ko-KR", {
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                            {reply.description}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            {reply.task?.customer?.address && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                📍 {reply.task.customer.address}
                              </span>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                              {reply.description.length}자
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </div>
  )
}
