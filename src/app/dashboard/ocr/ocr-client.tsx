"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface UploadResult {
  success: boolean
  letter?: any
  fileUrl?: string
  filePath?: string
  ocrText?: string
  message?: string
  error?: string
  details?: string
}

export default function OcrClient() {
  const router = useRouter()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    setUploadProgress(0)
    setError(null)
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      setUploadProgress(10)

      const response = await fetch("/api/upload-letter", {
        method: "POST",
        body: formData,
      })

      setUploadProgress(50)

      const result: UploadResult = await response.json()

      setUploadProgress(90)

      if (!response.ok) {
        throw new Error(result.error || result.details || "업로드에 실패했습니다.")
      }

      setUploadResult(result)
      setUploadProgress(100)

      // 업로드 성공 후 파일 선택 초기화
      setTimeout(() => {
        setSelectedFile(null)
        setUploadResult(null)
      }, 5000)
    } catch (error: any) {
      console.error("Upload error:", error)
      setError(error.message || "업로드 중 오류가 발생했습니다.")
    } finally {
      setUploading(false)
      setTimeout(() => setUploadProgress(0), 1000)
    }
  }

  const handleFileReset = () => {
    setSelectedFile(null)
    setUploadResult(null)
    setError(null)
    setUploadProgress(0)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => router.back()}>
            ← 뒤로가기
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            홈
          </Button>
          <h1 className="text-3xl font-bold">OCR 업로드</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>편지 이미지 업로드</CardTitle>
            <CardDescription>
              편지 이미지를 업로드하면 OCR로 자동 인식됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <svg
                  className="w-12 h-12 text-gray-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedFile
                    ? `선택된 파일: ${selectedFile.name}`
                    : "클릭하여 파일 선택 또는 드래그 앤 드롭"}
                </span>
              </label>
            </div>

            {selectedFile && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    파일 정보:
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleFileReset}
                    disabled={uploading}
                  >
                    변경
                  </Button>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <p className="text-sm">
                    <strong>이름:</strong> {selectedFile.name}
                  </p>
                  <p className="text-sm">
                    <strong>크기:</strong> {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                  <p className="text-sm">
                    <strong>타입:</strong> {selectedFile.type}
                  </p>
                </div>
              </div>
            )}

            {uploading && uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    업로드 진행 중...
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">
                  <strong>오류:</strong> {error}
                </p>
              </div>
            )}

            {uploadResult && uploadResult.success && (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                    ✓ {uploadResult.message || "업로드 및 OCR 처리 완료!"}
                  </p>
                </div>

                {uploadResult.fileUrl && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">업로드된 이미지:</div>
                    <img
                      src={uploadResult.fileUrl}
                      alt="Uploaded letter"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700"
                    />
                  </div>
                )}

                {uploadResult.ocrText && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">OCR 인식 결과:</div>
                    <Card>
                      <CardContent className="p-4">
                        <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 dark:bg-gray-800 p-4 rounded-lg max-h-96 overflow-y-auto">
                          {uploadResult.ocrText}
                        </pre>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="flex-1"
              >
                {uploading ? "처리 중..." : "업로드 및 OCR 처리"}
              </Button>
              {selectedFile && !uploading && (
                <Button
                  variant="outline"
                  onClick={handleFileReset}
                  className="flex-1"
                >
                  취소
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
