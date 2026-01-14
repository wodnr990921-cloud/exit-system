"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Textarea } from "@/components/ui/textarea"

interface Notice {
  id: string
  title: string
  content: string
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export default function NoticesClient() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    is_active: true,
    display_order: 0,
  })

  const supabase = createClient()

  useEffect(() => {
    loadNotices()
  }, [])

  const loadNotices = async () => {
    try {
      const { data, error } = await supabase
        .from("notices")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false })

      if (error) throw error
      setNotices(data || [])
    } catch (error: any) {
      console.error("Error loading notices:", error)
      setError("공지사항을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (notice?: Notice) => {
    if (notice) {
      setEditingNotice(notice)
      setFormData({
        title: notice.title,
        content: notice.content,
        is_active: notice.is_active,
        display_order: notice.display_order,
      })
    } else {
      setEditingNotice(null)
      setFormData({
        title: "",
        content: "",
        is_active: true,
        display_order: 0,
      })
    }
    setShowDialog(true)
    setError(null)
  }

  const handleCloseDialog = () => {
    setShowDialog(false)
    setEditingNotice(null)
    setFormData({
      title: "",
      content: "",
      is_active: true,
      display_order: 0,
    })
    setError(null)
  }

  const handleSave = async () => {
    if (!formData.title.trim()) {
      setError("제목을 입력해주세요.")
      return
    }

    if (!formData.content.trim()) {
      setError("내용을 입력해주세요.")
      return
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("로그인이 필요합니다.")
      }

      if (editingNotice) {
        // 수정
        const { error } = await supabase
          .from("notices")
          .update({
            title: formData.title.trim(),
            content: formData.content.trim(),
            is_active: formData.is_active,
            display_order: formData.display_order,
          })
          .eq("id", editingNotice.id)

        if (error) throw error
        setSuccess("공지사항이 수정되었습니다.")
      } else {
        // 생성
        const { error } = await supabase.from("notices").insert({
          title: formData.title.trim(),
          content: formData.content.trim(),
          is_active: formData.is_active,
          display_order: formData.display_order,
          created_by: user.id,
        })

        if (error) throw error
        setSuccess("공지사항이 생성되었습니다.")
      }

      handleCloseDialog()
      loadNotices()

      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (error: any) {
      console.error("Error saving notice:", error)
      setError(error.message || "공지사항 저장에 실패했습니다.")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return

    try {
      const { error } = await supabase.from("notices").delete().eq("id", id)

      if (error) throw error
      setSuccess("공지사항이 삭제되었습니다.")
      loadNotices()

      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (error: any) {
      console.error("Error deleting notice:", error)
      setError(error.message || "공지사항 삭제에 실패했습니다.")
    }
  }

  const handleToggleActive = async (notice: Notice) => {
    try {
      const { error } = await supabase
        .from("notices")
        .update({ is_active: !notice.is_active })
        .eq("id", notice.id)

      if (error) throw error
      loadNotices()
    } catch (error: any) {
      console.error("Error toggling notice:", error)
      setError(error.message || "상태 변경에 실패했습니다.")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">공지사항 관리</h1>
        <Button onClick={() => handleOpenDialog()}>새 공지사항 추가</Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>공지사항 목록</CardTitle>
          <CardDescription>티켓 답변에 포함될 공지사항을 관리합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>제목</TableHead>
                <TableHead>내용</TableHead>
                <TableHead>표시순서</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>생성일</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    등록된 공지사항이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                notices.map((notice) => (
                  <TableRow key={notice.id}>
                    <TableCell className="font-medium">{notice.title}</TableCell>
                    <TableCell className="max-w-md truncate">{notice.content}</TableCell>
                    <TableCell>{notice.display_order}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          notice.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {notice.is_active ? "활성" : "비활성"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(notice.created_at).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(notice)}
                        >
                          수정
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(notice)}
                        >
                          {notice.is_active ? "비활성화" : "활성화"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(notice.id)}
                        >
                          삭제
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingNotice ? "공지사항 수정" : "새 공지사항 추가"}</DialogTitle>
            <DialogDescription>
              티켓 답변에 포함될 공지사항을 {editingNotice ? "수정" : "추가"}합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="공지사항 제목"
              />
            </div>

            <div>
              <Label htmlFor="content">내용</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="공지사항 내용"
                rows={10}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="display_order">표시 순서</Label>
                <Input
                  id="display_order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="is_active">활성화</Label>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              취소
            </Button>
            <Button onClick={handleSave}>{editingNotice ? "수정" : "추가"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
