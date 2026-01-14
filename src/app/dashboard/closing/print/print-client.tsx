"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface Task {
  id: string
  ticket_no: string | null
  member_id: string | null
  reply_content: string | null
  closed_at: string | null
  customer: {
    id: string
    name: string
    member_number: string
    institution: string | null
    prison_number: string | null
    mailbox_address: string | null
  } | null
}

export default function PrintClient() {
  const router = useRouter()
  const supabase = createClient()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [printMode, setPrintMode] = useState(false)

  useEffect(() => {
    loadClosedTasks()
  }, [])

  const loadClosedTasks = async () => {
    setLoading(true)
    try {
      // 오늘 마감된 티켓 조회
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data, error } = await supabase
        .from("tasks")
        .select(
          `
          id,
          ticket_no,
          member_id,
          reply_content,
          closed_at,
          customer:customers!tasks_member_id_fkey (
            id,
            name,
            member_number,
            institution,
            prison_number,
            mailbox_address
          )
        `
        )
        .eq("status", "closed")
        .gte("closed_at", today.toISOString())
        .lt("closed_at", tomorrow.toISOString())
        .order("closed_at", { ascending: true })

      if (error) throw error
      
      // 데이터 변환: customer가 배열인 경우 첫 번째 요소 사용
      const transformedData = (data || []).map((task: any) => ({
        ...task,
        customer: Array.isArray(task.customer) ? task.customer[0] : task.customer,
      }))
      
      setTasks(transformedData)
    } catch (error: any) {
      console.error("Error loading closed tasks:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTasks(newSelected)
  }

  const selectAll = () => {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set())
    } else {
      setSelectedTasks(new Set(tasks.map((t) => t.id)))
    }
  }

  const handlePrint = () => {
    if (selectedTasks.size === 0) {
      alert("출력할 티켓을 선택해주세요.")
      return
    }

    setPrintMode(true)
    setTimeout(() => {
      window.print()
      setPrintMode(false)
    }, 100)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return ""
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  const selectedTasksList = tasks.filter((t) => selectedTasks.has(t.id))

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
        <div className="max-w-7xl mx-auto flex items-center justify-center h-64">
          <div className="text-gray-600 dark:text-gray-400">로딩 중...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-950 p-8 ${printMode ? "print-mode" : ""}`}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 (인쇄 시 숨김) */}
        {!printMode && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => router.back()} className="border-gray-300 dark:border-gray-700">
                  ← 뒤로가기
                </Button>
                <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")} className="border-gray-300 dark:border-gray-700">
                  홈
                </Button>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">일괄 출력</h1>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={selectAll} className="border-gray-300 dark:border-gray-700">
                  {selectedTasks.size === tasks.length ? "전체 해제" : "전체 선택"}
                </Button>
                <Button onClick={handlePrint} disabled={selectedTasks.size === 0} className="bg-blue-600 hover:bg-blue-700 text-white">
                  선택 항목 출력 ({selectedTasks.size}건)
                </Button>
              </div>
            </div>

            {/* 티켓 선택 목록 */}
            <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader>
                <CardTitle>마감된 티켓 목록</CardTitle>
                <CardDescription>오늘 마감된 티켓 중 출력할 항목을 선택하세요 ({tasks.length}건)</CardDescription>
              </CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    오늘 마감된 티켓이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <Checkbox
                          id={task.id}
                          checked={selectedTasks.has(task.id)}
                          onCheckedChange={() => toggleTaskSelection(task.id)}
                        />
                        <Label htmlFor={task.id} className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-50">
                                {task.ticket_no || task.id.substring(0, 8).toUpperCase()}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {task.customer?.name || "회원 정보 없음"} ({task.customer?.member_number || "-"})
                              </div>
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-500">
                              {formatDate(task.closed_at)}
                            </div>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* 인쇄용 답장 내용 */}
        {printMode && selectedTasksList.length > 0 && (
          <div className="space-y-8">
            {selectedTasksList.map((task) => {
              if (!task.customer || !task.reply_content) return null

              const header = [
                task.customer.institution || "",
                task.customer.mailbox_address || "",
                task.customer.prison_number || "",
                task.customer.name,
              ]
                .filter(Boolean)
                .join(" ")

              return (
                <div key={task.id} className="p-12 bg-white dark:bg-gray-900 break-inside-avoid page-break">
                  {/* 상단: 수용자 정보 */}
                  <div className="mb-8 pb-4 border-b-2 border-gray-300 dark:border-gray-700">
                    <div className="text-base font-semibold text-gray-900 dark:text-gray-50">
                      수신: {header}
                    </div>
                    {task.ticket_no && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        티켓번호: {task.ticket_no}
                      </div>
                    )}
                  </div>

                  {/* 인사말 */}
                  <div className="mb-6 text-lg font-medium text-gray-900 dark:text-gray-50">
                    안녕하세요, {task.customer.name}님.
                  </div>
                  <div className="mb-8 text-base text-gray-800 dark:text-gray-200 leading-relaxed">
                    보내주신 문의사항과 요청 내용을 잘 받아보았습니다.
                  </div>

                  {/* 본문: 답장 내용 */}
                  <div className="mb-10 text-base text-gray-800 dark:text-gray-200 leading-loose whitespace-pre-wrap">
                    {task.reply_content}
                  </div>

                  {/* 하단: 마무리 */}
                  <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="mb-4 text-base text-gray-800 dark:text-gray-200">
                      항상 건강하시고, 필요하신 사항이 있으시면 언제든 말씀해 주시기 바랍니다.
                    </div>
                    <div className="text-base font-medium text-gray-900 dark:text-gray-50">
                      감사합니다.
                    </div>
                    <div className="mt-6 text-right text-sm text-gray-600 dark:text-gray-400">
                      {new Date().toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          .print-mode {
            padding: 0;
          }
          .print-mode > div {
            max-width: 100%;
          }
          .page-break {
            page-break-after: always;
            page-break-inside: avoid;
          }
          .page-break:last-child {
            page-break-after: auto;
          }
          @page {
            margin: 2cm;
            size: A4;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  )
}