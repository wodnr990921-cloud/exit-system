"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Lock, Briefcase, DollarSign, FileText, CalendarDays, Moon, Package, Home } from "lucide-react"
import dynamic from "next/dynamic"

// 동적 임포트 (기존 컴포넌트 재사용)
const FinanceContent = dynamic(() => import("../finance/finance-client"), {
  loading: () => <div className="p-6">재무관리 로딩 중...</div>,
  ssr: false,
})

const ClosingContent = dynamic(() => import("../closing/closing-client"), {
  loading: () => <div className="p-6">일일 마감 로딩 중...</div>,
  ssr: false,
})

const SettlementsContent = dynamic(() => import("../settlements/settlements-client"), {
  loading: () => <div className="p-6">월말 정산 로딩 중...</div>,
  ssr: false,
})

const DormantPointsContent = dynamic(() => import("../dormant-points/dormant-points-client"), {
  loading: () => <div className="p-6">휴면 포인트 로딩 중...</div>,
  ssr: false,
})

const InventoryContent = dynamic(() => import("../inventory/inventory-client"), {
  loading: () => <div className="p-6">소모품 재고 로딩 중...</div>,
  ssr: false,
})

export default function OperationsClient() {
  const router = useRouter()
  const { role, loading: permissionsLoading, hasPermission } = usePermissions()
  const [activeTab, setActiveTab] = useState("finance")

  if (permissionsLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!hasPermission("admin")) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertTitle>접근 거부</AlertTitle>
          <AlertDescription>
            이 페이지는 관리자만 접근할 수 있습니다.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Briefcase className="h-8 w-8 text-emerald-600" />
            업무관리
          </h1>
          <p className="text-muted-foreground mt-2">
            재무, 마감, 정산, 포인트, 재고를 한 곳에서 관리합니다
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
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="finance" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">재무관리</span>
            <span className="sm:hidden">재무</span>
          </TabsTrigger>
          <TabsTrigger value="closing" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">일일 마감</span>
            <span className="sm:hidden">마감</span>
          </TabsTrigger>
          <TabsTrigger value="settlements" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">월말 정산</span>
            <span className="sm:hidden">정산</span>
          </TabsTrigger>
          <TabsTrigger value="dormant" className="flex items-center gap-2">
            <Moon className="h-4 w-4" />
            <span className="hidden sm:inline">휴면 포인트</span>
            <span className="sm:hidden">휴면</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">소모품 재고</span>
            <span className="sm:hidden">재고</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="finance" className="space-y-6">
          <Card>
            <FinanceContent />
          </Card>
        </TabsContent>

        <TabsContent value="closing" className="space-y-6">
          <Card>
            <ClosingContent />
          </Card>
        </TabsContent>

        <TabsContent value="settlements" className="space-y-6">
          <Card>
            <SettlementsContent />
          </Card>
        </TabsContent>

        <TabsContent value="dormant" className="space-y-6">
          <Card>
            <DormantPointsContent />
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6">
          <Card>
            <InventoryContent />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
