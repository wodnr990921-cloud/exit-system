"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { adjustOdds } from "@/lib/betting-calculator"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { 
  RefreshCw, 
  Trophy,
  CheckCircle2,
  Clock,
  Download,
  Calendar,
  DollarSign,
  Users,
  TrendingUp,
  AlertCircle,
  Zap,
  Send
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"

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

// 배팅 데이터 타입
interface Bet {
  id: string
  match_id: string
  customer_id: string
  customer_name: string
  member_number: string
  amount: number
  choice: string // 'home', 'draw', 'away'
  odds: number
  potential_win: number
  status: 'pending' | 'won' | 'lost' | 'cancelled'
  ticket_no: string
  created_at: string
}

// 정산 결과 타입
interface SettlementResult {
  matchId: string
  matchName: string
  result: string
  totalBets: number
  totalPayout: number
  profit: number
  profitRate: string
  winCount: number
  loseCount: number
  winners: Array<{
    customerName: string
    memberNumber: string
    amount: number
    payout: number
  }>
}

export default function SportsBettingClient() {
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const [matches, setMatches] = useState<SportsMatch[]>([])
  const [bets, setBets] = useState<Bet[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"live" | "pending" | "finished" | "schedule">("live")
  const [syncing, setSyncing] = useState(false)
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([])
  const [scheduleLeagueFilter, setScheduleLeagueFilter] = useState<string>("all") // 리그 필터
  
  // 선택된 경기 및 다이얼로그
  const [selectedMatch, setSelectedMatch] = useState<SportsMatch | null>(null)
  const [showBetsDialog, setShowBetsDialog] = useState(false)
  const [showSettleDialog, setShowSettleDialog] = useState(false)
  const [settlementResult, setSettlementResult] = useState<SettlementResult | null>(null)
  
  // 일괄 선택
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set())
  
  // 배당 마감
  const [closingMatchId, setClosingMatchId] = useState<string | null>(null)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  
  // 자동 메시지
  const [autoMessage, setAutoMessage] = useState("")
  const [showMessageDialog, setShowMessageDialog] = useState(false)

  // 경기 추가
  const [showAddGameDialog, setShowAddGameDialog] = useState(false)
  const [addingGame, setAddingGame] = useState(false)
  const [newGame, setNewGame] = useState({
    home_team: "",
    away_team: "",
    game_date: "",
    league: "기타",
    home_odds: "",
    draw_odds: "",
    away_odds: "",
    location: "",
  })

  useEffect(() => {
    loadAllData()
    
    // 30초마다 자동 새로고침
    const interval = setInterval(loadAllData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadAllData = async () => {
    await Promise.all([loadMatches(), loadBets()])
    setLoading(false)
  }

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
    }
  }

  const loadBets = async () => {
    try {
      // betting_items 뷰에서 배팅 데이터 로딩
      // task_items -> tasks -> customers 경로로 조인
      const { data, error } = await supabase
        .from('task_items')
        .select(`
          id,
          match_id,
          amount,
          betting_choice,
          betting_odds,
          potential_win,
          status,
          created_at,
          task:tasks!inner(
            ticket_no,
            customer_id,
            customer:customers!tasks_customer_id_fkey(member_number, name)
          )
        `)
        .not('match_id', 'is', null)
        .order('created_at', { ascending: false })

      if (error) {
        console.error("배팅 데이터 로딩 Supabase 오류:", error.message, error.details, error.hint)
        throw error
      }

      // 데이터 변환
      const betsData = (data || []).map((item: any) => ({
        id: item.id,
        match_id: item.match_id || '',
        customer_id: item.task?.customer_id || '',
        customer_name: item.task?.customer?.name || '알 수 없음',
        member_number: item.task?.customer?.member_number || 'N/A',
        amount: item.amount || 0,
        choice: item.betting_choice || 'home',
        odds: item.betting_odds || 1.0,
        potential_win: item.potential_win || 0,
        status: item.status || 'pending',
        ticket_no: item.task?.ticket_no || 'N/A',
        created_at: item.created_at
      }))

      setBets(betsData)
    } catch (error: any) {
      console.error("배팅 데이터 로딩 오류:", error?.message || error)
      // 배팅 컬럼이 없을 수 있으므로 빈 배열로 설정 (에러는 무시)
      setBets([])
    }
  }

  // 경기 일정 로딩 (모든 리그)
  const loadSchedule = async () => {
    try {
      // 모든 리그의 경기 일정 조회 (30일 이내)
      const response = await fetch('/api/sports/schedule?daysAhead=30')
      const data = await response.json()

      if (data.success) {
        setUpcomingMatches(data.schedule || [])
        
        // 리그별 통계 표시
        const statsText = Object.entries(data.stats || {})
          .map(([league, count]) => `${league}: ${count}개`)
          .join(', ')
        
        toast({
          title: "✅ 경기 일정 로딩 완료",
          description: `총 ${data.count}개 경기 | ${statsText}`,
        })
      }
    } catch (error) {
      console.error("경기 일정 로딩 오류:", error)
      toast({
        title: "오류",
        description: "경기 일정을 불러올 수 없습니다.",
        variant: "destructive",
      })
    }
  }

  // The Odds API 동기화
  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/sync-sports')
      const data = await response.json()

      if (data.success) {
        toast({
          title: "✅ 동기화 완료",
          description: `${data.data.total}개 경기 업데이트, 배당률 자동 반영`,
        })
        await loadMatches()
      } else {
        toast({
          title: "동기화 실패",
          description: data.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "오류",
        description: "API 동기화 중 오류 발생",
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
    }
  }

  // 배당 마감
  const handleCloseMatch = async () => {
    if (!closingMatchId) return

    try {
      // 배당 마감 API 호출
      const response = await fetch('/api/sports/close-betting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: closingMatchId })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "배당 마감 완료",
          description: `${data.betCount}건의 배팅이 마감되었습니다.`,
        })
        setShowCloseDialog(false)
        setClosingMatchId(null)
      }
    } catch (error) {
      toast({
        title: "마감 실패",
        description: "배당 마감 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  }

  // 경기 정산
  const handleSettleMatch = async (match: SportsMatch) => {
    if (!match.is_finished || match.home_score === null || match.away_score === null) {
      toast({
        title: "정산 불가",
        description: "경기가 종료되고 최종 스코어가 있어야 정산할 수 있습니다.",
        variant: "destructive",
      })
      return
    }

    try {
      // 정산 로직
      const winner = match.home_score > match.away_score ? 'home' : 
                     match.away_score > match.home_score ? 'away' : 'draw'

      const response = await fetch('/api/sports/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: match.id,
          winner,
          homeScore: match.home_score,
          awayScore: match.away_score
        })
      })

      const data = await response.json()

      if (data.success) {
        setSettlementResult(data.result)
        setShowSettleDialog(true)
        
        // 당첨자에게 자동 메시지 발송
        if (data.result.winners.length > 0) {
          await sendAutoMessages(data.result)
        }
        
        await loadAllData()
      }
    } catch (error) {
      toast({
        title: "정산 실패",
        description: "정산 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  }

  // 자동 메시지 발송
  const sendAutoMessages = async (result: SettlementResult) => {
    try {
      for (const winner of result.winners) {
        const message = `🎉 축하합니다!\n\n[${result.matchName}]\n배팅금: ${winner.amount.toLocaleString()}P\n당첨금: ${winner.payout.toLocaleString()}P\n\n포인트가 자동 지급되었습니다.`
        
        // 메시지 발송 API 호출 (실제 구현 필요)
        await fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberNumber: winner.memberNumber,
            message,
            type: 'betting_win'
          })
        })
      }

      toast({
        title: "자동 메시지 발송 완료",
        description: `${result.winners.length}명의 당첨자에게 알림 발송`,
      })
    } catch (error) {
      console.error("자동 메시지 발송 오류:", error)
    }
  }

  // 일괄 정산
  const handleBulkSettle = async () => {
    if (selectedMatches.size === 0) {
      toast({
        title: "선택된 경기 없음",
        description: "정산할 경기를 선택해주세요.",
        variant: "destructive",
      })
      return
    }

    const confirmed = confirm(`선택한 ${selectedMatches.size}개 경기를 일괄 정산하시겠습니까?`)
    if (!confirmed) return

    let successCount = 0
    let failCount = 0

    for (const matchId of selectedMatches) {
      const match = matches.find(m => m.id === matchId)
      if (!match || !match.is_finished) {
        failCount++
        continue
      }

      try {
        const winner = match.home_score! > match.away_score! ? 'home' : 
                       match.away_score! > match.home_score! ? 'away' : 'draw'

        const response = await fetch('/api/sports/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchId: match.id,
            winner,
            homeScore: match.home_score,
            awayScore: match.away_score
          })
        })

        const data = await response.json()
        if (data.success) {
          successCount++
          // 자동 메시지
          if (data.result.winners.length > 0) {
            await sendAutoMessages(data.result)
          }
        } else {
          failCount++
        }
      } catch (error) {
        failCount++
      }
    }

    toast({
      title: "일괄 정산 완료",
      description: `성공: ${successCount}건, 실패: ${failCount}건`,
    })

    setSelectedMatches(new Set())
    await loadAllData()
  }

  // 경기 수기 추가
  const handleAddGame = async () => {
    // 필수 필드 검증
    if (!newGame.home_team || !newGame.away_team || !newGame.game_date) {
      toast({
        title: "입력 오류",
        description: "홈팀, 원정팀, 경기 일시는 필수입니다.",
        variant: "destructive",
      })
      return
    }

    setAddingGame(true)
    try {
      const response = await fetch("/api/sports/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home_team: newGame.home_team.trim(),
          away_team: newGame.away_team.trim(),
          game_date: newGame.game_date,
          league: newGame.league || "기타",
          home_odds: newGame.home_odds ? parseFloat(newGame.home_odds) : null,
          draw_odds: newGame.draw_odds ? parseFloat(newGame.draw_odds) : null,
          away_odds: newGame.away_odds ? parseFloat(newGame.away_odds) : null,
          location: newGame.location || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "경기 추가에 실패했습니다.")
      }

      toast({
        title: "✅ 경기 추가 완료",
        description: `${newGame.home_team} vs ${newGame.away_team} 경기가 추가되었습니다.`,
      })
      setShowAddGameDialog(false)
      setNewGame({
        home_team: "",
        away_team: "",
        game_date: "",
        league: "기타",
        home_odds: "",
        draw_odds: "",
        away_odds: "",
        location: "",
      })
      await loadAllData()
    } catch (error) {
      console.error("Add game error:", error)
      toast({
        title: "오류",
        description: "경기 추가 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setAddingGame(false)
    }
  }

  // 경기별 배팅 통계
  const getMatchBetStats = (matchId: string) => {
    const matchBets = bets.filter(b => b.match_id === matchId && b.status === 'pending')
    const totalAmount = matchBets.reduce((sum, b) => sum + b.amount, 0)
    const totalRisk = matchBets.reduce((sum, b) => sum + b.potential_win, 0)
    
    return {
      count: matchBets.length,
      totalAmount,
      totalRisk,
      bets: matchBets
    }
  }

  // 필터링된 경기
  const filteredMatches = matches.filter(match => {
    const now = new Date()
    const matchTime = new Date(match.commence_time)
    
    if (activeTab === "live") {
      // 진행 중이거나 24시간 이내 시작 예정
      return !match.is_finished && matchTime > now
    }
    if (activeTab === "pending") {
      // 배팅 가능한 경기 (시작 전)
      return !match.is_finished && matchTime > now
    }
    if (activeTab === "finished") {
      return match.is_finished
    }
    if (activeTab === "schedule") {
      // 일정 탭에서는 별도로 표시
      return false
    }
    return true
  })

  // 시간 포맷
  const formatTime = (timeString: string) => {
    const date = new Date(timeString)
    return date.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // 종목 이름
  const getSportName = (sportKey: string) => {
    const names: Record<string, string> = {
      'soccer_korea_kleague_1': 'K리그1',
      'soccer_epl': 'EPL',
      'baseball_mlb': 'MLB',
    }
    return names[sportKey] || sportKey
  }

  // 통계
  const stats = {
    total: matches.length,
    live: matches.filter(m => !m.is_finished).length,
    finished: matches.filter(m => m.is_finished).length,
    totalBets: bets.length,
    totalAmount: bets.reduce((sum, b) => sum + b.amount, 0),
    pendingBets: bets.filter(b => b.status === 'pending').length,
  }

  // 배당률 표시 헬퍼 (원본 → 조정)
  const renderOdds = (original: number | undefined, label: string, colorClass: string) => {
    if (!original) return null
    const adjusted = adjustOdds(original).adjusted
    return (
      <div className={`px-2 py-1 ${colorClass} rounded`}>
        <span className="text-xs text-gray-500">{label}</span>
        <div className="flex items-center gap-1">
          <span className="text-xs line-through opacity-50">{original.toFixed(2)}</span>
          <span className="font-semibold">{adjusted.toFixed(2)}</span>
        </div>
      </div>
    )
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
            >
              ← 대시보드
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              스포츠 배팅 통합 시스템
            </h1>
            <Badge variant="outline" className="ml-2">
              <Zap className="w-3 h-3 mr-1" />
              실시간 배당
            </Badge>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddGameDialog(true)}
              className="border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20"
            >
              <Calendar className="w-4 h-4 mr-2" />
              경기 추가
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="border-blue-300"
            >
              <Download className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? '동기화 중...' : '배당 업데이트'}
            </Button>
            {selectedMatches.size > 0 && (
              <Button
                size="sm"
                onClick={handleBulkSettle}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                일괄 정산 ({selectedMatches.size})
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={loadAllData}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                진행 중 경기
              </CardDescription>
              <CardTitle className="text-3xl text-blue-600">
                {stats.live}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">배팅 가능</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                총 배팅
              </CardDescription>
              <CardTitle className="text-3xl">
                {stats.totalBets}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                대기: {stats.pendingBets}건
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                총 배팅액
              </CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {stats.totalAmount.toLocaleString()}P
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">포인트</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                완료 경기
              </CardDescription>
              <CardTitle className="text-3xl text-gray-600">
                {stats.finished}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">정산 대기 확인</p>
            </CardContent>
          </Card>
        </div>

        {/* 경기 목록 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  경기 관리
                </CardTitle>
                <CardDescription>
                  배당률은 The Odds API에서 자동 업데이트됩니다
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="live">
                  <Clock className="w-4 h-4 mr-2" />
                  진행 중 ({stats.live})
                </TabsTrigger>
                <TabsTrigger value="pending">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  배팅 가능
                </TabsTrigger>
                <TabsTrigger value="finished">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  완료 ({stats.finished})
                </TabsTrigger>
                <TabsTrigger value="schedule" onClick={() => {
                  if (upcomingMatches.length === 0) loadSchedule()
                }}>
                  <Calendar className="w-4 h-4 mr-2" />
                  경기 일정
                </TabsTrigger>
              </TabsList>

              {/* 경기 일정 탭 */}
              <TabsContent value="schedule" className="mt-0">
                {upcomingMatches.length === 0 ? (
                  <div className="text-center p-12">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">경기 일정을 불러와주세요</p>
                    <p className="text-sm text-gray-500 mb-4">
                      20개 리그 (K리그, EPL, 라리가, NBA, MLB 등) 30일 일정
                    </p>
                    <Button onClick={loadSchedule} variant="outline" className="mt-4">
                      <Download className="w-4 h-4 mr-2" />
                      전체 일정 불러오기
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 헤더 및 필터 */}
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-1">
                          예정된 경기 ({scheduleLeagueFilter === "all" ? upcomingMatches.length : upcomingMatches.filter(m => m.sportTitle === scheduleLeagueFilter).length}개)
                        </h3>
                        <p className="text-sm text-gray-500">
                          {scheduleLeagueFilter === "all" ? "전체 리그" : scheduleLeagueFilter}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={scheduleLeagueFilter}
                          onChange={(e) => setScheduleLeagueFilter(e.target.value)}
                          className="px-3 py-2 border rounded-md text-sm"
                        >
                          <option value="all">전체 리그</option>
                          {Array.from(new Set(upcomingMatches.map(m => m.sportTitle))).sort().map(league => (
                            <option key={league} value={league}>
                              {league} ({upcomingMatches.filter(m => m.sportTitle === league).length})
                            </option>
                          ))}
                        </select>
                        <Button onClick={loadSchedule} variant="outline" size="sm">
                          <RefreshCw className="w-4 h-4 mr-2" />
                          새로고침
                        </Button>
                      </div>
                    </div>

                    {/* 경기 목록 (리그별 그룹화) */}
                    <div className="grid gap-4">
                      {upcomingMatches
                        .filter(match => scheduleLeagueFilter === "all" || match.sportTitle === scheduleLeagueFilter)
                        .map((match, idx) => (
                        <Card key={idx} className={`border-gray-200 dark:border-gray-700 ${match.bettingClosed ? 'opacity-60' : ''}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <Badge variant="outline" className="font-semibold">
                                    {match.sportTitle || 'K리그1'}
                                  </Badge>
                                  <span className="text-sm text-gray-500 font-mono">
                                    {formatTime(match.commenceTime)}
                                  </span>
                                  {match.bettingClosed && (
                                    <Badge variant="destructive" className="text-xs">
                                      배팅 마감
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-lg">
                                  <span className="font-bold">{match.homeTeam}</span>
                                  <span className="text-gray-400">vs</span>
                                  <span className="font-bold">{match.awayTeam}</span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {match.oddsHome && (
                                  <div className="px-3 py-2 bg-green-50 dark:bg-green-950 rounded text-center">
                                    <div className="text-xs text-gray-500">승</div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs line-through opacity-50">{match.oddsHome.toFixed(2)}</span>
                                      <span className="font-bold text-green-700">{adjustOdds(match.oddsHome).adjusted.toFixed(2)}</span>
                                    </div>
                                  </div>
                                )}
                                {match.oddsDraw && (
                                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded text-center">
                                    <div className="text-xs text-gray-500">무</div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs line-through opacity-50">{match.oddsDraw.toFixed(2)}</span>
                                      <span className="font-bold">{adjustOdds(match.oddsDraw).adjusted.toFixed(2)}</span>
                                    </div>
                                  </div>
                                )}
                                {match.oddsAway && (
                                  <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950 rounded text-center">
                                    <div className="text-xs text-gray-500">패</div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs line-through opacity-50">{match.oddsAway.toFixed(2)}</span>
                                      <span className="font-bold text-blue-700">{adjustOdds(match.oddsAway).adjusted.toFixed(2)}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value={activeTab} className="mt-0">
                {activeTab === "schedule" ? null : loading ? (
                  <div className="text-center p-12">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
                    데이터 로딩 중...
                  </div>
                ) : filteredMatches.length === 0 ? (
                  <div className="text-center p-12">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">경기가 없습니다</p>
                    <Button onClick={handleSync} variant="outline" className="mt-4">
                      <Download className="w-4 h-4 mr-2" />
                      배당 업데이트
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <input
                              type="checkbox"
                              checked={selectedMatches.size === filteredMatches.filter(m => m.is_finished).length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMatches(new Set(filteredMatches.filter(m => m.is_finished).map(m => m.id)))
                                } else {
                                  setSelectedMatches(new Set())
                                }
                              }}
                              className="w-4 h-4"
                            />
                          </TableHead>
                          <TableHead>종목</TableHead>
                          <TableHead>경기 시간</TableHead>
                          <TableHead>대진</TableHead>
                          <TableHead className="text-center">배당률</TableHead>
                          <TableHead className="text-center">배팅현황</TableHead>
                          <TableHead className="text-center">결과</TableHead>
                          <TableHead className="text-right">관리</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMatches.map((match) => {
                          const betStats = getMatchBetStats(match.id)
                          return (
                            <TableRow key={match.id}>
                              {/* 선택 */}
                              <TableCell>
                                {match.is_finished && (
                                  <input
                                    type="checkbox"
                                    checked={selectedMatches.has(match.id)}
                                    onChange={(e) => {
                                      const newSet = new Set(selectedMatches)
                                      if (e.target.checked) {
                                        newSet.add(match.id)
                                      } else {
                                        newSet.delete(match.id)
                                      }
                                      setSelectedMatches(newSet)
                                    }}
                                    className="w-4 h-4"
                                  />
                                )}
                              </TableCell>

                              {/* 종목 */}
                              <TableCell>
                                <Badge variant="outline">
                                  {getSportName(match.sport_key)}
                                </Badge>
                              </TableCell>

                              {/* 시간 */}
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

                              {/* 배당률 (원본 → 조정) */}
                              <TableCell>
                                <div className="flex gap-2 justify-center text-sm">
                                  {renderOdds(match.odds_home, '승', 'bg-green-50 dark:bg-green-950 text-green-700')}
                                  {renderOdds(match.odds_draw, '무', 'bg-gray-50 dark:bg-gray-900')}
                                  {renderOdds(match.odds_away, '패', 'bg-blue-50 dark:bg-blue-950 text-blue-700')}
                                </div>
                              </TableCell>

                              {/* 배팅 현황 */}
                              <TableCell className="text-center">
                                <div className="text-sm">
                                  <div className="font-semibold">{betStats.count}건</div>
                                  <div className="text-xs text-gray-500">
                                    {betStats.totalAmount.toLocaleString()}P
                                  </div>
                                </div>
                              </TableCell>

                              {/* 결과 */}
                              <TableCell className="text-center">
                                {match.is_finished && match.home_score !== null ? (
                                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                    <span className="font-bold text-lg">{match.home_score}</span>
                                    <span className="text-gray-400">:</span>
                                    <span className="font-bold text-lg">{match.away_score}</span>
                                  </div>
                                ) : (
                                  <Badge variant="secondary">진행 예정</Badge>
                                )}
                              </TableCell>

                              {/* 관리 */}
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end">
                                  {!match.is_finished && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setClosingMatchId(match.id)
                                        setShowCloseDialog(true)
                                      }}
                                    >
                                      마감
                                    </Button>
                                  )}
                                  {match.is_finished && (
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700"
                                      onClick={() => handleSettleMatch(match)}
                                    >
                                      <Send className="w-4 h-4 mr-1" />
                                      정산
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedMatch(match)
                                      setShowBetsDialog(true)
                                    }}
                                  >
                                    상세
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* 배팅 내역 다이얼로그 */}
        <Dialog open={showBetsDialog} onOpenChange={setShowBetsDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedMatch && `${selectedMatch.home_team} vs ${selectedMatch.away_team}`}
              </DialogTitle>
              <DialogDescription>배팅 내역 및 통계</DialogDescription>
            </DialogHeader>
            {selectedMatch && (
              <div className="space-y-4">
                {/* 경기 정보 */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-500">경기 시간</div>
                    <div className="font-semibold">{formatTime(selectedMatch.commence_time)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">종목</div>
                    <div className="font-semibold">{getSportName(selectedMatch.sport_key)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">배팅 건수</div>
                    <div className="font-semibold">{getMatchBetStats(selectedMatch.id).count}건</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">총 배팅액</div>
                    <div className="font-semibold text-green-600">
                      {getMatchBetStats(selectedMatch.id).totalAmount.toLocaleString()}P
                    </div>
                  </div>
                </div>

                {/* 배팅 목록 */}
                <div>
                  <h3 className="font-medium mb-2">배팅 목록</h3>
                  {getMatchBetStats(selectedMatch.id).bets.length === 0 ? (
                    <div className="text-center p-8 text-gray-500">
                      아직 배팅이 없습니다
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>회원</TableHead>
                          <TableHead>선택</TableHead>
                          <TableHead className="text-right">배팅액</TableHead>
                          <TableHead className="text-right">배당</TableHead>
                          <TableHead className="text-right">예상당첨</TableHead>
                          <TableHead>상태</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getMatchBetStats(selectedMatch.id).bets.map((bet) => (
                          <TableRow key={bet.id}>
                            <TableCell>
                              {bet.customer_name} ({bet.member_number})
                            </TableCell>
                            <TableCell>
                              <Badge>
                                {bet.choice === 'home' ? '홈승' : bet.choice === 'away' ? '원정승' : '무승부'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {bet.amount.toLocaleString()}P
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-xs opacity-50">조정</span>
                                <span className="font-semibold">{bet.odds.toFixed(2)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {bet.potential_win.toLocaleString()}P
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                bet.status === 'won' ? 'default' : 
                                bet.status === 'lost' ? 'destructive' : 
                                'secondary'
                              }>
                                {bet.status === 'won' ? '당첨' : 
                                 bet.status === 'lost' ? '낙첨' : 
                                 '대기'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* 정산 결과 다이얼로그 */}
        <Dialog open={showSettleDialog} onOpenChange={setShowSettleDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>✅ 정산 완료</DialogTitle>
              <DialogDescription>당첨금이 자동 지급되고 메시지가 발송되었습니다</DialogDescription>
            </DialogHeader>
            {settlementResult && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">경기</span>
                    <span className="font-semibold">{settlementResult.matchName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">결과</span>
                    <span className="font-semibold text-blue-600">{settlementResult.result}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">총 배팅액</span>
                    <span className="font-semibold">{settlementResult.totalBets.toLocaleString()}P</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">총 지급액</span>
                    <span className="font-semibold text-red-600">{settlementResult.totalPayout.toLocaleString()}P</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t">
                    <span className="text-gray-600">순수익</span>
                    <span className={`font-bold text-lg ${settlementResult.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {settlementResult.profit.toLocaleString()}P ({settlementResult.profitRate}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">당첨 건수</span>
                    <span className="font-semibold text-green-600">{settlementResult.winCount}건</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">낙첨 건수</span>
                    <span className="font-semibold text-gray-600">{settlementResult.loseCount}건</span>
                  </div>
                </div>

                {/* 당첨자 목록 */}
                {settlementResult.winners.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      당첨자 ({settlementResult.winners.length}명) - 자동 메시지 발송됨
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {settlementResult.winners.map((winner, idx) => (
                        <div key={idx} className="p-3 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-semibold">{winner.customerName}</div>
                              <div className="text-sm text-gray-600">{winner.memberNumber}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-600">배팅: {winner.amount.toLocaleString()}P</div>
                              <div className="font-bold text-green-600">당첨: {winner.payout.toLocaleString()}P</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setShowSettleDialog(false)}>확인</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 배당 마감 다이얼로그 */}
        <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>배당 마감</DialogTitle>
              <DialogDescription>
                경기 시작 전 배팅을 마감합니다. 마감 후에는 추가 배팅이 불가능합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-600">
                현재 배팅 건수: <span className="font-semibold">{closingMatchId ? getMatchBetStats(closingMatchId).count : 0}건</span>
              </p>
              <p className="text-sm text-gray-600 mt-2">
                총 배팅액: <span className="font-semibold text-green-600">{closingMatchId ? getMatchBetStats(closingMatchId).totalAmount.toLocaleString() : 0}P</span>
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
                취소
              </Button>
              <Button onClick={handleCloseMatch} className="bg-orange-600 hover:bg-orange-700">
                마감 확정
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 경기 추가 다이얼로그 */}
        <Dialog open={showAddGameDialog} onOpenChange={setShowAddGameDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">⚽ 경기 수기 추가</DialogTitle>
              <DialogDescription>
                크롤링이 안 되는 경기를 직접 추가할 수 있습니다. 회원들이 배팅할 수 있는 경기 목록에 추가됩니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                {/* 홈팀 */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    홈팀 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="예: 맨체스터 유나이티드"
                    value={newGame.home_team}
                    onChange={(e) => setNewGame({ ...newGame, home_team: e.target.value })}
                  />
                </div>

                {/* 원정팀 */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    원정팀 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="예: 리버풀"
                    value={newGame.away_team}
                    onChange={(e) => setNewGame({ ...newGame, away_team: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* 경기 일시 */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    경기 일시 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="datetime-local"
                    value={newGame.game_date}
                    onChange={(e) => setNewGame({ ...newGame, game_date: e.target.value })}
                  />
                </div>

                {/* 리그 */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">리그</Label>
                  <Select
                    value={newGame.league}
                    onValueChange={(v) => setNewGame({ ...newGame, league: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="기타">기타</SelectItem>
                      <SelectItem value="KBO">⚾ KBO</SelectItem>
                      <SelectItem value="K리그">⚽ K리그</SelectItem>
                      <SelectItem value="KBL">🏀 KBL(남)</SelectItem>
                      <SelectItem value="WKBL">🏀 WKBL(여)</SelectItem>
                      <SelectItem value="V리그(남)">🏐 V리그(남)</SelectItem>
                      <SelectItem value="V리그(여)">🏐 V리그(여)</SelectItem>
                      <SelectItem value="MLB">⚾ MLB</SelectItem>
                      <SelectItem value="NBA">🏀 NBA</SelectItem>
                      <SelectItem value="EPL">⚽ EPL</SelectItem>
                      <SelectItem value="라리가">⚽ 라리가</SelectItem>
                      <SelectItem value="분데스리가">⚽ 분데스리가</SelectItem>
                      <SelectItem value="세리에A">⚽ 세리에A</SelectItem>
                      <SelectItem value="리그앙">⚽ 리그앙</SelectItem>
                      <SelectItem value="NPB">⚾ NPB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 배당률 (선택) */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">배당률 (선택사항)</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">홈승</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="예: 1.85"
                      value={newGame.home_odds}
                      onChange={(e) => setNewGame({ ...newGame, home_odds: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">무승부</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="예: 3.20"
                      value={newGame.draw_odds}
                      onChange={(e) => setNewGame({ ...newGame, draw_odds: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">원정승</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="예: 2.10"
                      value={newGame.away_odds}
                      onChange={(e) => setNewGame({ ...newGame, away_odds: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* 경기장 (선택) */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">경기장 (선택사항)</Label>
                <Input
                  placeholder="예: 올드 트래포드"
                  value={newGame.location}
                  onChange={(e) => setNewGame({ ...newGame, location: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddGameDialog(false)
                  setNewGame({
                    home_team: "",
                    away_team: "",
                    game_date: "",
                    league: "기타",
                    home_odds: "",
                    draw_odds: "",
                    away_odds: "",
                    location: "",
                  })
                }}
                disabled={addingGame}
              >
                취소
              </Button>
              <Button
                onClick={handleAddGame}
                disabled={addingGame || !newGame.home_team || !newGame.away_team || !newGame.game_date}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {addingGame ? "추가 중..." : "경기 추가"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
