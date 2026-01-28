/**
 * 스포츠 베팅 계산 유틸리티
 * 배당률 -0.1 차감 및 당첨금 계산
 */

export interface BettingOdds {
  original: number  // 원본 배당률
  adjusted: number  // 조정된 배당률 (-0.1)
  margin: number    // 차감된 마진
}

/**
 * 배당률에서 자동으로 -0.1 차감
 *
 * @param originalOdds 원본 배당률
 * @returns 조정된 배당률 정보
 */
export function adjustOdds(originalOdds: number): BettingOdds {
  const MARGIN = 0.1
  const adjusted = Math.max(1.0, originalOdds - MARGIN) // 최소 1.0 보장

  return {
    original: originalOdds,
    adjusted: adjusted,
    margin: originalOdds - adjusted
  }
}

/**
 * 배당률 배열에서 평균 배당률 계산 후 -0.1 차감
 *
 * @param odds 배당률 배열
 * @returns 조정된 평균 배당률
 */
export function adjustAverageOdds(odds: number[]): BettingOdds {
  if (odds.length === 0) {
    return {
      original: 1.0,
      adjusted: 1.0,
      margin: 0
    }
  }

  const average = odds.reduce((sum, odd) => sum + odd, 0) / odds.length
  return adjustOdds(average)
}

/**
 * 당첨금 계산
 *
 * @param betAmount 베팅 금액
 * @param adjustedOdds 조정된 배당률
 * @returns 당첨금 (원금 제외)
 */
export function calculateWinnings(betAmount: number, adjustedOdds: number): number {
  return Math.floor(betAmount * adjustedOdds)
}

/**
 * 순수익 계산 (당첨금 - 베팅금액)
 *
 * @param betAmount 베팅 금액
 * @param adjustedOdds 조정된 배당률
 * @returns 순수익
 */
export function calculateNetProfit(betAmount: number, adjustedOdds: number): number {
  const winnings = calculateWinnings(betAmount, adjustedOdds)
  return winnings - betAmount
}

/**
 * 여러 경기 조합 베팅의 총 배당률 계산
 * 각 배당률에 -0.1씩 차감 후 곱함
 *
 * @param oddsArray 각 경기의 배당률 배열
 * @returns 조정된 총 배당률
 */
export function calculateComboOdds(oddsArray: number[]): BettingOdds {
  if (oddsArray.length === 0) {
    return {
      original: 1.0,
      adjusted: 1.0,
      margin: 0
    }
  }

  // 각 배당률에 -0.1 차감
  const adjustedOddsArray = oddsArray.map(odd => adjustOdds(odd).adjusted)

  // 조정된 배당률들을 곱함
  const combinedAdjusted = adjustedOddsArray.reduce((product, odd) => product * odd, 1.0)

  // 원본 배당률들을 곱함 (비교용)
  const combinedOriginal = oddsArray.reduce((product, odd) => product * odd, 1.0)

  return {
    original: combinedOriginal,
    adjusted: combinedAdjusted,
    margin: combinedOriginal - combinedAdjusted
  }
}

/**
 * 베팅 정보 포맷팅 (표시용)
 */
export function formatBettingInfo(betAmount: number, odds: BettingOdds) {
  const winnings = calculateWinnings(betAmount, odds.adjusted)
  const netProfit = winnings - betAmount

  return {
    betAmount: betAmount.toLocaleString() + '원',
    originalOdds: odds.original.toFixed(2),
    adjustedOdds: odds.adjusted.toFixed(2),
    margin: odds.margin.toFixed(2),
    expectedWinnings: winnings.toLocaleString() + '원',
    netProfit: netProfit.toLocaleString() + '원',
    profitSign: netProfit >= 0 ? '+' : ''
  }
}

/**
 * 예제 사용법
 */
export function example() {
  // 단일 경기
  const singleOdds = adjustOdds(2.5)
  console.log('단일 경기:', formatBettingInfo(10000, singleOdds))
  // 원본: 2.50, 조정: 2.40 → 베팅 10,000원 → 당첨 24,000원 (+14,000원)

  // 조합 베팅 (3경기)
  const comboOdds = calculateComboOdds([1.8, 2.2, 1.5])
  console.log('조합 베팅:', formatBettingInfo(10000, comboOdds))
  // 원본: 5.94, 조정: 5.202 → 베팅 10,000원 → 당첨 52,020원 (+42,020원)
}
