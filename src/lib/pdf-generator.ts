import jsPDF from 'jspdf'

/**
 * 일일 마감 PDF 생성 유틸리티
 * 우편 편지용 정규 규격에 맞춰 생성
 */

interface PdfTask {
  ticketNo: string
  customerName: string
  memberNumber: string
  institution: string
  items: Array<{
    category: string
    description: string
    amount: number
  }>
  totalAmount: number
  replyContent: string
  closedAt: string
}

interface PdfOptions {
  date: string
  tasks: PdfTask[]
  generatedBy?: string
}

/**
 * 한글 폰트 Base64 (간단한 폰트, 실제로는 더 완전한 폰트 필요)
 * TODO: 실제 한글 폰트를 추가해야 함 (NanumGothic 등)
 */
function addKoreanFont(doc: jsPDF) {
  // jsPDF는 기본적으로 한글을 지원하지 않음
  // 현재는 기본 폰트 사용, 나중에 한글 폰트 추가 필요
  // doc.addFileToVFS('NanumGothic.ttf', fontBase64)
  // doc.addFont('NanumGothic.ttf', 'NanumGothic', 'normal')
  // doc.setFont('NanumGothic')
}

/**
 * 텍스트를 줄바꿈 처리하여 배열로 반환
 */
function splitTextToLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  // 간단한 구현: 띄어쓰기로 분리하여 줄바꿈
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  words.forEach(word => {
    const testLine = currentLine + (currentLine ? ' ' : '') + word
    const width = doc.getTextWidth(testLine)

    if (width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  })

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

/**
 * 일일 마감 PDF 생성
 */
export async function generateDailyClosingPDF(options: PdfOptions): Promise<Blob> {
  const { date, tasks } = options

  // A4 사이즈 (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  // 한글 폰트 추가 (TODO)
  addKoreanFont(doc)

  let currentY = 20
  const pageHeight = doc.internal.pageSize.getHeight()
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  const contentWidth = pageWidth - (margin * 2)

  // 제목
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(`일일 답변 출력`, margin, currentY)

  currentY += 8
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`날짜: ${date}`, margin, currentY)

  currentY += 5
  doc.text(`총 ${tasks.length}건`, margin, currentY)

  currentY += 10

  // 구분선
  doc.setLineWidth(0.5)
  doc.line(margin, currentY, pageWidth - margin, currentY)
  currentY += 10

  // 각 티켓 출력
  tasks.forEach((task, index) => {
    // 페이지 넘김 체크
    if (currentY > pageHeight - 40) {
      doc.addPage()
      currentY = 20
    }

    // 티켓 번호 및 회원 정보
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(`${index + 1}. ${task.ticketNo}`, margin, currentY)
    currentY += 7

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`회원: ${task.customerName} (${task.memberNumber})`, margin + 5, currentY)
    currentY += 5
    doc.text(`기관: ${task.institution}`, margin + 5, currentY)
    currentY += 7

    // 답변 내용 (핵심)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(`답변 내용:`, margin + 5, currentY)
    currentY += 6

    doc.setFont('helvetica', 'normal')

    // 답변 내용을 줄바꿈 처리
    const replyLines = task.replyContent.split('\n')
    replyLines.forEach(line => {
      if (currentY > pageHeight - 20) {
        doc.addPage()
        currentY = 20
      }

      // 긴 줄은 자동 줄바꿈
      const wrappedLines = splitTextToLines(doc, line, contentWidth - 10)
      wrappedLines.forEach(wrappedLine => {
        doc.text(wrappedLine, margin + 8, currentY)
        currentY += 5
      })
    })

    currentY += 5

    // 금액 정보
    doc.setFontSize(9)
    doc.text(`총 금액: ${task.totalAmount.toLocaleString()}원`, margin + 5, currentY)
    currentY += 8

    // 구분선
    doc.setLineWidth(0.3)
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, currentY, pageWidth - margin, currentY)
    currentY += 8
  })

  // 하단 정보
  if (currentY > pageHeight - 30) {
    doc.addPage()
    currentY = 20
  }

  currentY = pageHeight - 20
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text(`생성 일시: ${new Date().toLocaleString('ko-KR')}`, margin, currentY)
  doc.text(`Exit Company 편지 관리 시스템`, pageWidth - margin - 60, currentY)

  // Blob으로 반환
  return doc.output('blob')
}

/**
 * PDF 다운로드
 */
export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 일일 마감 PDF 생성 및 다운로드 (통합 함수)
 */
export async function generateAndDownloadDailyPDF(date?: string) {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0]

    // API 호출하여 데이터 가져오기
    const response = await fetch('/api/closing/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: targetDate })
    })

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'PDF 데이터 가져오기 실패')
    }

    if (result.count === 0) {
      alert('오늘 날짜에 출력할 답변이 없습니다.')
      return
    }

    // PDF 생성
    const pdfBlob = await generateDailyClosingPDF({
      date: result.date,
      tasks: result.tasks
    })

    // 파일명 생성
    const filename = `일일답변_${result.date.replace(/-/g, '')}_${result.count}건.pdf`

    // 다운로드
    downloadPDF(pdfBlob, filename)

    return {
      success: true,
      count: result.count,
      filename
    }

  } catch (error: any) {
    console.error('PDF 생성 오류:', error)
    throw error
  }
}
