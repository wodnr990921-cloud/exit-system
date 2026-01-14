"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search, Plus } from "lucide-react"

interface Task {
  id: string
  ticket_no: string
  title: string
  status: string
  created_at: string
  customers: {
    name: string
    member_number: string
  } | null
}

export default function MobileTasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          customers (
            name,
            member_number
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error("Error loading tasks:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { label: string; className: string }> = {
      pending: { label: "대기", className: "bg-yellow-100 text-yellow-800" },
      processing: { label: "처리중", className: "bg-blue-100 text-blue-800" },
      processed: { label: "완료", className: "bg-green-100 text-green-800" },
      closed: { label: "마감", className: "bg-gray-100 text-gray-800" },
    }
    return styles[status] || { label: status, className: "bg-gray-100 text-gray-800" }
  }

  const filteredTasks = tasks.filter(
    (task) =>
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.ticket_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.customers?.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">업무 목록</h1>
        </div>

        {/* Search Bar */}
        <div className="p-4 pt-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="티켓번호, 제목, 회원명 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 pb-20">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">로딩 중...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">업무가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const statusBadge = getStatusBadge(task.status)
              return (
                <Card
                  key={task.id}
                  className="cursor-pointer active:bg-gray-50"
                  onClick={() => router.push(`/mobile/tasks/${task.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 mb-1">{task.title}</p>
                        <p className="text-sm text-gray-600">
                          {task.ticket_no || task.id.substring(0, 8).toUpperCase()}
                        </p>
                      </div>
                      <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
                    </div>
                    {task.customers && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">{task.customers.name}</span>
                        <span className="text-gray-400 mx-2">·</span>
                        <span>{task.customers.member_number}</span>
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-2">
                      {new Date(task.created_at).toLocaleString("ko-KR")}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <Button
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
        onClick={() => router.push("/mobile/tasks/new")}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  )
}
