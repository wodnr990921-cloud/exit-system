/**
 * 실시간 알림 관리자
 * SSE 연결 관리 및 알림 전송
 */

interface Notification {
  id: string
  type: 'approval_request' | 'new_ticket' | 'task_completed' | 'point_charged' | 'betting_won'
  title: string
  message: string
  timestamp: string
  data?: any
}

// 활성 연결 저장 (In-memory, 프로덕션에서는 Redis 사용 권장)
const activeConnections = new Map<string, ReadableStreamDefaultController>()

/**
 * 연결 추가
 */
export function addConnection(userId: string, controller: ReadableStreamDefaultController) {
  activeConnections.set(userId, controller)
  console.log(`[SSE] 연결 추가: ${userId} (총 ${activeConnections.size}개)`)
}

/**
 * 연결 제거
 */
export function removeConnection(userId: string) {
  activeConnections.delete(userId)
  console.log(`[SSE] 연결 제거: ${userId} (총 ${activeConnections.size}개)`)
}

/**
 * 특정 사용자에게 알림 전송
 */
export function sendNotificationToUser(userId: string, notification: Notification): boolean {
  const controller = activeConnections.get(userId)

  if (controller) {
    try {
      const encoder = new TextEncoder()
      const data = `data: ${JSON.stringify(notification)}\n\n`
      controller.enqueue(encoder.encode(data))
      console.log(`[SSE] 알림 전송 성공: ${userId}`)
      return true
    } catch (error) {
      console.error(`[SSE] 알림 전송 실패: ${userId}`, error)
      activeConnections.delete(userId)
      return false
    }
  }

  console.warn(`[SSE] 연결 없음: ${userId}`)
  return false
}

/**
 * 여러 사용자에게 알림 전송
 */
export function sendNotificationToUsers(userIds: string[], notification: Notification): number {
  let sentCount = 0

  userIds.forEach(userId => {
    if (sendNotificationToUser(userId, notification)) {
      sentCount++
    }
  })

  console.log(`[SSE] 브로드캐스트: ${sentCount}/${userIds.length}명에게 전송 완료`)
  return sentCount
}

/**
 * 활성 연결 수
 */
export function getActiveConnectionCount(): number {
  return activeConnections.size
}

/**
 * 연결된 사용자 ID 목록
 */
export function getConnectedUserIds(): string[] {
  return Array.from(activeConnections.keys())
}
