"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search, UserPlus } from "lucide-react"

interface Customer {
  id: string
  member_number: string
  name: string
  institution: string | null
  prison_number: string | null
  total_point_general: number
  total_point_betting: number
  created_at: string
}

export default function MobileMembersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error("Error loading customers:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.member_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.prison_number?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">회원 관리</h1>
        </div>

        {/* Search Bar */}
        <div className="p-4 pt-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="회원명, 회원번호, 수용번호 검색..."
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
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">회원이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCustomers.map((customer) => (
              <Card
                key={customer.id}
                className="cursor-pointer active:bg-gray-50"
                onClick={() => router.push(`/mobile/members/${customer.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 mb-1">{customer.name}</p>
                      <p className="text-sm text-gray-600">{customer.member_number}</p>
                    </div>
                  </div>
                  {customer.institution && (
                    <div className="text-sm text-gray-600 mb-2">
                      <span>{customer.institution}</span>
                      {customer.prison_number && (
                        <>
                          <span className="text-gray-400 mx-2">·</span>
                          <span>{customer.prison_number}</span>
                        </>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      일반 {customer.total_point_general.toLocaleString()}P
                    </Badge>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      배팅 {customer.total_point_betting.toLocaleString()}P
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <Button
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
        onClick={() => router.push("/mobile/members/new")}
      >
        <UserPlus className="h-6 w-6" />
      </Button>
    </div>
  )
}
