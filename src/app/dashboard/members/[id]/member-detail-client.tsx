"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import MemberUnifiedView from "@/components/member-unified-view"

interface MemberDetailClientProps {
  memberId: string
}

export default function MemberDetailClient({ memberId }: MemberDetailClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const [customer, setCustomer] = useState<{
    id: string
    name: string
    member_number: string
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCustomer()
  }, [memberId])

  const loadCustomer = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, member_number")
        .eq("id", memberId)
        .single()

      if (error) throw error
      setCustomer(data)
    } catch (error) {
      console.error("Error loading customer:", error)
      // Redirect back if customer not found
      router.push("/dashboard/members")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>회원 정보 로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">회원을 찾을 수 없습니다</p>
          <Button onClick={() => router.push("/dashboard/members")}>
            목록으로 돌아가기
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/members")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            회원 목록
          </Button>
          <h1 className="text-2xl font-bold">회원 상세 정보</h1>
        </div>

        {/* Unified View */}
        <MemberUnifiedView
          customerId={customer.id}
          customerName={customer.name}
          memberNumber={customer.member_number}
        />
      </div>
    </div>
  )
}
