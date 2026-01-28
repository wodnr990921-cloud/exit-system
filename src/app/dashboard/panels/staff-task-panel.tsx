"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { Plus, ListChecks, Clock, CheckCircle2 } from "lucide-react"

interface Task {
  id: string
  ticket_no: string
  status: string
  customer: {
    name: string
    member_number: string
  }
  description: string
  created_at: string
}

interface StaffTaskPanelProps {
  userId?: string
  role?: string
}

export default function StaffTaskPanel({ userId, role }: StaffTaskPanelProps) {
  const router = useRouter()
  const supabase = createClient()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    processing: 0,
    pending: 0,
    completed: 0
  })

  useEffect(() => {
    if (userId) {
      fetchMyTasks()
    }
  }, [userId])

  const fetchMyTasks = async () => {
    try {
      // Fetch tasks assigned to this user
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id,
          ticket_no,
          status,
          description,
          created_at,
          customer:customers(
            name,
            member_number
          )
        `)
        .eq("assignee_id", userId)
        .neq("status", "closed")
        .order("created_at", { ascending: false })
        .limit(10)

      if (error) throw error

      // Transform data to match Task interface (customer is returned as array by Supabase)
      const taskData = (data || []).map((task: any) => ({
        ...task,
        customer: Array.isArray(task.customer) ? task.customer[0] : task.customer
      }))
      setTasks(taskData)

      // Calculate stats
      const processing = taskData.filter((t: any) => t.status === "processing").length
      const pending = taskData.filter((t: any) => t.status === "pending").length
      const completed = taskData.filter((t: any) => t.status === "processed").length

      setStats({ processing, pending, completed })
    } catch (error) {
      console.error("Failed to fetch tasks:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "processing":
        return "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
      case "pending":
        return "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800"
      case "processed":
        return "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
      default:
        return "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "processing":
        return "처리 중"
      case "pending":
        return "대기 중"
      case "processed":
        return "완료"
      default:
        return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "processing":
        return <Clock className="w-3 h-3" />
      case "pending":
        return <ListChecks className="w-3 h-3" />
      case "processed":
        return <CheckCircle2 className="w-3 h-3" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-gray-500">로딩 중...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>내 작업 현황</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* 좌측: 빠른 작업 등록 */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-700 dark:text-gray-300">빠른 작업 등록</h4>
            <Button
              onClick={() => router.push("/dashboard/reception")}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              신규 티켓 작성
            </Button>
            <Button
              onClick={() => router.push("/dashboard/intake")}
              variant="outline"
              className="w-full font-medium"
            >
              <ListChecks className="w-4 h-4 mr-2" />
              내 작업 목록
            </Button>

            {/* 작업 통계 */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">처리 중</p>
              </div>
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded text-center">
                <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">대기 중</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-center">
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">완료</p>
              </div>
            </div>
          </div>

          {/* 우측: 작업 현황 */}
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-700 dark:text-gray-300">최근 작업</h4>

            {tasks.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400 border border-dashed rounded">
                배정된 작업이 없습니다
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {tasks.slice(0, 5).map((task: any) => (
                  <div
                    key={task.id}
                    className={`p-3 rounded border cursor-pointer hover:opacity-80 transition ${getStatusColor(task.status)}`}
                    onClick={() => router.push(`/dashboard/intake`)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">
                        {task.customer?.name || "미지정"}
                      </span>
                      <span className="text-xs flex items-center gap-1">
                        {getStatusIcon(task.status)}
                        {getStatusLabel(task.status)}
                      </span>
                    </div>
                    <p className="text-xs opacity-75">
                      {task.ticket_no} | {task.customer?.member_number}
                    </p>
                    {task.description && (
                      <p className="text-xs mt-1 line-clamp-1">{task.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tasks.length > 5 && (
              <Button
                variant="link"
                className="w-full text-sm"
                onClick={() => router.push("/dashboard/intake")}
              >
                모든 작업 보기 ({tasks.length}건)
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
