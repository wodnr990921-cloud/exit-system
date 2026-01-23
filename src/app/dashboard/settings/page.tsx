"use client"

import { useEffect, useState } from "react"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, CheckCircle2, Save, Settings, Lock, FileText, Users, Key, Archive } from "lucide-react"
import dynamicImport from "next/dynamic"

const AuditLogsContent = dynamicImport(() => import("../audit-logs/audit-logs-client"), {
  loading: () => <div className="p-6">감사 로그 로딩 중...</div>,
  ssr: false,
})

const EmployeeManagementContent = dynamicImport(() => import("./employee-management-client"), {
  loading: () => <div className="p-6">직원 관리 로딩 중...</div>,
  ssr: false,
})

const PasswordChangeContent = dynamicImport(() => import("./password-change-client"), {
  loading: () => <div className="p-6">비밀번호 변경 로딩 중...</div>,
  ssr: false,
})

const ReplyArchiveContent = dynamicImport(() => import("./reply-archive-client"), {
  loading: () => <div className="p-6">답변 보관함 로딩 중...</div>,
  ssr: false,
})

interface SystemConfig {
  id: string
  key: string
  value: string
  description: string | null
  category: string
  updated_at: string
}

interface GroupedConfigs {
  [category: string]: SystemConfig[]
}

export default function SettingsPage() {
  const { role, loading: permissionsLoading, hasPermission } = usePermissions()
  const [configs, setConfigs] = useState<SystemConfig[]>([])
  const [groupedConfigs, setGroupedConfigs] = useState<GroupedConfigs>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editedValues, setEditedValues] = useState<{ [key: string]: string }>({})
  const [activeTab, setActiveTab] = useState("config")

  useEffect(() => {
    if (!permissionsLoading) {
      loadConfigs()
    }
  }, [permissionsLoading])

  const loadConfigs = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/config")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "설정을 불러오는데 실패했습니다.")
      }

      setConfigs(data.configs || [])
      setGroupedConfigs(data.groupedConfigs || {})
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleValueChange = (key: string, value: string) => {
    setEditedValues((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSave = async (config: SystemConfig) => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const newValue = editedValues[config.key] ?? config.value

      const response = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: config.key,
          value: newValue,
          description: config.description,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "설정 저장에 실패했습니다.")
      }

      setSuccess("설정이 저장되었습니다.")

      const newEditedValues = { ...editedValues }
      delete newEditedValues[config.key]
      setEditedValues(newEditedValues)

      await loadConfigs()

      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = (key: string) => {
    return editedValues[key] !== undefined
  }

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
            <Settings className="h-8 w-8 text-purple-600" />
            시스템 설정
          </h1>
          <p className="text-muted-foreground mt-2">
            환경 설정, 감사 로그 및 직원 관리
          </p>
        </div>
        <Badge variant="outline" className="text-purple-600 border-purple-600">
          Admin Only
        </Badge>
      </div>

      {success && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>성공</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            <span>시스템 변수</span>
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-2">
            <Key className="h-4 w-4" />
            <span>비밀번호 변경</span>
          </TabsTrigger>
          <TabsTrigger value="archive" className="gap-2">
            <Archive className="h-4 w-4" />
            <span>답변 보관함</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <FileText className="h-4 w-4" />
            <span>감사 로그</span>
          </TabsTrigger>
          <TabsTrigger value="employees" className="gap-2">
            <Users className="h-4 w-4" />
            <span>직원 관리</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          {loading ? (
            <div className="grid gap-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <div className="grid gap-6">
          {Object.entries(groupedConfigs).map(([category, categoryConfigs]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle>{category}</CardTitle>
                <CardDescription>
                  {categoryConfigs.length}개의 설정 항목
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {categoryConfigs.map((config) => (
                  <div
                    key={config.key}
                    className="flex items-end gap-4 pb-6 border-b last:border-0 last:pb-0"
                  >
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={config.key} className="text-base font-semibold">
                        {config.key}
                      </Label>
                      {config.description && (
                        <p className="text-sm text-muted-foreground">
                          {config.description}
                        </p>
                      )}
                      <Input
                        id={config.key}
                        type="text"
                        value={editedValues[config.key] ?? config.value}
                        onChange={(e) => handleValueChange(config.key, e.target.value)}
                        className="max-w-md"
                        disabled={saving}
                      />
                      <p className="text-xs text-muted-foreground">
                        마지막 수정: {new Date(config.updated_at).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleSave(config)}
                      disabled={!hasChanges(config.key) || saving}
                      className="min-w-[100px]"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      저장
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

              {configs.length === 0 && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      설정 항목이 없습니다.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="password" className="space-y-6">
          <Card>
            <PasswordChangeContent />
          </Card>
        </TabsContent>

        <TabsContent value="archive" className="space-y-6">
          <Card>
            <ReplyArchiveContent />
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <Card>
            <AuditLogsContent />
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="space-y-6">
          <Card>
            <EmployeeManagementContent />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}


export const dynamic = 'force-dynamic'
