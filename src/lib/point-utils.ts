/**
 * 포인트 유틸리티 함수들
 */

/**
 * 포인트 타입에 따라 금액의 부호를 자동으로 결정
 *
 * @param amount - 원래 금액 (항상 양수로 입력받음)
 * @param type - 포인트 거래 타입 (charge, use, refund, exchange 등)
 * @returns 올바른 부호가 적용된 금액
 *
 * 규칙:
 * - charge (충전): 양수 → 포인트 증가
 * - refund (환불): 양수 → 포인트 증가
 * - use (사용/차감): 음수 → 포인트 감소
 * - exchange (전환): 음수 → 포인트 감소 (빠져나가는 쪽)
 * - 기타 모든 경우: 음수 → 기본적으로 차감으로 처리
 */
export function normalizePointAmount(amount: number, type: string): number {
  const absAmount = Math.abs(amount)

  // 충전/환불 타입만 양수, 나머지는 모두 음수
  if (type === "charge" || type === "refund") {
    return absAmount  // 양수: 포인트 증가
  }

  // use, exchange 및 기타 모든 경우는 음수
  return -absAmount  // 음수: 포인트 감소
}

/**
 * 포인트 타입 한글 라벨
 */
export function getPointTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    charge: "충전",
    use: "사용",
    refund: "환불",
    exchange: "전환",
  }
  return labels[type] || type
}

/**
 * 포인트 카테고리 한글 라벨
 */
export function getPointCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    general: "일반",
    betting: "배팅",
  }
  return labels[category] || category
}
