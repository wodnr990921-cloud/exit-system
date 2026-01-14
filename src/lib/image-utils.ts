/**
 * 이미지 전처리 유틸리티
 * OCR 정확도 향상을 위한 이미지 최적화 기능
 */

/**
 * 이미지 전처리 옵션
 */
export interface ImagePreprocessOptions {
  maxWidth?: number // 최대 너비 (기본값: 2000)
  maxHeight?: number // 최대 높이 (기본값: 2000)
  quality?: number // JPEG 품질 (0-1, 기본값: 0.92)
  format?: "jpeg" | "png" | "webp" // 출력 형식 (기본값: jpeg)
  autoRotate?: boolean // EXIF 기반 자동 회전 (기본값: true)
  sharpen?: boolean // 선명도 향상 (기본값: false)
  contrast?: number // 대비 조정 (-100 ~ 100, 기본값: 0)
  brightness?: number // 밝기 조정 (-100 ~ 100, 기본값: 0)
  grayscale?: boolean // 흑백 변환 (기본값: false)
}

/**
 * 이미지 메타데이터
 */
export interface ImageMetadata {
  width: number
  height: number
  format: string
  size: number // bytes
  orientation?: number // EXIF orientation
  hasAlpha: boolean
}

/**
 * File을 Base64 문자열로 인코딩
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const result = reader.result as string
      // data:image/jpeg;base64, 부분 제거
      const base64 = result.split(",")[1]
      resolve(base64)
    }
    reader.onerror = (error) => reject(error)
  })
}

/**
 * Base64 문자열을 Blob으로 변환
 */
export function base64ToBlob(base64: string, mimeType: string = "image/jpeg"): Blob {
  const byteString = atob(base64)
  const arrayBuffer = new ArrayBuffer(byteString.length)
  const uint8Array = new Uint8Array(arrayBuffer)

  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i)
  }

  return new Blob([arrayBuffer], { type: mimeType })
}

/**
 * Base64 문자열을 File 객체로 변환
 */
export function base64ToFile(base64: string, fileName: string, mimeType: string = "image/jpeg"): File {
  const blob = base64ToBlob(base64, mimeType)
  return new File([blob], fileName, { type: mimeType })
}

/**
 * 이미지 리사이즈
 */
export async function resizeImage(
  file: File,
  maxWidth: number = 2000,
  maxHeight: number = 2000,
  quality: number = 0.92
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)

    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string

      img.onload = () => {
        let { width, height } = img

        // 비율 유지하면서 리사이즈
        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height

          if (width > height) {
            width = Math.min(width, maxWidth)
            height = width / aspectRatio
          } else {
            height = Math.min(height, maxHeight)
            width = height * aspectRatio
          }
        }

        // Canvas에 그리기
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Canvas context not available"))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        // Blob으로 변환
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const resizedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              })
              resolve(resizedFile)
            } else {
              reject(new Error("이미지 변환 실패"))
            }
          },
          "image/jpeg",
          quality
        )
      }

      img.onerror = () => reject(new Error("이미지 로드 실패"))
    }

    reader.onerror = () => reject(new Error("파일 읽기 실패"))
  })
}

/**
 * 이미지 회전
 */
export async function rotateImage(file: File, degrees: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)

    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string

      img.onload = () => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Canvas context not available"))
          return
        }

        // 90도 또는 270도 회전 시 너비/높이 교환
        if (degrees === 90 || degrees === 270) {
          canvas.width = img.height
          canvas.height = img.width
        } else {
          canvas.width = img.width
          canvas.height = img.height
        }

        // 중심점 기준으로 회전
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate((degrees * Math.PI) / 180)
        ctx.drawImage(img, -img.width / 2, -img.height / 2)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const rotatedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              })
              resolve(rotatedFile)
            } else {
              reject(new Error("이미지 변환 실패"))
            }
          },
          "image/jpeg",
          0.92
        )
      }

      img.onerror = () => reject(new Error("이미지 로드 실패"))
    }

    reader.onerror = () => reject(new Error("파일 읽기 실패"))
  })
}

/**
 * 이미지 밝기/대비 조정
 */
export async function adjustImageBrightnessContrast(
  file: File,
  brightness: number = 0, // -100 ~ 100
  contrast: number = 0 // -100 ~ 100
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)

    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string

      img.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Canvas context not available"))
          return
        }

        ctx.drawImage(img, 0, 0)

        // 픽셀 데이터 가져오기
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        // 대비 조정 계산
        const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast))

        // 각 픽셀 조정
        for (let i = 0; i < data.length; i += 4) {
          // 밝기 조정
          data[i] += brightness // Red
          data[i + 1] += brightness // Green
          data[i + 2] += brightness // Blue

          // 대비 조정
          data[i] = contrastFactor * (data[i] - 128) + 128
          data[i + 1] = contrastFactor * (data[i + 1] - 128) + 128
          data[i + 2] = contrastFactor * (data[i + 2] - 128) + 128

          // 0-255 범위로 제한
          data[i] = Math.max(0, Math.min(255, data[i]))
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1]))
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2]))
        }

        ctx.putImageData(imageData, 0, 0)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const adjustedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              })
              resolve(adjustedFile)
            } else {
              reject(new Error("이미지 변환 실패"))
            }
          },
          "image/jpeg",
          0.92
        )
      }

      img.onerror = () => reject(new Error("이미지 로드 실패"))
    }

    reader.onerror = () => reject(new Error("파일 읽기 실패"))
  })
}

/**
 * 이미지 흑백 변환
 */
export async function convertToGrayscale(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)

    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string

      img.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Canvas context not available"))
          return
        }

        ctx.drawImage(img, 0, 0)

        // 픽셀 데이터 가져오기
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        // 각 픽셀을 흑백으로 변환
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
          data[i] = gray // Red
          data[i + 1] = gray // Green
          data[i + 2] = gray // Blue
        }

        ctx.putImageData(imageData, 0, 0)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const grayscaleFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              })
              resolve(grayscaleFile)
            } else {
              reject(new Error("이미지 변환 실패"))
            }
          },
          "image/jpeg",
          0.92
        )
      }

      img.onerror = () => reject(new Error("이미지 로드 실패"))
    }

    reader.onerror = () => reject(new Error("파일 읽기 실패"))
  })
}

/**
 * 이미지 선명도 향상 (Unsharp Mask)
 */
export async function sharpenImage(file: File, amount: number = 1.5): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)

    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string

      img.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Canvas context not available"))
          return
        }

        ctx.drawImage(img, 0, 0)

        // CSS filter를 사용한 선명도 향상
        ctx.filter = `contrast(${100 + amount * 10}%) brightness(${100 + amount * 5}%)`
        ctx.drawImage(canvas, 0, 0)
        ctx.filter = "none"

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const sharpenedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              })
              resolve(sharpenedFile)
            } else {
              reject(new Error("이미지 변환 실패"))
            }
          },
          "image/jpeg",
          0.92
        )
      }

      img.onerror = () => reject(new Error("이미지 로드 실패"))
    }

    reader.onerror = () => reject(new Error("파일 읽기 실패"))
  })
}

/**
 * 종합 이미지 전처리 (OCR용)
 */
export async function preprocessImageForOcr(
  file: File,
  options: ImagePreprocessOptions = {}
): Promise<File> {
  const {
    maxWidth = 2000,
    maxHeight = 2000,
    quality = 0.92,
    autoRotate = true,
    sharpen = false,
    contrast = 0,
    brightness = 0,
    grayscale = false,
  } = options

  let processedFile = file

  try {
    // 1. 리사이즈
    processedFile = await resizeImage(processedFile, maxWidth, maxHeight, quality)

    // 2. 흑백 변환 (선택사항)
    if (grayscale) {
      processedFile = await convertToGrayscale(processedFile)
    }

    // 3. 밝기/대비 조정
    if (brightness !== 0 || contrast !== 0) {
      processedFile = await adjustImageBrightnessContrast(processedFile, brightness, contrast)
    }

    // 4. 선명도 향상 (선택사항)
    if (sharpen) {
      processedFile = await sharpenImage(processedFile)
    }

    return processedFile
  } catch (error) {
    console.error("Image preprocessing error:", error)
    // 전처리 실패 시 원본 반환
    return file
  }
}

/**
 * 이미지 메타데이터 추출
 */
export async function getImageMetadata(file: File): Promise<ImageMetadata> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)

    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string

      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height,
          format: file.type,
          size: file.size,
          hasAlpha: file.type === "image/png",
        })
      }

      img.onerror = () => reject(new Error("이미지 로드 실패"))
    }

    reader.onerror = () => reject(new Error("파일 읽기 실패"))
  })
}

/**
 * 이미지 품질 검증
 */
export async function validateImageQuality(file: File): Promise<{
  valid: boolean
  warnings: string[]
  metadata: ImageMetadata
}> {
  const warnings: string[] = []

  try {
    const metadata = await getImageMetadata(file)

    // 크기 검증
    if (metadata.size > 10 * 1024 * 1024) {
      warnings.push("파일 크기가 10MB를 초과합니다.")
    }

    // 해상도 검증
    if (metadata.width < 200 || metadata.height < 200) {
      warnings.push("해상도가 너무 낮습니다. (최소 200x200 권장)")
    }

    if (metadata.width > 4000 || metadata.height > 4000) {
      warnings.push("해상도가 너무 높습니다. (최대 4000x4000 권장)")
    }

    // 형식 검증
    const supportedFormats = ["image/jpeg", "image/jpg", "image/png", "image/heic", "image/webp"]
    if (!supportedFormats.includes(metadata.format.toLowerCase())) {
      warnings.push("지원하지 않는 이미지 형식입니다.")
    }

    return {
      valid: warnings.length === 0,
      warnings,
      metadata,
    }
  } catch (error) {
    return {
      valid: false,
      warnings: ["이미지를 읽을 수 없습니다."],
      metadata: {
        width: 0,
        height: 0,
        format: file.type,
        size: file.size,
        hasAlpha: false,
      },
    }
  }
}

/**
 * 이미지 배치 압축
 */
export async function compressImages(
  files: File[],
  options: ImagePreprocessOptions = {},
  onProgress?: (current: number, total: number) => void
): Promise<File[]> {
  const compressed: File[] = []

  for (let i = 0; i < files.length; i++) {
    try {
      const compressedFile = await preprocessImageForOcr(files[i], options)
      compressed.push(compressedFile)

      if (onProgress) {
        onProgress(i + 1, files.length)
      }
    } catch (error) {
      console.error(`Failed to compress ${files[i].name}:`, error)
      // 압축 실패 시 원본 추가
      compressed.push(files[i])
    }
  }

  return compressed
}

/**
 * 이미지 데이터 URL 생성
 */
export async function createImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

/**
 * 이미지 다운로드
 */
export function downloadImage(dataUrl: string, fileName: string) {
  const link = document.createElement("a")
  link.href = dataUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
