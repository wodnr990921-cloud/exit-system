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
import { Download, CheckCircle, XCircle, Calendar, RefreshCw, Printer, Camera, FileImage } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Game {
  id?: string
  game_id?: string
  game_name?: string
  home_team?: string
  away_team?: string
  game_date?: string
  status?: string
  result_score?: string
  is_verified?: boolean
  league?: string
  location?: string
  total_bets: number
  total_risk: number
  bet_count: number
  items: BetItem[]
}

interface BetItem {
  id: string
  amount: number
  odds: number
  choice: string
  status: string
  ticket_no: string | null
  customer: {
    id: string
    member_number: string
    name: string
  } | null
}

interface SettlementResult {
  gameName: string
  result: string
  totalBets: number
  totalPayout: number
  profit: number
  profitRate: string
  winCount: number
  loseCount: number
}

export default function SportsOpsClient() {
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const [games, setGames] = useState<Game[]>([])
  const [unverifiedGames, setUnverifiedGames] = useState<Game[]>([])
  const [scheduledGames, setScheduledGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [crawling, setCrawling] = useState(false)
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [showBetDialog, setShowBetDialog] = useState(false)
  const [showSettleDialog, setShowSettleDialog] = useState(false)
  const [settlementResult, setSettlementResult] = useState<SettlementResult | null>(null)
  const [gameResult, setGameResult] = useState("")
  const [activeTab, setActiveTab] = useState("betting")
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set())
  const [editingGame, setEditingGame] = useState<Game | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editScore, setEditScore] = useState("")
  const [selectedLeague, setSelectedLeague] = useState("kbo")
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [showAutoSettleDialog, setShowAutoSettleDialog] = useState(false)
  const [autoSettleResult, setAutoSettleResult] = useState<any>(null)
  const [settlingGames, setSettlingGames] = useState(false)
  const [filterMode, setFilterMode] = useState<"all" | "date" | "month">("all")
  const [showBetSlipDialog, setShowBetSlipDialog] = useState(false)
  const [betSlipGame, setBetSlipGame] = useState<Game | null>(null)

  useEffect(() => {
    loadAllData()
    // 10초마다 자동 갱신
    const interval = setInterval(loadAllData, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadAllData = async () => {
    await Promise.all([loadGames(), loadUnverifiedGames(), loadScheduledGames()])
    setLoading(false)
  }

  const loadGames = async () => {
    try {
      const response = await fetch("/api/sports/games")
      const data = await response.json()

      if (data.success) {
        setGames(data.games)
      }
    } catch (error) {
      console.error("Error loading games:", error)
    }
  }

  const loadUnverifiedGames = async () => {
    try {
      const response = await fetch("/api/sports/verify")
      const data = await response.json()

      if (data.success) {
        setUnverifiedGames(data.games)
      }
    } catch (error) {
      console.error("Error loading unverified games:", error)
    }
  }

  const loadScheduledGames = async () => {
    try {
      const response = await fetch("/api/sports/crawl/schedule")
      const data = await response.json()

      if (data.success) {
        setScheduledGames(data.schedules)
      }
    } catch (error) {
      console.error("Error loading scheduled games:", error)
    }
  }

  const handleCrawlResults = async (league: string = "kbo") => {
    setCrawling(true)
    try {
      // AI 크롤링 사용 (네이버 크롤링 대신)
      const urls: Record<string, string> = {
        kbo: "https://sports.news.naver.com/kbaseball/schedule/index",
        kleague: "https://sports.daum.net/schedule/kleague",
        epl: "https://www.espn.com/soccer/schedule/_/league/eng.1",
      }
      
      const response = await fetch("/api/sports/crawl/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url: urls[league.toLowerCase()] || urls.kbo,
          league: league.toUpperCase() 
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "크롤링 성공",
          description: data.message,
        })
        await loadAllData()
      } else {
        toast({
          title: "크롤링 실패",
          description: data.error || "경기 결과를 가져올 수 없습니다.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Crawl error:", error)
      toast({
        title: "오류",
        description: "크롤링 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setCrawling(false)
    }
  }

  const handleCrawlSchedule = async (league: string = "kbo") => {
    setCrawling(true)
    try {
      // AI 크롤링 사용 (전체 리그 자동)
      toast({
        title: "🚀 전체 리그 크롤링 시작",
        description: "라이브스코어/배트맨/플래시스코어에서 15개 리그 크롤링 중...",
      })

      const response = await fetch("/api/sports/crawl/ai", {
        method: "GET",
      })

      const data = await response.json()

      if (data.success) {
        const { stats } = data
        const sourceInfo = stats?.sources 
          ? `\n📡 라이브스코어 ${stats.sources.livescore}, 배트맨 ${stats.sources.betman}, 플래시 ${stats.sources.flashscore}`
          : ""
        
        toast({
          title: "✅ 전체 일정 크롤링 완료",
          description: `${stats?.successful || 0}개 리그 성공, ${stats?.totalSaved || 0}건 경기 저장${sourceInfo}`,
        })
        await loadAllData()
      } else {
        toast({
          title: "일정 가져오기 실패",
          description: data.error || "경기 일정을 가져올 수 없습니다.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Schedule crawl error:", error)
      toast({
        title: "오류",
        description: "일정 가져오기 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setCrawling(false)
    }
  }

  const handleVerifyGame = async (gameId: string) => {
    try {
      const response = await fetch("/api/sports/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, verified: true }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "승인 완료",
          description: data.message,
        })
        await loadAllData()

        // 정산 결과가 있으면 표시
        if (data.settlement) {
          setSettlementResult(data.settlement)
          setShowSettleDialog(true)
        }
      } else {
        toast({
          title: "승인 실패",
          description: data.error || "승인에 실패했습니다.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Verify error:", error)
      toast({
        title: "오류",
        description: "승인 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  }

  const handleBulkVerify = async () => {
    if (selectedGames.size === 0) {
      toast({
        title: "선택된 경기 없음",
        description: "승인할 경기를 선택해주세요.",
        variant: "destructive",
      })
      return
    }

    const confirmed = confirm(`선택한 ${selectedGames.size}개의 경기를 일괄 승인하시겠습니까?`)
    if (!confirmed) return

    let successCount = 0
    let failCount = 0

    for (const gameId of selectedGames) {
      try {
        const response = await fetch("/api/sports/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId, verified: true }),
        })

        const data = await response.json()
        if (data.success) {
          successCount++
        } else {
          failCount++
        }
      } catch (error) {
        failCount++
      }
    }

    toast({
      title: "일괄 승인 완료",
      description: `성공: ${successCount}건, 실패: ${failCount}건`,
    })

    setSelectedGames(new Set())
    await loadAllData()
  }

  const handleToggleSelect = (gameId: string) => {
    const newSelected = new Set(selectedGames)
    if (newSelected.has(gameId)) {
      newSelected.delete(gameId)
    } else {
      newSelected.add(gameId)
    }
    setSelectedGames(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedGames.size === unverifiedGames.length) {
      setSelectedGames(new Set())
    } else {
      const allIds = new Set(unverifiedGames.map((g) => g.id).filter(Boolean) as string[])
      setSelectedGames(allIds)
    }
  }

  const handleEditGame = (game: Game) => {
    setEditingGame(game)
    setEditScore(game.result_score || "")
    setShowEditDialog(true)
  }

  const handleSaveEdit = async () => {
    if (!editingGame || !editScore.trim()) {
      return
    }

    try {
      const response = await fetch("/api/sports/games", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: editingGame.id,
          result_score: editScore.trim(),
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "수정 완료",
          description: "경기 결과가 수정되었습니다.",
        })
        setShowEditDialog(false)
        setEditingGame(null)
        setEditScore("")
        await loadAllData()
      } else {
        toast({
          title: "수정 실패",
          description: data.error || "수정에 실패했습니다.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Edit error:", error)
      toast({
        title: "오류",
        description: "수정 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  }

  const handleGameClick = (game: Game) => {
    setSelectedGame(game)
    setShowBetDialog(true)
  }

  const handleSettle = async () => {
    if (!selectedGame || !gameResult.trim()) {
      return
    }

    try {
      const response = await fetch("/api/sports/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: selectedGame.game_id,
          gameName: selectedGame.game_name,
          result: gameResult.trim(),
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSettlementResult(data.result)
        setShowSettleDialog(true)
        setShowBetDialog(false)
        setGameResult("")
        // 게임 목록 새로고침
        loadGames()
      } else {
        alert(data.error || "정산에 실패했습니다.")
      }
    } catch (error) {
      console.error("Error settling game:", error)
      alert("정산 처리 중 오류가 발생했습니다.")
    }
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString("ko-KR")
  }

  const formatChoice = (choice: string, odds: number) => {
    return `${choice} (배당 ${odds.toFixed(2)})`
  }

  const formatGameName = (game: Game) => {
    if (game.home_team && game.away_team) {
      return `${game.home_team} vs ${game.away_team}`
    }
    return game.game_name
  }

  const handleAutoSettle = async () => {
    if (selectedGames.size === 0) {
      toast({
        title: "선택된 경기 없음",
        description: "자동 정산할 경기를 선택해주세요.",
        variant: "destructive",
      })
      return
    }

    const confirmed = confirm(
      `선택한 ${selectedGames.size}개의 경기를 자동 정산하시겠습니까?\n정산 후 당첨자에게 포인트가 지급됩니다.`
    )
    if (!confirmed) return

    setSettlingGames(true)
    try {
      const response = await fetch("/api/sports/auto-settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameIds: Array.from(selectedGames),
          autoMode: true,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setAutoSettleResult(data)
        setShowAutoSettleDialog(true)
        toast({
          title: "자동 정산 완료",
          description: data.message,
        })
        setSelectedGames(new Set())
        await loadAllData()
      } else {
        toast({
          title: "자동 정산 실패",
          description: data.error || "정산에 실패했습니다.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Auto settle error:", error)
      toast({
        title: "오류",
        description: "자동 정산 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setSettlingGames(false)
    }
  }

  const handleCrawlWithLeague = async () => {
    await handleCrawlResults(selectedLeague)
  }

  const handleScheduleWithLeague = async () => {
    await handleCrawlSchedule(selectedLeague)
  }

  // 날짜/월별 필터링
  const getFilteredGames = (gamesList: Game[]) => {
    if (filterMode === "date") {
      return gamesList.filter((game) => game.game_date === selectedDate)
    } else if (filterMode === "month") {
      return gamesList.filter((game) => game.game_date?.startsWith(selectedMonth))
    }
    return gamesList
  }

  // 일정표 출력
  const handlePrintSchedule = () => {
    const filteredGames = getFilteredGames(scheduledGames)
    
    if (filteredGames.length === 0) {
      toast({
        title: "출력할 경기가 없습니다",
        description: "선택한 기간에 예정된 경기가 없습니다.",
        variant: "destructive",
      })
      return
    }

    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const periodText = 
      filterMode === "date" ? selectedDate :
      filterMode === "month" ? `${selectedMonth} 월간` :
      "전체"

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>경기 일정표 - ${periodText}</title>
        <meta charset="utf-8">
        <style>
          @media print {
            @page { margin: 20mm; }
          }
          body {
            font-family: 'Malgun Gothic', sans-serif;
            padding: 20px;
            line-height: 1.6;
          }
          h1 {
            text-align: center;
            color: #1a1a1a;
            border-bottom: 3px solid #333;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .meta {
            text-align: right;
            color: #666;
            margin-bottom: 20px;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th {
            background-color: #f0f0f0;
            border: 1px solid #ddd;
            padding: 12px 8px;
            text-align: center;
            font-weight: bold;
            font-size: 14px;
          }
          td {
            border: 1px solid #ddd;
            padding: 10px 8px;
            text-align: center;
            font-size: 13px;
          }
          .league-badge {
            display: inline-block;
            padding: 2px 8px;
            background-color: #e0e0e0;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
          }
          .vs {
            font-weight: bold;
            color: #666;
            margin: 0 5px;
          }
          .footer {
            text-align: center;
            color: #999;
            margin-top: 30px;
            font-size: 12px;
            border-top: 1px solid #ddd;
            padding-top: 15px;
          }
        </style>
      </head>
      <body>
        <h1>🏆 경기 일정표 (${periodText})</h1>
        <div class="meta">
          출력일시: ${new Date().toLocaleString("ko-KR")}<br>
          총 ${filteredGames.length}경기
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 10%">No.</th>
              <th style="width: 15%">리그</th>
              <th style="width: 20%">일시</th>
              <th style="width: 35%">대진</th>
              <th style="width: 20%">장소</th>
            </tr>
          </thead>
          <tbody>
            ${filteredGames.map((game, index) => `
              <tr>
                <td>${index + 1}</td>
                <td><span class="league-badge">${game.league || "-"}</span></td>
                <td>${game.game_date || "-"}</td>
                <td>
                  ${game.home_team || "홈"} 
                  <span class="vs">vs</span> 
                  ${game.away_team || "원정"}
                </td>
                <td>${game.location || "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="footer">
          Exit System - Sports Management
        </div>
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 100);
          }
        </script>
      </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
  }

  // 배팅 내역 제작 (캡쳐용)
  const handleCreateBetSlip = (game: Game) => {
    setBetSlipGame(game)
    setShowBetSlipDialog(true)
  }

  const handleCaptureBetSlip = () => {
    const betSlipElement = document.getElementById("bet-slip-capture")
    if (!betSlipElement) return

    // html2canvas 라이브러리 대신 새 창으로 열어서 캡쳐하도록 안내
    const captureWindow = window.open("", "_blank", "width=420,height=800")
    if (!captureWindow) {
      toast({
        title: "팝업 차단됨",
        description: "브라우저 팝업 차단을 해제해주세요.",
        variant: "destructive",
      })
      return
    }

    const betSlipContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>배팅 내역</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .bet-slip {
            width: 380px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
          }
          .header h1 {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 5px;
          }
          .header .subtitle {
            font-size: 12px;
            opacity: 0.9;
          }
          .content {
            padding: 20px;
          }
          .section {
            margin-bottom: 20px;
          }
          .section-title {
            font-size: 12px;
            color: #999;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
            font-weight: 600;
          }
          .match-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 12px;
            margin-bottom: 15px;
          }
          .league-badge {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 10px;
          }
          .teams {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin: 12px 0;
          }
          .team {
            text-align: center;
            flex: 1;
          }
          .team-name {
            font-size: 16px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 5px;
          }
          .team-odds {
            font-size: 14px;
            color: #667eea;
            font-weight: 600;
          }
          .vs {
            font-size: 12px;
            color: #999;
            font-weight: 600;
            padding: 0 15px;
          }
          .match-date {
            font-size: 12px;
            color: #666;
            text-align: center;
            margin-top: 10px;
          }
          .bet-details {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 15px;
            border-radius: 12px;
            margin-bottom: 15px;
          }
          .bet-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #dee2e6;
          }
          .bet-row:last-child {
            border-bottom: none;
            padding-top: 12px;
            margin-top: 8px;
            border-top: 2px solid #667eea;
          }
          .bet-label {
            font-size: 13px;
            color: #666;
          }
          .bet-value {
            font-size: 14px;
            font-weight: 600;
            color: #1a1a1a;
          }
          .bet-value.highlight {
            color: #667eea;
            font-size: 18px;
          }
          .bets-list {
            max-height: 200px;
            overflow-y: auto;
          }
          .bet-item {
            background: white;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 8px;
            border-left: 4px solid #667eea;
          }
          .bet-item-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
          }
          .bet-ticket {
            font-size: 11px;
            color: #999;
            font-weight: 600;
          }
          .bet-amount {
            font-size: 14px;
            font-weight: 700;
            color: #667eea;
          }
          .bet-member {
            font-size: 12px;
            color: #666;
          }
          .bet-choice {
            display: inline-block;
            background: #e7f3ff;
            color: #667eea;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            margin-left: 8px;
          }
          .footer {
            background: #f8f9fa;
            padding: 15px 20px;
            text-align: center;
            border-top: 1px solid #dee2e6;
          }
          .timestamp {
            font-size: 11px;
            color: #999;
            margin-bottom: 5px;
          }
          .barcode {
            width: 100%;
            height: 50px;
            background: linear-gradient(90deg, 
              #000 0%, #000 10%, transparent 10%, transparent 15%,
              #000 15%, #000 20%, transparent 20%, transparent 30%,
              #000 30%, #000 35%, transparent 35%, transparent 40%,
              #000 40%, #000 50%, transparent 50%, transparent 55%,
              #000 55%, #000 60%, transparent 60%, transparent 70%,
              #000 70%, #000 80%, transparent 80%, transparent 85%,
              #000 85%, #000 90%, transparent 90%, transparent 100%
            );
            margin: 10px 0;
          }
          .notice {
            font-size: 10px;
            color: #999;
            line-height: 1.4;
          }
        </style>
      </head>
      <body>
        <div class="bet-slip" id="capture-target">
          <div class="header">
            <h1>🎯 배팅 내역서</h1>
            <div class="subtitle">EXIT SPORTS BETTING</div>
          </div>
          
          <div class="content">
            <!-- 경기 정보 -->
            <div class="section">
              <div class="section-title">Match Information</div>
              <div class="match-info">
                <span class="league-badge">${betSlipGame?.league || "KBO"}</span>
                <div class="teams">
                  <div class="team">
                    <div class="team-name">${betSlipGame?.home_team || "홈팀"}</div>
                    <div class="team-odds">2.15</div>
                  </div>
                  <div class="vs">VS</div>
                  <div class="team">
                    <div class="team-name">${betSlipGame?.away_team || "원정팀"}</div>
                    <div class="team-odds">1.85</div>
                  </div>
                </div>
                <div class="match-date">
                  📅 ${betSlipGame?.game_date ? new Date(betSlipGame.game_date).toLocaleString("ko-KR") : "-"}
                </div>
              </div>
            </div>

            <!-- 배팅 통계 -->
            <div class="section">
              <div class="section-title">Betting Summary</div>
              <div class="bet-details">
                <div class="bet-row">
                  <span class="bet-label">총 배팅 건수</span>
                  <span class="bet-value">${betSlipGame?.bet_count || 0}건</span>
                </div>
                <div class="bet-row">
                  <span class="bet-label">총 배팅액</span>
                  <span class="bet-value">${formatNumber(betSlipGame?.total_bets || 0)}P</span>
                </div>
                <div class="bet-row">
                  <span class="bet-label">예상 당첨금</span>
                  <span class="bet-value highlight">${formatNumber(betSlipGame?.total_risk || 0)}P</span>
                </div>
              </div>
            </div>

            <!-- 배팅 목록 -->
            <div class="section">
              <div class="section-title">Bet Details (${betSlipGame?.items?.length || 0})</div>
              <div class="bets-list">
                ${betSlipGame?.items?.slice(0, 5).map((item, idx) => `
                  <div class="bet-item">
                    <div class="bet-item-header">
                      <span class="bet-ticket">#${item.ticket_no || `BET-${idx + 1}`}</span>
                      <span class="bet-amount">${formatNumber(item.amount)}P</span>
                    </div>
                    <div class="bet-member">
                      ${item.customer?.name || "회원"} (${item.customer?.member_number || "-"})
                      <span class="bet-choice">${item.choice}</span>
                    </div>
                  </div>
                `).join("") || "<div style='text-align: center; color: #999; padding: 20px;'>배팅 내역이 없습니다</div>"}
              </div>
            </div>
          </div>

          <div class="footer">
            <div class="timestamp">발행일시: ${new Date().toLocaleString("ko-KR")}</div>
            <div class="barcode"></div>
            <div class="notice">
              본 내역서는 온라인 스포츠 배팅 시스템에서 생성되었습니다.<br>
              EXIT SYSTEM © 2026 All Rights Reserved
            </div>
          </div>
        </div>

        <script>
          // 페이지 로드 후 안내 메시지
          setTimeout(() => {
            alert("⚡ 화면 캡쳐 방법:\\n\\n1. Windows: Win + Shift + S\\n2. Mac: Cmd + Shift + 4\\n3. 또는 스크린샷 도구 사용");
          }, 500);
        </script>
      </body>
      </html>
    `

    captureWindow.document.write(betSlipContent)
    captureWindow.document.close()

    toast({
      title: "배팅 내역 생성 완료",
      description: "새 창에서 화면을 캡쳐하세요.",
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.back()} className="border-gray-300 dark:border-gray-700">
              ← 뒤로가기
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")} className="border-gray-300 dark:border-gray-700">
              홈
            </Button>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">배팅업무</h1>
            {unverifiedGames.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                승인 대기 {unverifiedGames.length}건
              </Badge>
            )}
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {/* 리그 선택 */}
            <Select value={selectedLeague} onValueChange={setSelectedLeague}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="리그 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kbo">⚾ KBO</SelectItem>
                <SelectItem value="kleague">⚽ K리그</SelectItem>
                <SelectItem value="kbl">🏀 KBL(남)</SelectItem>
                <SelectItem value="wkbl">🏀 WKBL(여)</SelectItem>
                <SelectItem value="vleague-m">🏐 V리그(남)</SelectItem>
                <SelectItem value="vleague-w">🏐 V리그(여)</SelectItem>
                <SelectItem value="mlb">⚾ MLB</SelectItem>
                <SelectItem value="nba">🏀 NBA</SelectItem>
                <SelectItem value="epl">⚽ EPL</SelectItem>
              </SelectContent>
            </Select>

            <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />

            {/* 필터 모드 선택 */}
            <Select value={filterMode} onValueChange={(v: any) => setFilterMode(v)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="date">날짜별</SelectItem>
                <SelectItem value="month">월별</SelectItem>
              </SelectContent>
            </Select>

            {/* 날짜 선택 (날짜별 필터 활성화 시) */}
            {filterMode === "date" && (
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
              />
            )}

            {/* 월 선택 (월별 필터 활성화 시) */}
            {filterMode === "month" && (
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-40"
              />
            )}

            <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />

            {/* 크롤링 버튼 */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleScheduleWithLeague}
              disabled={crawling}
              className="border-blue-300 dark:border-blue-700"
            >
              <Calendar className="w-4 h-4 mr-1" />
              일정
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCrawlWithLeague}
              disabled={crawling}
              className="border-green-300 dark:border-green-700"
            >
              <Download className="w-4 h-4 mr-1" />
              {crawling ? "크롤링 중..." : "결과"}
            </Button>

            <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />

            {/* 출력 버튼 */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintSchedule}
              className="border-purple-300 dark:border-purple-700"
            >
              <Printer className="w-4 h-4 mr-1" />
              출력
            </Button>

            {/* 새로고침 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={loadAllData}
              className="border-gray-300 dark:border-gray-700"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 탭 인터페이스 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="betting">
              배팅 현황 {games.length > 0 && `(${games.length})`}
            </TabsTrigger>
            <TabsTrigger value="verification">
              결과 승인 {unverifiedGames.length > 0 && `(${unverifiedGames.length})`}
            </TabsTrigger>
            <TabsTrigger value="schedule">
              예정 경기 {scheduledGames.length > 0 && `(${scheduledGames.length})`}
            </TabsTrigger>
          </TabsList>

          {/* 배팅 현황 탭 */}
          <TabsContent value="betting" className="space-y-4">
            <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Live Betting Board</CardTitle>
                <CardDescription>진행 중인 경기별 배팅 현황</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center p-8 text-gray-500 dark:text-gray-400">로딩 중...</div>
                ) : games.length === 0 ? (
                  <div className="text-center p-8 text-gray-500 dark:text-gray-400">진행 중인 경기가 없습니다.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {games.map((game, index) => (
                      <Card
                        key={game.game_id || game.id || index}
                        className="cursor-pointer hover:shadow-md transition-shadow border-gray-200 dark:border-gray-800"
                        onClick={() => handleGameClick(game)}
                      >
                        <CardHeader>
                          <CardTitle className="text-lg">{formatGameName(game)}</CardTitle>
                          {game.game_date && (
                            <CardDescription>
                              {new Date(game.game_date).toLocaleString("ko-KR")}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">총 배팅액</div>
                              <div className="text-lg font-semibold">{formatNumber(game.total_bets)}P</div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">예상 당첨금</div>
                              <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">{formatNumber(game.total_risk)}P</div>
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">배팅 인원수</div>
                            <div className="text-lg font-semibold">{game.bet_count || game.items?.length || 0}건</div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleGameClick(game)
                              }}
                            >
                              상세 보기
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCreateBetSlip(game)
                              }}
                            >
                              <Camera className="w-4 h-4" />
                            </Button>
                          </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* 결과 승인 탭 */}
      <TabsContent value="verification" className="space-y-4">
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">크롤링된 경기 결과 승인</CardTitle>
                <CardDescription>포털에서 가져온 경기 결과를 확인하고 승인하세요</CardDescription>
              </div>
              {unverifiedGames.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="border-blue-300 dark:border-blue-700"
                  >
                    {selectedGames.size === unverifiedGames.length ? "전체 해제" : "전체 선택"}
                  </Button>
                  <Button
                    size="sm"
                    disabled={selectedGames.size === 0}
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleBulkVerify}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    일괄 승인 ({selectedGames.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={selectedGames.size === 0 || settlingGames}
                    className="border-purple-300 dark:border-purple-700"
                    onClick={handleAutoSettle}
                  >
                    {settlingGames ? "정산 중..." : `자동 정산 (${selectedGames.size})`}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center p-8 text-gray-500 dark:text-gray-400">로딩 중...</div>
            ) : unverifiedGames.length === 0 ? (
              <div className="text-center p-8 text-gray-500 dark:text-gray-400">
                승인 대기 중인 경기가 없습니다.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">선택</TableHead>
                    <TableHead>리그</TableHead>
                    <TableHead>경기</TableHead>
                    <TableHead>결과</TableHead>
                    <TableHead>경기 날짜</TableHead>
                    <TableHead className="text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unverifiedGames.map((game) => (
                    <TableRow key={game.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={game.id ? selectedGames.has(game.id) : false}
                          onChange={() => game.id && handleToggleSelect(game.id)}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{game.league || "KBO"}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatGameName(game)}
                      </TableCell>
                      <TableCell>
                        <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                          {game.result_score || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {game.game_date ? new Date(game.game_date).toLocaleString("ko-KR") : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditGame(game)}
                          >
                            수정
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => game.id && handleVerifyGame(game.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            승인
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* 예정 경기 탭 */}
      <TabsContent value="schedule" className="space-y-4">
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">예정된 경기 일정</CardTitle>
                <CardDescription>
                  {filterMode === "all" && "전체 예정 경기"}
                  {filterMode === "date" && `${selectedDate} 예정 경기`}
                  {filterMode === "month" && `${selectedMonth} 월간 예정 경기`}
                  {" "}({getFilteredGames(scheduledGames).length}건)
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintSchedule}
                className="border-purple-300 dark:border-purple-700"
              >
                <Printer className="w-4 h-4 mr-1" />
                일정표 출력
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center p-8 text-gray-500 dark:text-gray-400">로딩 중...</div>
            ) : getFilteredGames(scheduledGames).length === 0 ? (
              <div className="text-center p-8 text-gray-500 dark:text-gray-400">
                {filterMode === "all" 
                  ? "예정된 경기가 없습니다."
                  : "선택한 기간에 예정된 경기가 없습니다."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>리그</TableHead>
                    <TableHead>경기</TableHead>
                    <TableHead>경기 날짜</TableHead>
                    <TableHead>장소</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getFilteredGames(scheduledGames).map((game) => (
                    <TableRow key={game.id}>
                      <TableCell>
                        <Badge variant="outline">{game.league || "KBO"}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatGameName(game)}
                      </TableCell>
                      <TableCell>
                        {game.game_date ? new Date(game.game_date).toLocaleString("ko-KR") : "-"}
                      </TableCell>
                      <TableCell>{game.location || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          <Calendar className="w-3 h-3 mr-1" />
                          예정
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

        {/* 배팅 상세 Dialog */}
        <Dialog open={showBetDialog} onOpenChange={setShowBetDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedGame ? formatGameName(selectedGame) : "경기 상세"}</DialogTitle>
              <DialogDescription>배팅 내역 및 정산</DialogDescription>
            </DialogHeader>
            {selectedGame && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">총 배팅액</div>
                    <div className="text-lg font-semibold">{formatNumber(selectedGame.total_bets)}P</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">예상 당첨금</div>
                    <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">{formatNumber(selectedGame.total_risk)}P</div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">배팅 내역</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>티켓번호</TableHead>
                        <TableHead>회원</TableHead>
                        <TableHead>선택</TableHead>
                        <TableHead className="text-right">배팅액</TableHead>
                        <TableHead className="text-right">예상 당첨금</TableHead>
                        <TableHead>상태</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedGame.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">{item.ticket_no || "-"}</TableCell>
                          <TableCell>
                            {item.customer ? `${item.customer.name} (${item.customer.member_number})` : "-"}
                          </TableCell>
                          <TableCell>{formatChoice(item.choice, item.odds)}</TableCell>
                          <TableCell className="text-right">{formatNumber(item.amount)}P</TableCell>
                          <TableCell className="text-right">{formatNumber(item.amount * item.odds)}P</TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                item.status === "won"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : item.status === "lost"
                                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                              }`}
                            >
                              {item.status === "won" ? "승리" : item.status === "lost" ? "패배" : "대기"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="pt-4 border-t">
                  <Label htmlFor="game-result" className="mb-2 block">
                    경기 결과 입력
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="game-result"
                      placeholder="예: 홈팀 승, 원정팀 승, 무승부"
                      value={gameResult}
                      onChange={(e) => setGameResult(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleSettle} className="bg-green-600 hover:bg-green-700">
                      정산 실행
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* 정산 결과 Dialog */}
        <Dialog open={showSettleDialog} onOpenChange={setShowSettleDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>정산 완료</DialogTitle>
              <DialogDescription>경기 정산 결과</DialogDescription>
            </DialogHeader>
            {settlementResult && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">경기:</span>
                    <span className="font-medium">{settlementResult.gameName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">결과:</span>
                    <span className="font-medium">{settlementResult.result}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">총 배팅액:</span>
                    <span className="font-medium">{formatNumber(settlementResult.totalBets)}P</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">총 지급액:</span>
                    <span className="font-medium text-red-600 dark:text-red-400">{formatNumber(settlementResult.totalPayout)}P</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">순수익:</span>
                    <span className={`font-medium ${settlementResult.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatNumber(settlementResult.profit)}P ({settlementResult.profitRate}%)
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-gray-600 dark:text-gray-400">승리 건수:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{settlementResult.winCount}건</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">패배 건수:</span>
                    <span className="font-medium text-red-600 dark:text-red-400">{settlementResult.loseCount}건</span>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setShowSettleDialog(false)}>확인</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 경기 결과 수정 Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>경기 결과 수정</DialogTitle>
              <DialogDescription>
                {editingGame && formatGameName(editingGame)}
              </DialogDescription>
            </DialogHeader>
            {editingGame && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-score">경기 결과</Label>
                  <Input
                    id="edit-score"
                    placeholder="예: 3:2, 5:1"
                    value={editScore}
                    onChange={(e) => setEditScore(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    형식: 홈팀점수:원정팀점수 (예: 3:2)
                  </p>
                </div>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    경기 결과를 수정하면 다시 승인 대기 상태가 됩니다.
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                취소
              </Button>
              <Button onClick={handleSaveEdit} disabled={!editScore.trim()}>
                저장
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 자동 정산 결과 Dialog */}
        <Dialog open={showAutoSettleDialog} onOpenChange={setShowAutoSettleDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>자동 정산 결과</DialogTitle>
              <DialogDescription>배팅 정산이 완료되었습니다</DialogDescription>
            </DialogHeader>
            {autoSettleResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">처리된 경기</div>
                    <div className="text-lg font-semibold">{autoSettleResult.stats?.totalSettled || 0}건</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">총 배팅액</div>
                    <div className="text-lg font-semibold">{formatNumber(autoSettleResult.stats?.totalBets || 0)}P</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">총 지급액</div>
                    <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                      {formatNumber(autoSettleResult.stats?.totalPayout || 0)}P
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">순수익</div>
                    <div className={`text-lg font-semibold ${(autoSettleResult.stats?.totalProfit || 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatNumber(autoSettleResult.stats?.totalProfit || 0)}P
                      <span className="text-sm ml-1">
                        ({autoSettleResult.stats?.overallProfitRate || "0.00"}%)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-medium">경기별 정산 내역</h3>
                  {autoSettleResult.results?.map((result: any, index: number) => (
                    <Card key={index} className="border-gray-200 dark:border-gray-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{result.gameName}</CardTitle>
                        <CardDescription>
                          결과: {result.result} | 승자: {result.winningTeam === "home" ? "홈팀" : result.winningTeam === "away" ? "원정팀" : "무승부"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">배팅액:</span>
                            <span className="ml-1 font-medium">{formatNumber(result.totalBets)}P</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">지급액:</span>
                            <span className="ml-1 font-medium text-red-600 dark:text-red-400">
                              {formatNumber(result.totalPayout)}P
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">수익:</span>
                            <span className={`ml-1 font-medium ${result.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                              {formatNumber(result.profit)}P ({result.profitRate}%)
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">당첨:</span>
                            <span className="ml-1 font-medium text-green-600 dark:text-green-400">
                              {result.winCount}건
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">낙첨:</span>
                            <span className="ml-1 font-medium text-red-600 dark:text-red-400">
                              {result.loseCount}건
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setShowAutoSettleDialog(false)}>확인</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 배팅 내역 제작 Dialog */}
        <Dialog open={showBetSlipDialog} onOpenChange={setShowBetSlipDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                배팅 내역 제작 (캡쳐용)
              </DialogTitle>
              <DialogDescription>
                온라인 스포츠 사이트 스타일의 배팅 내역서를 생성합니다
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {betSlipGame && (
                <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">경기</span>
                    <span className="font-semibold">{formatGameName(betSlipGame)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">리그</span>
                    <Badge variant="outline">{betSlipGame.league || "KBO"}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">배팅 건수</span>
                    <span className="font-semibold">{betSlipGame.bet_count || 0}건</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">총 배팅액</span>
                    <span className="font-semibold text-blue-600">{formatNumber(betSlipGame.total_bets || 0)}P</span>
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <FileImage className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="flex-1 text-sm text-blue-900 dark:text-blue-100">
                    <p className="font-semibold mb-1">💡 사용 방법</p>
                    <ol className="list-decimal list-inside space-y-1 text-blue-800 dark:text-blue-200">
                      <li>아래 버튼을 클릭하여 새 창 열기</li>
                      <li>화면 캡쳐 도구 사용 (Win+Shift+S 또는 Cmd+Shift+4)</li>
                      <li>필요한 영역만 캡쳐하여 저장</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowBetSlipDialog(false)}
              >
                취소
              </Button>
              <Button
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                onClick={handleCaptureBetSlip}
              >
                <Camera className="w-4 h-4 mr-2" />
                배팅 내역 생성
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
