"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  RefreshCw, 
  TrendingUp, 
  Calendar, 
  Trophy,
  CheckCircle2,
  Clock
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// sports_matches 테이블 타입
interface SportsMatch {
  id: string
  sport_key: string
  commence_time: string
  home_team: string
  away_team: string
  odds_home?: number
  odds_draw?: number
  odds_away?: number
  home_score?: number
  away_score?: number
  is_finished: boolean
  updated_at: string
}

export default function SportsDataClient() {
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const [matches, setMatches] = useState<SportsMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"all" | "live" | "finished">("all")
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    loadMatches()
    
    // 30초마다 자동 새로고침
    const interval = setInterval(loadMatches, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadMatches = async () => {
    try {
      const { data, error } = await supabase
        .from('sports_matches')
        .select('*')
        .order('commence_time', { ascending: true })

      if (error) throw error

      setMatches(data || [])
    } catch (error) {
      console.error("경기 데이터 로딩 오류:", error)
      toast({
        title: "데이터 로딩 실패",
        description: "경기 데이터를 불러올 수 없습니다.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/sync-sports')
      const data = await response.json()

      if (data.success) {
        toast({
          title: "동기화 완료",
          description: `${data.data.total}개 경기 업데이트 완료`,
        })
        await loadMatches()
      } else {
        toast({
          title: "동기화 실패",
          description: data.error || "동기화 중 오류가 발생했습니다.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "오류",
        description: "API 호출 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
    }
  }

  // 필터링된 경기 목록
  const filteredMatches = matches.filter((match) => {
    if (activeTab === "live") return !match.is_finished
    if (activeTab === "finished") return match.is_finished
    return true
  })

  // 통계
  const stats = {
    total: matches.length,
    live: matches.filter(m => !m.is_finished).length,
    finished: matches.filter(m => m.is_finished).length,
  }

  // 시간 포맷팅 (KST)
  const formatTime = (timeString: string) => {
    const date = new Date(timeString)
    return date.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // 종목 배지 색상
  const getSportBadgeColor = (sportKey: string) => {
    if (sportKey.includes('soccer')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    if (sportKey.includes('baseball')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    if (sportKey.includes('basketball')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
  }

  // 종목 이름
  const getSportName = (sportKey: string) => {
    const sportNames: Record<string, string> = {
      'soccer_korea_kleague_1': 'K리그1',
      'soccer_epl': 'EPL',
      'soccer_spain_la_liga': '라리가',
      'baseball_mlb': 'MLB',
      'americanfootball_nfl': 'NFL',
    }
    return sportNames[sportKey] || sportKey.replace(/_/g, ' ').toUpperCase()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => router.push("/dashboard")}
              className="border-gray-300 dark:border-gray-700"
            >
              ← 대시보드
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              스포츠 경기 데이터
            </h1>
            <Badge variant="outline" className="ml-2">
              실시간 동기화
            </Badge>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="border-blue-300 dark:border-blue-700"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? '동기화 중...' : 'API 동기화'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadMatches}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                전체 경기
              </CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                총 등록된 경기 수
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                예정 경기
              </CardDescription>
              <CardTitle className="text-3xl text-blue-600 dark:text-blue-400">
                {stats.live}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                진행 예정 또는 진행 중
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                완료 경기
              </CardDescription>
              <CardTitle className="text-3xl text-green-600 dark:text-green-400">
                {stats.finished}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                경기 종료 및 결과 확정
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 경기 목록 */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              경기 일정 및 결과
            </CardTitle>
            <CardDescription>
              The Odds API에서 동기화된 최신 경기 데이터
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="all">
                  전체 ({stats.total})
                </TabsTrigger>
                <TabsTrigger value="live">
                  예정 ({stats.live})
                </TabsTrigger>
                <TabsTrigger value="finished">
                  완료 ({stats.finished})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-0">
                {loading ? (
                  <div className="text-center p-12 text-gray-500 dark:text-gray-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
                    데이터 로딩 중...
                  </div>
                ) : filteredMatches.length === 0 ? (
                  <div className="text-center p-12 text-gray-500 dark:text-gray-400">
                    <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">경기 데이터가 없습니다</p>
                    <p className="text-sm">API 동기화 버튼을 클릭하여 최신 데이터를 가져오세요</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">상태</TableHead>
                          <TableHead className="w-[120px]">종목</TableHead>
                          <TableHead className="w-[180px]">경기 시간 (KST)</TableHead>
                          <TableHead>대진</TableHead>
                          <TableHead className="text-center">배당률</TableHead>
                          <TableHead className="text-center">결과</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMatches.map((match) => (
                          <TableRow key={match.id}>
                            {/* 상태 */}
                            <TableCell>
                              {match.is_finished ? (
                                <Badge className="bg-gray-500">종료</Badge>
                              ) : (
                                <Badge className="bg-blue-500">예정</Badge>
                              )}
                            </TableCell>

                            {/* 종목 */}
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={getSportBadgeColor(match.sport_key)}
                              >
                                {getSportName(match.sport_key)}
                              </Badge>
                            </TableCell>

                            {/* 경기 시간 */}
                            <TableCell className="font-mono text-sm">
                              {formatTime(match.commence_time)}
                            </TableCell>

                            {/* 대진 */}
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{match.home_team}</span>
                                <span className="text-gray-400">vs</span>
                                <span className="font-semibold">{match.away_team}</span>
                              </div>
                            </TableCell>

                            {/* 배당률 */}
                            <TableCell>
                              <div className="flex gap-2 justify-center items-center text-sm">
                                {match.odds_home && (
                                  <div className="px-2 py-1 bg-green-50 dark:bg-green-950 rounded">
                                    <span className="text-xs text-gray-500">승</span>
                                    <span className="ml-1 font-semibold text-green-700 dark:text-green-400">
                                      {match.odds_home.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                                {match.odds_draw && (
                                  <div className="px-2 py-1 bg-gray-50 dark:bg-gray-900 rounded">
                                    <span className="text-xs text-gray-500">무</span>
                                    <span className="ml-1 font-semibold text-gray-700 dark:text-gray-300">
                                      {match.odds_draw.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                                {match.odds_away && (
                                  <div className="px-2 py-1 bg-blue-50 dark:bg-blue-950 rounded">
                                    <span className="text-xs text-gray-500">패</span>
                                    <span className="ml-1 font-semibold text-blue-700 dark:text-blue-400">
                                      {match.odds_away.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                                {!match.odds_home && !match.odds_draw && !match.odds_away && (
                                  <span className="text-gray-400 text-sm">-</span>
                                )}
                              </div>
                            </TableCell>

                            {/* 결과 */}
                            <TableCell className="text-center">
                              {match.is_finished && match.home_score !== null && match.away_score !== null ? (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                  <span className="font-bold text-lg">
                                    {match.home_score}
                                  </span>
                                  <span className="text-gray-400">:</span>
                                  <span className="font-bold text-lg">
                                    {match.away_score}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* 안내 메시지 */}
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  자동 동기화 안내
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  • The Odds API와 자동 동기화: 매일 0시, 5시, 12시 (Vercel Cron)
                  <br />
                  • 30초마다 화면 자동 갱신
                  <br />
                  • 수동 동기화: 우측 상단 "API 동기화" 버튼 클릭
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
