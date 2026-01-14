"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Coins, Archive } from "lucide-react"

// 기존 페이지 컴포넌트들을 동적으로 import
import dynamic from "next/dynamic"

const PointsContent = dynamic(() => import("../points/points-client"), {
  loading: () => <div className="p-6">포인트 내역 로딩 중...</div>,
  ssr: false,
})

const DormantPointsContent = dynamic(() => import("../dormant-points/dormant-points-client"), {
  loading: () => <div className="p-6">휴면 포인트 로딩 중...</div>,
  ssr: false,
})

export default function PointsManagementClient() {
  const [activeTab, setActiveTab] = useState("points")

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">포인트관리</h1>
          <p className="text-muted-foreground mt-1">
            포인트 지급/사용내역 및 휴면 포인트 통합 관리
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="points" className="gap-2">
            <Coins className="h-4 w-4" />
            <span>포인트 내역</span>
          </TabsTrigger>
          <TabsTrigger value="dormant" className="gap-2">
            <Archive className="h-4 w-4" />
            <span>휴면 포인트</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="points" className="space-y-4">
          <Card>
            <PointsContent />
          </Card>
        </TabsContent>

        <TabsContent value="dormant" className="space-y-4">
          <Card>
            <DormantPointsContent />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
