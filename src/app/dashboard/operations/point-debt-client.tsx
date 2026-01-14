"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertTriangle, RefreshCcw, TrendingDown } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface CustomerDebt {
  id: string
  member_number: string
  name: string
  institution: string | null
  prison_number: string | null
  total_point_general: number
  total_point_betting: number
  total_deposit: number
  total_usage: number
  total_betting: number
  created_at: string
}

export default function PointDebtClient() {
  const supabase = createClient()
  const [debtors, setDebtors] = useState<CustomerDebt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalDebt, setTotalDebt] = useState({ general: 0, betting: 0, total: 0 })

  useEffect(() => {
    loadDebtors()
  }, [])

  const loadDebtors = async () => {
    try {
      setLoading(true)
      setError(null)

      // 포인트가 음수인 회원 조회
      const { data, error: fetchError } = await supabase
        .from("customers")
        .select("*")
        .or("total_point_general.lt.0,total_point_betting.lt.0")
        .order("total_point_general", { ascending: true })

      if (fetchError) throw fetchError

      setDebtors(data || [])

      // 총 부채 계산
      const generalDebt = (data || [])
        .filter(c => c.total_point_general < 0)
        .reduce((sum, c) => sum + Math.abs(c.total_point_general), 0)
      
      const bettingDebt = (data || [])
        .filter(c => c.total_point_betting < 0)
        .reduce((sum, c) => sum + Math.abs(c.total_point_betting), 0)

      setTotalDebt({
        general: generalDebt,
        betting: bettingDebt,
        total: generalDebt + bettingDebt,
      })
    } catch (err: any) {
      setError(err.message || "포인트 부채 목록을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString("ko-KR")
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR")
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            포인트 부채 관리
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            음수 포인트를 가진 회원 목록
          </p>
        </div>
        <Button onClick={loadDebtors} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 부채 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">일반 포인트 부채</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              -{formatNumber(totalDebt.general)}P
            </div>
            <p className="text-xs text-muted-foreground">
              {debtors.filter(c => c.total_point_general < 0).length}명
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">배팅 포인트 부채</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              -{formatNumber(totalDebt.betting)}P
            </div>
            <p className="text-xs text-muted-foreground">
              {debtors.filter(c => c.total_point_betting < 0).length}명
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 부채</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              -{formatNumber(totalDebt.total)}P
            </div>
            <p className="text-xs text-muted-foreground">
              전체 {debtors.length}명
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 부채 회원 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>부채 회원 목록</CardTitle>
          <CardDescription>포인트가 음수인 회원 목록입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : debtors.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">부채를 가진 회원이 없습니다.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>회원번호</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>기관</TableHead>
                    <TableHead>수용번호</TableHead>
                    <TableHead className="text-right">일반 포인트</TableHead>
                    <TableHead className="text-right">배팅 포인트</TableHead>
                    <TableHead className="text-right">총 입금액</TableHead>
                    <TableHead className="text-right">총 사용액</TableHead>
                    <TableHead>가입일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtors.map((debtor) => (
                    <TableRow key={debtor.id}>
                      <TableCell className="font-medium">
                        {debtor.member_number}
                      </TableCell>
                      <TableCell>{debtor.name}</TableCell>
                      <TableCell>{debtor.institution || "-"}</TableCell>
                      <TableCell>{debtor.prison_number || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={
                            debtor.total_point_general < 0
                              ? "bg-red-100 text-red-800 border-red-200"
                              : "bg-green-100 text-green-800 border-green-200"
                          }
                        >
                          {formatNumber(debtor.total_point_general)}P
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={
                            debtor.total_point_betting < 0
                              ? "bg-red-100 text-red-800 border-red-200"
                              : "bg-green-100 text-green-800 border-green-200"
                          }
                        >
                          {formatNumber(debtor.total_point_betting)}P
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(debtor.total_deposit)}원
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(debtor.total_usage)}원
                      </TableCell>
                      <TableCell>{formatDate(debtor.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
