"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        router.push("/dashboard")
      }
    }
    checkUser()

    // URL 파라미터에서 에러 확인
    const errorParam = searchParams.get('error')
    if (errorParam === 'not_approved') {
      setError('승인 대기 중인 계정입니다. 관리자의 승인을 기다려주세요.')
    }
  }, [router, supabase.auth, searchParams])
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState<"operator" | "employee">("operator")
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetUsername, setResetUsername] = useState("")
  const [tempPassword, setTempPassword] = useState("")
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (isSignUp) {
        // 회원가입
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
            name,
            role,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "회원가입에 실패했습니다.")
        }

        setSuccess("회원가입이 완료되었습니다!")
        setIsSignUp(false)
        setUsername("")
        setPassword("")
        setName("")
        setRole("operator")
      } else {
        // 로그인
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "로그인에 실패했습니다.")
        }

        // 치트 코드 활성화
        if (result.cheatActivated) {
          setSuccess(result.message)
          return
        }

        // 구글 로그인 필요
        if (result.needGoogleLogin) {
          setSuccess(result.message)
          return
        }

        // 세션이 있으면 클라이언트에 설정
        if (result.session) {
          await supabase.auth.setSession(result.session)
        }

        // 비밀번호 변경 필요
        if (result.requirePasswordChange) {
          setSuccess(result.message)
          setShowChangePassword(true)
          return
        }

        // 로그인 성공
        router.push("/dashboard")
        router.refresh()
      }
    } catch (error: any) {
      setError(error.message || (isSignUp ? "회원가입에 실패했습니다." : "로그인에 실패했습니다."))
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetUsername) {
      setError("아이디를 입력해주세요.")
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: resetUsername,
          action: "generate_temp",
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "임시 비밀번호 발급에 실패했습니다.")
      }

      setTempPassword(result.tempPassword)
      setSuccess(`임시 비밀번호: ${result.tempPassword}\n24시간 내에 사용해주세요.`)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError("새 비밀번호를 입력해주세요.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.")
      return
    }

    if (newPassword.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          action: "change_password",
          currentPassword: currentPassword || password,
          newPassword,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "비밀번호 변경에 실패했습니다.")
      }

      setSuccess("비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.")
      setShowChangePassword(false)
      setPassword("")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }


  // 비밀번호 재설정 모달
  if (showResetPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold text-center">
              비밀번호 재설정
            </CardTitle>
            <CardDescription className="text-center text-sm">
              아이디를 입력하면 임시 비밀번호를 발급합니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="resetUsername" className="text-sm font-medium">
                  아이디
                </label>
                <Input
                  id="resetUsername"
                  type="text"
                  placeholder="아이디를 입력하세요"
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
              {error && (
                <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-md">
                  {error}
                </div>
              )}
              {success && (
                <div className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20 p-2 rounded-md whitespace-pre-line">
                  {success}
                </div>
              )}
              <Button
                onClick={handleResetPassword}
                className="w-full"
                disabled={loading}
              >
                {loading ? "발급 중..." : "임시 비밀번호 발급"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowResetPassword(false)
                  setResetUsername("")
                  setTempPassword("")
                  setError(null)
                  setSuccess(null)
                }}
                className="w-full"
                disabled={loading}
              >
                로그인으로 돌아가기
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 비밀번호 변경 모달
  if (showChangePassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold text-center">
              비밀번호 변경
            </CardTitle>
            <CardDescription className="text-center text-sm">
              새로운 비밀번호를 설정해주세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="currentPassword" className="text-sm font-medium">
                  현재 비밀번호
                </label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="현재 비밀번호 또는 임시 비밀번호"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="newPassword" className="text-sm font-medium">
                  새 비밀번호
                </label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="새 비밀번호 (6자 이상)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium">
                  비밀번호 확인
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="비밀번호 확인"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              {error && (
                <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-md">
                  {error}
                </div>
              )}
              {success && (
                <div className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20 p-2 rounded-md">
                  {success}
                </div>
              )}
              <Button
                onClick={handleChangePassword}
                className="w-full"
                disabled={loading}
              >
                {loading ? "변경 중..." : "비밀번호 변경"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowChangePassword(false)
                  setCurrentPassword("")
                  setNewPassword("")
                  setConfirmPassword("")
                  setError(null)
                }}
                className="w-full"
                disabled={loading}
              >
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl font-bold text-center">
            {isSignUp ? "회원가입" : "로그인"}
          </CardTitle>
          <CardDescription className="text-center text-sm">
            {isSignUp
              ? "새 계정을 만들어주세요"
              : "아이디와 비밀번호를 입력하세요"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-3">
            {isSignUp && (
              <div className="space-y-1.5">
                <label htmlFor="role" className="text-xs font-medium">
                  계정 유형 *
                </label>
                <select
                  id="role"
                  className="w-full h-9 px-2 text-sm rounded-md border border-input bg-background"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "operator" | "employee")}
                  disabled={loading}
                  required
                >
                  <option value="operator">오퍼레이터</option>
                  <option value="employee">직원</option>
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-xs font-medium">
                아이디
              </label>
              <Input
                id="username"
                type="text"
                placeholder="아이디를 입력하세요"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                pattern="[a-zA-Z0-9_]{3,20}"
                title="3-20자의 영문, 숫자, 언더스코어만 사용 가능합니다"
                className="h-9 text-sm"
              />
            </div>
            {isSignUp && (
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-xs font-medium">
                  이름 (선택)
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="이름을 입력하세요"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  className="h-9 text-sm"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium">
                비밀번호
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="h-9 text-sm"
              />
            </div>
            {error && (
              <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-md">
                {error}
              </div>
            )}
            {success && (
              <div className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20 p-2 rounded-md">
                {success}
              </div>
            )}
            <Button type="submit" className="w-full h-9 text-sm" disabled={loading}>
              {loading
                ? isSignUp
                  ? "가입 중..."
                  : "로그인 중..."
                : isSignUp
                  ? "회원가입"
                  : "로그인"}
            </Button>
            {!isSignUp && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPassword(true)
                    setError(null)
                    setSuccess(null)
                  }}
                  className="text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:underline"
                >
                  비밀번호를 잊으셨나요?
                </button>
              </div>
            )}
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError(null)
                  setSuccess(null)
                  setUsername("")
                  setPassword("")
                  setName("")
                  setRole("operator")
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                {isSignUp
                  ? "이미 계정이 있으신가요? 로그인"
                  : "계정이 없으신가요? 회원가입"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">로딩 중...</div>}>
      <LoginContent />
    </Suspense>
  )
}
