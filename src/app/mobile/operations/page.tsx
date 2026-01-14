"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, DollarSign, ClipboardCheck, Calculator, Package, AlertTriangle } from "lucide-react"

export default function MobileOperationsPage() {
  const router = useRouter()

  const operations = [
    {
      title: "재무관리",
      description: "입출금 및 재무 현황",
      icon: DollarSign,
      path: "/dashboard/finance",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "일일 마감",
      description: "일일 업무 마감 처리",
      icon: ClipboardCheck,
      path: "/dashboard/closing",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "월말 정산",
      description: "월별 정산 및 통계",
      icon: Calculator,
      path: "/dashboard/settlements",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "소모품 재고",
      description: "재고 관리 및 현황",
      icon: Package,
      path: "/dashboard/inventory",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "포인트 부채",
      description: "음수 포인트 관리",
      icon: AlertTriangle,
      path: "/dashboard/operations",
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">업무 관리</h1>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 pb-20">
        <div className="space-y-3">
          {operations.map((operation) => {
            const Icon = operation.icon
            return (
              <Card
                key={operation.path}
                className="cursor-pointer active:bg-gray-50"
                onClick={() => router.push(operation.path)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${operation.bgColor}`}>
                      <Icon className={`h-6 w-6 ${operation.color}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{operation.title}</h3>
                      <p className="text-sm text-gray-600">{operation.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">안내</CardTitle>
            <CardDescription>
              업무 관리 기능은 PC 화면에 최적화되어 있습니다. 모바일에서는 기본 기능만 사용 가능합니다.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    </div>
  )
}
