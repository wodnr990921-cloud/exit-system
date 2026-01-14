"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, Trash2, CornerUpLeft, Home } from "lucide-react"
import dynamic from "next/dynamic"

// 동적 임포트 (기존 컴포넌트 재사용)
const IntakeContent = dynamic(() => import("../intake/intake-client"), {
  loading: () => <div className="p-6">내 작업 목록 로딩 중...</div>,
  ssr: false,
})

const DocumentRetentionContent = dynamic(() => import("../document-retention/document-retention-client"), {
  loading: () => <div className="p-6">원본 파기 로딩 중...</div>,
  ssr: false,
})

const ReturnsContent = dynamic(() => import("../returns/returns-client"), {
  loading: () => <div className="p-6">반송 처리 로딩 중...</div>,
  ssr: false,
})

export default function QAClient() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("intake")

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-blue-600" />
            문의/답변
          </h1>
          <p className="text-muted-foreground mt-2">
            작업 목록, 원본 파기, 반송 처리를 한 곳에서 관리합니다
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          홈으로
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="intake" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">내 작업 목록</span>
            <span className="sm:hidden">작업</span>
          </TabsTrigger>
          <TabsTrigger value="document" className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">원본 파기</span>
            <span className="sm:hidden">파기</span>
          </TabsTrigger>
          <TabsTrigger value="returns" className="flex items-center gap-2">
            <CornerUpLeft className="h-4 w-4" />
            <span className="hidden sm:inline">반송 처리</span>
            <span className="sm:hidden">반송</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="intake" className="space-y-6">
          <Card>
            <IntakeContent />
          </Card>
        </TabsContent>

        <TabsContent value="document" className="space-y-6">
          <Card>
            <DocumentRetentionContent />
          </Card>
        </TabsContent>

        <TabsContent value="returns" className="space-y-6">
          <Card>
            <ReturnsContent />
          </Card>
        </TabsContent>
      </Tabs>

      {/* 댓글(내부) vs 답글(회원) 구분 안내 */}
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-100 text-sm">
            💡 댓글과 답글 구분
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p>
            <strong>댓글 (Comment):</strong> 내부 직원 간 소통용 - 회원에게 보이지 않음
          </p>
          <p>
            <strong>답글 (Reply):</strong> 회원에게 발송되는 공식 답변
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
