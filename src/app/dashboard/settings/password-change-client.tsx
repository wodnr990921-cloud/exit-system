"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle, Key, Lock, Info } from "lucide-react"

export default function PasswordChangeClient() {
  const supabase = createClient()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isOAuthUser, setIsOAuthUser] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    checkAuthMethod()
  }, [])

  const checkAuthMethod = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // OAuth 사용자 확인 (app_metadata에 provider 정보 있음)
        const providers = user.app_metadata?.providers || []
        const isOAuth = providers.includes('google') || providers.includes('github')
        setIsOAuthUser(isOAuth)
      }
    } catch (error) {
      console.error("인증 방법 확인 오류:", error)
    } finally {
      setCheckingAuth(false)
    }
  }

  const handleAddPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (!newPassword || !confirmPassword) {
        throw new Error("모든 필드를 입력해주세요.")
      }

      if (newPassword.length < 6) {
        throw new Error("비밀번호는 6자 이상이어야 합니다.")
      }

      if (newPassword !== confirmPassword) {
        throw new Error("비밀번호가 일치하지 않습니다.")
      }

      const response = await fetch("/api/auth/add-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newPassword }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "비밀번호 설정에 실패했습니다.")
      }

      setSuccess("비밀번호가 설정되었습니다! 이제 username/password로도 로그인할 수 있습니다.")
      setNewPassword("")
      setConfirmPassword("")
      setIsOAuthUser(false)

      setTimeout(() => setSuccess(null), 5000)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // 유효성 검사
      if (!currentPassword || !newPassword || !confirmPassword) {
        throw new Error("모든 필드를 입력해주세요.")
      }

      if (newPassword.length < 6) {
        throw new Error("새 비밀번호는 6자 이상이어야 합니다.")
      }

      if (newPassword !== confirmPassword) {
        throw new Error("새 비밀번호가 일치하지 않습니다.")
      }

      if (currentPassword === newPassword) {
        throw new Error("새 비밀번호는 현재 비밀번호와 달라야 합니다.")
      }

      // 현재 사용자 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error("로그인이 필요합니다.")
      }

      // 사용자 이메일과 username 가져오기
      const { data: userData } = await supabase
        .from("users")
        .select("email, username")
        .eq("id", user.id)
        .single()

      if (!userData) {
        throw new Error("사용자 정보를 찾을 수 없습니다.")
      }

      // 현재 비밀번호 확인 (로그인 시도)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: currentPassword,
      })

      if (signInError) {
        throw new Error("현재 비밀번호가 올바르지 않습니다.")
      }

      // 비밀번호 변경 API 호출
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: userData.username,
          action: "change_password",
          currentPassword,
          newPassword,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "비밀번호 변경에 실패했습니다.")
      }

      setSuccess("비밀번호가 성공적으로 변경되었습니다!")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")

      setTimeout(() => setSuccess(null), 5000)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <>
        <CardHeader>
          <CardTitle>로딩 중...</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">인증 정보를 확인하는 중입니다...</p>
        </CardContent>
      </>
    )
  }

  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5 text-blue-600" />
          {isOAuthUser ? "비밀번호 설정" : "비밀번호 변경"}
        </CardTitle>
        <CardDescription>
          {isOAuthUser 
            ? "구글 로그인 계정에 비밀번호를 추가하여 username/password로도 로그인할 수 있습니다"
            : "보안을 위해 정기적으로 비밀번호를 변경하는 것을 권장합니다"
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isOAuthUser && (
          <Alert className="mb-6 bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">안내</AlertTitle>
            <AlertDescription className="text-blue-700">
              현재 구글 로그인을 사용 중입니다. 비밀번호를 설정하면 구글 로그인과 일반 로그인을 모두 사용할 수 있습니다.
            </AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">성공</AlertTitle>
            <AlertDescription className="text-green-700">
              {success}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>오류</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isOAuthUser ? (
          <form onSubmit={handleAddPassword} className="space-y-6 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                새 비밀번호
              </Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="비밀번호 (6자 이상)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                최소 6자 이상 입력해주세요
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                비밀번호 확인
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="비밀번호를 다시 입력하세요"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="min-w-[120px]"
              >
                {loading ? "설정 중..." : "비밀번호 설정"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNewPassword("")
                  setConfirmPassword("")
                  setError(null)
                  setSuccess(null)
                }}
                disabled={loading}
              >
                초기화
              </Button>
            </div>

            <div className="pt-4 border-t">
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="font-semibold">비밀번호 설정 후:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>구글 로그인 계속 사용 가능</li>
                  <li>username + 비밀번호로도 로그인 가능</li>
                  <li>임시 비밀번호 발급 기능 사용 가능</li>
                  <li>비밀번호 변경 기능 사용 가능</li>
                </ul>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePasswordChange} className="space-y-6 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              현재 비밀번호
            </Label>
            <Input
              id="currentPassword"
              type="password"
              placeholder="현재 비밀번호를 입력하세요"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              새 비밀번호
            </Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="새 비밀번호 (6자 이상)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              required
              minLength={6}
            />
            <p className="text-xs text-muted-foreground">
              최소 6자 이상 입력해주세요
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              새 비밀번호 확인
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="새 비밀번호를 다시 입력하세요"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="min-w-[120px]"
            >
              {loading ? "변경 중..." : "비밀번호 변경"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCurrentPassword("")
                setNewPassword("")
                setConfirmPassword("")
                setError(null)
                setSuccess(null)
              }}
              disabled={loading}
            >
              초기화
            </Button>
          </div>

          <div className="pt-4 border-t">
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-semibold">비밀번호 변경 안내:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>현재 비밀번호를 정확히 입력해주세요</li>
                <li>새 비밀번호는 최소 6자 이상이어야 합니다</li>
                <li>보안을 위해 주기적으로 비밀번호를 변경하세요</li>
                <li>다른 사람과 비밀번호를 공유하지 마세요</li>
              </ul>
            </div>
          </div>
        </form>
        )}
      </CardContent>
    </>
  )
}
