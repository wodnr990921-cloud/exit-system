"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Bell, X } from "lucide-react"

interface Notice {
  id: string
  title: string
  content: string
  priority: "low" | "medium" | "high" | "urgent"
  created_at: string
}

export default function NoticePopup() {
  const [isOpen, setIsOpen] = useState(false)
  const [notices, setNotices] = useState<Notice[]>([])
  const [currentNoticeIndex, setCurrentNoticeIndex] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPopupNotices()
  }, [])

  const loadPopupNotices = async () => {
    try {
      // 로컬 스토리지에서 '다시 보지 않기' 설정 확인
      const hiddenNotices = JSON.parse(localStorage.getItem("hiddenNotices") || "[]")
      const lastShownDate = localStorage.getItem("noticeLastShown")
      const today = new Date().toDateString()

      // 오늘 이미 표시했고, 다시 보지 않기를 선택했으면 표시하지 않음
      if (lastShownDate === today && hiddenNotices.length > 0) {
        setLoading(false)
        return
      }

      const response = await fetch("/api/notices/popup")
      const data = await response.json()

      if (data.success && data.notices && data.notices.length > 0) {
        // 숨김 처리된 공지사항 제외
        const filteredNotices = data.notices.filter(
          (notice: Notice) => !hiddenNotices.includes(notice.id)
        )

        if (filteredNotices.length > 0) {
          setNotices(filteredNotices)
          setIsOpen(true)
        }
      }
    } catch (error) {
      console.error("Error loading popup notices:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (dontShowAgain) {
      // 다시 보지 않기를 선택한 경우, 현재 공지사항 ID를 로컬 스토리지에 저장
      const hiddenNotices = JSON.parse(localStorage.getItem("hiddenNotices") || "[]")
      const currentNotice = notices[currentNoticeIndex]
      if (currentNotice && !hiddenNotices.includes(currentNotice.id)) {
        hiddenNotices.push(currentNotice.id)
        localStorage.setItem("hiddenNotices", JSON.stringify(hiddenNotices))
      }

      // 마지막 표시 날짜 저장
      localStorage.setItem("noticeLastShown", new Date().toDateString())
    }

    // 다음 공지사항이 있으면 표시
    if (currentNoticeIndex < notices.length - 1) {
      setCurrentNoticeIndex(currentNoticeIndex + 1)
      setDontShowAgain(false)
    } else {
      setIsOpen(false)
    }
  }

  const handleCloseAll = () => {
    if (dontShowAgain) {
      // 모든 공지사항을 숨김 처리
      const hiddenNotices = notices.map((notice) => notice.id)
      localStorage.setItem("hiddenNotices", JSON.stringify(hiddenNotices))
      localStorage.setItem("noticeLastShown", new Date().toDateString())
    }
    setIsOpen(false)
  }

  const getPriorityBadge = (priority: Notice["priority"]) => {
    const badges = {
      urgent: <Badge variant="destructive" className="text-xs">긴급</Badge>,
      high: <Badge className="text-xs bg-orange-600">중요</Badge>,
      medium: <Badge className="text-xs bg-blue-600">보통</Badge>,
      low: <Badge variant="secondary" className="text-xs">일반</Badge>,
    }
    return badges[priority] || badges.low
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading || notices.length === 0) {
    return null
  }

  const currentNotice = notices[currentNoticeIndex]

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              공지사항
            </DialogTitle>
            <div className="flex items-center gap-2">
              {notices.length > 1 && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {currentNoticeIndex + 1} / {notices.length}
                </span>
              )}
              {getPriorityBadge(currentNotice.priority)}
            </div>
          </div>
          <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
            {formatDate(currentNotice.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
              {currentNotice.title}
            </h3>
          </div>

          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: currentNotice.content }}
          />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3">
          <div className="flex items-center space-x-2 mr-auto">
            <Checkbox
              id="dont-show-again"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <Label
              htmlFor="dont-show-again"
              className="text-sm font-normal cursor-pointer text-gray-700 dark:text-gray-300"
            >
              오늘 다시 보지 않기
            </Label>
          </div>

          <div className="flex gap-2">
            {notices.length > 1 && (
              <Button variant="outline" onClick={handleCloseAll}>
                모두 닫기
              </Button>
            )}
            <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700">
              {currentNoticeIndex < notices.length - 1 ? "다음" : "확인"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
