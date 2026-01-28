/**
 * 티켓 상태 정의 및 헬퍼 함수
 *
 * 티켓 흐름:
 * received → assigned → processing → processed → completed → closed
 */

export type TicketStatus =
  | "received"    // 접수: 티켓 생성 직후
  | "assigned"    // 배정: 담당자 배정 완료
  | "processing"  // 처리중(답변중): 담당자가 작업 중
  | "processed"   // 처리중(답변완료): 답변 완료, 승인 대기
  | "completed"   // 처리완료: 관리자 승인 완료
  | "closed"      // 마감: 일일마감 처리
  | "draft"       // 임시 저장 (하위 호환)
  | "pending"     // 대기 (하위 호환)

/**
 * 상태별 한글 라벨
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    received: "접수",
    assigned: "배정",
    processing: "처리중(답변중)",
    processed: "처리중(답변완료)",
    completed: "처리완료",
    closed: "마감",
    draft: "임시 저장",
    pending: "대기",
  }
  return labels[status] || status
}

/**
 * 상태별 색상 클래스
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    received: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    assigned: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
    processing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    processed: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    closed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
    draft: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    pending: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  }
  return colors[status] || "bg-gray-100 text-gray-800"
}

/**
 * 다음 상태로 전환 가능 여부 확인
 */
export function canTransitionTo(currentStatus: string, nextStatus: string): boolean {
  const transitions: Record<string, string[]> = {
    draft: ["received"],
    received: ["assigned", "processing"], // 자가 배정도 가능
    assigned: ["processing"],
    processing: ["processed", "assigned"], // 재배정 가능
    processed: ["completed", "processing"], // 재작업 가능
    completed: ["closed", "processing"], // 재작업 가능
    closed: [], // 마감 후에는 상태 변경 불가 (CEO만 삭제 가능)
    pending: ["received", "assigned"], // 하위 호환
  }

  return transitions[currentStatus]?.includes(nextStatus) || false
}

/**
 * 상태별 다음 단계 액션 라벨
 */
export function getNextActionLabel(status: string): string {
  const actions: Record<string, string> = {
    received: "담당자 배정",
    assigned: "처리 시작",
    processing: "답변 완료",
    processed: "처리 완료",
    completed: "마감 처리",
    closed: "-",
    draft: "접수",
    pending: "접수",
  }
  return actions[status] || "다음 단계"
}

/**
 * 해당 상태에서 편집 가능 여부
 */
export function canEdit(status: string): boolean {
  // 마감된 티켓은 편집 불가
  return status !== "closed"
}

/**
 * 해당 상태에서 삭제 가능 여부 (role 체크는 별도)
 */
export function canDelete(status: string): boolean {
  // received, draft, pending 상태에서만 일반 삭제 가능
  // closed는 CEO만 가능 (권한 체크는 별도)
  return ["received", "draft", "pending"].includes(status)
}
