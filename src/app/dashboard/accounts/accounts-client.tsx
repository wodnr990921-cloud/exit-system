"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AccountsClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => router.back()}>
            ← 뒤로가기
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            홈
          </Button>
          <h1 className="text-3xl font-bold">계좌관리</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>계좌관리</CardTitle>
            <CardDescription>계좌 정보를 관리합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center p-8 text-gray-500">
              계좌관리 기능은 추후 구현 예정입니다.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
