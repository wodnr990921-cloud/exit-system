/**
 * 이미지 전처리 라이브러리
 * OCR 정확도 향상을 위한 이미지 보정 기능을 제공합니다.
 */

export interface PreprocessingOptions {
  autoRotate?: boolean
  autoBrightness?: boolean
  removeNoise?: boolean
  enhanceContrast?: boolean
  detectTextRegions?: boolean
  maxWidth?: number
  maxHeight?: number
}

export interface PreprocessingResult {
  processedImage: Blob
  metadata: {
    originalWidth: number
    originalHeight: number
    processedWidth: number
    processedHeight: number
    rotationApplied: number
    brightnessAdjustment: number
    contrastAdjustment: number
    textRegions?: Array<{
      x: number
      y: number
      width: number
      height: number
    }>
  }
}

/**
 * 이미지를 전처리합니다.
 */
export async function preprocessImage(
  file: File,
  options: PreprocessingOptions = {}
): Promise<PreprocessingResult> {
  const {
    autoRotate = true,
    autoBrightness = true,
    removeNoise = true,
    enhanceContrast = true,
    maxWidth = 2400,
    maxHeight = 2400,
  } = options

  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = (e) => {
      img.src = e.target?.result as string
    }

    img.onload = async () => {
      try {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")

        if (!ctx) {
          throw new Error("Canvas context를 생성할 수 없습니다.")
        }

        let width = img.width
        let height = img.height

        // 1. 크기 조정
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.floor(width * ratio)
          height = Math.floor(height * ratio)
        }

        canvas.width = width
        canvas.height = height

        // 2. 이미지 그리기
        ctx.drawImage(img, 0, 0, width, height)

        // 3. 이미지 데이터 가져오기
        const imageData = ctx.getImageData(0, 0, width, height)
        const data = imageData.data

        // 4. 회전 감지 (간단한 버전 - 텍스트 방향성 기반)
        let rotationApplied = 0
        if (autoRotate) {
          rotationApplied = detectRotation(imageData)
          if (rotationApplied !== 0) {
            applyRotation(canvas, ctx, rotationApplied)
          }
        }

        // 5. 밝기/대비 자동 조정
        let brightnessAdjustment = 0
        let contrastAdjustment = 0

        if (autoBrightness || enhanceContrast) {
          const stats = calculateImageStats(data)

          if (autoBrightness) {
            brightnessAdjustment = calculateBrightnessAdjustment(stats)
            applyBrightness(data, brightnessAdjustment)
          }

          if (enhanceContrast) {
            contrastAdjustment = calculateContrastAdjustment(stats)
            applyContrast(data, contrastAdjustment)
          }

          ctx.putImageData(imageData, 0, 0)
        }

        // 6. 노이즈 제거 (간단한 median filter)
        if (removeNoise) {
          const denoisedData = applyMedianFilter(imageData)
          ctx.putImageData(denoisedData, 0, 0)
        }

        // 7. 샤프닝 (텍스트 선명도 향상)
        const sharpenedData = applySharpen(ctx.getImageData(0, 0, width, height))
        ctx.putImageData(sharpenedData, 0, 0)

        // 8. Blob 생성
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("이미지 변환에 실패했습니다."))
              return
            }

            resolve({
              processedImage: blob,
              metadata: {
                originalWidth: img.width,
                originalHeight: img.height,
                processedWidth: width,
                processedHeight: height,
                rotationApplied,
                brightnessAdjustment,
                contrastAdjustment,
              },
            })
          },
          "image/jpeg",
          0.92
        )
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error("이미지를 로드할 수 없습니다."))
    }

    reader.onerror = () => {
      reject(new Error("파일을 읽을 수 없습니다."))
    }

    reader.readAsDataURL(file)
  })
}

/**
 * 이미지 통계 계산
 */
function calculateImageStats(data: Uint8ClampedArray) {
  let sum = 0
  let min = 255
  let max = 0

  // 그레이스케일 값 기준
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    sum += gray
    min = Math.min(min, gray)
    max = Math.max(max, gray)
  }

  const pixels = data.length / 4
  const mean = sum / pixels

  return { mean, min, max }
}

/**
 * 밝기 조정값 계산
 */
function calculateBrightnessAdjustment(stats: { mean: number; min: number; max: number }): number {
  const targetMean = 128 // 목표 평균 밝기
  return targetMean - stats.mean
}

/**
 * 대비 조정값 계산
 */
function calculateContrastAdjustment(stats: { mean: number; min: number; max: number }): number {
  const range = stats.max - stats.min
  if (range < 100) {
    return 1.5 // 대비가 낮으면 증가
  } else if (range > 200) {
    return 0.8 // 대비가 너무 높으면 감소
  }
  return 1.0
}

/**
 * 밝기 적용
 */
function applyBrightness(data: Uint8ClampedArray, adjustment: number) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, data[i] + adjustment))
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + adjustment))
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + adjustment))
  }
}

/**
 * 대비 적용
 */
function applyContrast(data: Uint8ClampedArray, factor: number) {
  const f = (259 * (factor * 255 + 255)) / (255 * (259 - factor * 255))

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, f * (data[i] - 128) + 128))
    data[i + 1] = Math.max(0, Math.min(255, f * (data[i + 1] - 128) + 128))
    data[i + 2] = Math.max(0, Math.min(255, f * (data[i + 2] - 128) + 128))
  }
}

/**
 * 회전 감지 (간단한 버전)
 */
function detectRotation(imageData: ImageData): number {
  // 실제로는 더 복잡한 알고리즘 필요
  // 여기서는 EXIF 데이터나 edge detection을 사용해야 함
  // 지금은 0도 반환 (회전 없음)
  return 0
}

/**
 * 회전 적용
 */
function applyRotation(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  degrees: number
) {
  const radians = (degrees * Math.PI) / 180
  const width = canvas.width
  const height = canvas.height

  // 90도 단위 회전만 지원
  if (degrees === 90 || degrees === 270) {
    canvas.width = height
    canvas.height = width
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(radians)
  ctx.drawImage(canvas, -width / 2, -height / 2)
  ctx.restore()
}

/**
 * Median Filter (노이즈 제거)
 */
function applyMedianFilter(imageData: ImageData): ImageData {
  const { width, height, data } = imageData
  const output = new ImageData(width, height)
  const outputData = output.data

  // 3x3 median filter
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4

      for (let c = 0; c < 3; c++) {
        const neighbors: number[] = []

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nIdx = ((y + dy) * width + (x + dx)) * 4 + c
            neighbors.push(data[nIdx])
          }
        }

        neighbors.sort((a, b) => a - b)
        outputData[idx + c] = neighbors[4] // median
      }

      outputData[idx + 3] = 255 // alpha
    }
  }

  return output
}

/**
 * Sharpen Filter (선명도 향상)
 */
function applySharpen(imageData: ImageData): ImageData {
  const { width, height, data } = imageData
  const output = new ImageData(width, height)
  const outputData = output.data

  // Sharpen kernel
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ]

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4

      for (let c = 0; c < 3; c++) {
        let sum = 0
        let ki = 0

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nIdx = ((y + dy) * width + (x + dx)) * 4 + c
            sum += data[nIdx] * kernel[ki++]
          }
        }

        outputData[idx + c] = Math.max(0, Math.min(255, sum))
      }

      outputData[idx + 3] = 255 // alpha
    }
  }

  return output
}

/**
 * 이미지 압축 (기존 함수 개선)
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1600,
  maxHeight: number = 1600,
  quality: number = 0.85
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement("canvas")
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        ctx?.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              })
              resolve(compressedFile)
            } else {
              reject(new Error("압축 실패"))
            }
          },
          "image/jpeg",
          quality
        )
      }
      img.onerror = reject
    }
    reader.onerror = reject
  })
}

/**
 * HEIC를 JPEG로 변환
 */
export async function convertHeicToJpeg(file: File): Promise<File> {
  // HEIC 변환은 브라우저에서 직접 지원하지 않으므로
  // 서버사이드에서 처리하거나 heic2any 라이브러리 사용 필요
  // 여기서는 파일을 그대로 반환 (서버에서 처리)
  return file
}

/**
 * 파일 크기 제한 검증
 */
export function validateFileSize(file: File, maxSizeMB: number = 10): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024
  return file.size <= maxSizeBytes
}

/**
 * 파일 형식 검증
 */
export function validateFileFormat(file: File): boolean {
  const supportedFormats = ["image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif"]
  return supportedFormats.includes(file.type.toLowerCase())
}
