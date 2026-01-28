"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PendingItem {
  id: string
  type: "point" | "task"
  customer_name: string
  member_number: string
  description: string
  amount: number
  created_at: string
  category?: string
}

export default function AdminApprovalPanel() {
  const supabase = createClient()
  const { toast } = useToast()
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [riskLevel, setRiskLevel] = useState<"low" | "medium" | "high">("low")

  useEffect(() => {
    fetchPendingItems()
  }, [])

  const fetchPendingItems = async () => {
    try {
      // Fetch pending point transactions
      const { data: points, error: pointsError } = await supabase
        .from("points")
        .select(`
          id,
          amount,
          category,
          type,
          created_at,
          customer:customers!inner(
            name,
            member_number
          )
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10)

      if (pointsError) throw pointsError

      // Fetch processed tasks awaiting approval
      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select(`
          id,
          ticket_no,
          total_amount,
          description,
          created_at,
          customer:customers!inner(
            name,
            member_number
          )
        `)
        .eq("status", "processed")
        .order("created_at", { ascending: false })
        .limit(10)

      if (tasksError) throw tasksError

      // Combine and format data
      const pointItems: PendingItem[] = (points || []).map((p: any) => ({
        id: p.id,
        type: "point" as const,
        customer_name: p.customer?.name || "미지정",
        member_number: p.customer?.member_number || "",
        description: `${p.type === "charge" ? "포인트 충전" : "포인트 사용"} (${p.category})`,
        amount: p.amount,
        created_at: p.created_at,
        category: p.category
      }))

      const taskItems: PendingItem[] = (tasks || []).map((t: any) => ({
        id: t.id,
        type: "task" as const,
        customer_name: t.customer?.name || "미지정",
        member_number: t.customer?.member_number || "",
        description: t.description || t.ticket_no,
        amount: t.total_amount || 0,
        created_at: t.created_at
      }))

      const allItems = [...pointItems, ...taskItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setPendingItems(allItems)

      // Calculate risk level based on pending count and total amount
      const totalAmount = allItems.reduce((sum, item) => sum + item.amount, 0)
      if (allItems.length > 10 || totalAmount > 5000000) {
        setRiskLevel("high")
      } else if (allItems.length > 5 || totalAmount > 2000000) {
        setRiskLevel("medium")
      } else {
        setRiskLevel("low")
      }
    } catch (error) {
      console.error("Failed to fetch pending items:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (item: PendingItem) => {
    try {
      if (item.type === "point") {
        const { error } = await supabase
          .from("points")
          .update({ status: "approved" })
          .eq("id", item.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from("tasks")
          .update({
            status: "closed",
            closed_at: new Date().toISOString()
          })
          .eq("id", item.id)

        if (error) throw error
      }

      toast({
        title: "승인 완료",
        description: `${item.customer_name}님의 ${item.description}을(를) 승인했습니다.`,
      })

      // Refresh list
      fetchPendingItems()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "승인 실패",
        description: error.message || "승인 중 오류가 발생했습니다.",
      })
    }
  }

  const handleReject = async (item: PendingItem) => {
    try {
      if (item.type === "point") {
        const { error } = await supabase
          .from("points")
          .update({ status: "rejected" })
          .eq("id", item.id)

        if (error) throw error
      } else {
        // For tasks, we might want to revert to "processing" status
        const { error } = await supabase
          .from("tasks")
          .update({ status: "processing" })
          .eq("id", item.id)

        if (error) throw error
      }

      toast({
        title: "반려 완료",
        description: `${item.customer_name}님의 ${item.description}을(를) 반려했습니다.`,
        variant: "destructive",
      })

      // Refresh list
      fetchPendingItems()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "반려 실패",
        description: error.message || "반려 중 오류가 발생했습니다.",
      })
    }
  }

  const getRiskBadgeColor = () => {
    switch (riskLevel) {
      case "high":
        return "destructive"
      case "medium":
        return "default"
      default:
        return "secondary"
    }
  }

  const getRiskLabel = () => {
    switch (riskLevel) {
      case "high":
        return "높음"
      case "medium":
        return "보통"
      default:
        return "낮음"
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>승인 관리</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              이체 대기: {pendingItems.length}건 | 위험도:{" "}
              <Badge variant={getRiskBadgeColor()}>{getRiskLabel()}</Badge>
            </CardDescription>
          </div>
          {pendingItems.length > 5 && (
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {pendingItems.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 border border-dashed rounded">
            승인 대기 건이 없습니다
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {pendingItems.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center justify-between p-3 border rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm truncate">{item.customer_name}</p>
                    <Badge variant="outline" className="text-xs">
                      {item.member_number}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {item.description}
                  </p>
                  <p className="text-sm font-semibold text-blue-600 mt-1">
                    ₩{item.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(item.created_at).toLocaleString("ko-KR")}
                  </p>
                </div>
                <div className="flex gap-2 ml-3">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(item)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    승인
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(item)}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    반려
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
