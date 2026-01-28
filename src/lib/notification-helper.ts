/**
 * 실시간 알림 전송 헬퍼 함수들
 * 각 API 라우트에서 알림을 보낼 때 사용
 */

interface NotificationPayload {
  type: 'approval_request' | 'new_ticket' | 'task_completed' | 'point_charged' | 'betting_won'
  title: string
  message: string
  data?: any
}

/**
 * 특정 사용자에게 알림 전송
 */
export async function sendNotification(userId: string, payload: NotificationPayload) {
  try {
    const response = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        ...payload,
        timestamp: new Date().toISOString()
      })
    })

    return response.ok
  } catch (error) {
    console.error('알림 전송 실패:', error)
    return false
  }
}

/**
 * 역할별로 알림 브로드캐스트
 */
export async function broadcastToRoles(roles: string[], payload: NotificationPayload) {
  try {
    const response = await fetch('/api/notifications/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roles,
        ...payload,
        timestamp: new Date().toISOString()
      })
    })

    return response.ok
  } catch (error) {
    console.error('브로드캐스트 실패:', error)
    return false
  }
}

/**
 * 승인 요청 알림 (Operator 이상에게)
 */
export async function notifyApprovalRequest(taskInfo: {
  ticketNo: string
  customerName: string
  amount: number
  requestedBy: string
}) {
  return await broadcastToRoles(['ceo', 'admin', 'operator'], {
    type: 'approval_request',
    title: '🔔 승인 요청',
    message: `${taskInfo.customerName}님의 티켓 ${taskInfo.ticketNo} (${taskInfo.amount.toLocaleString()}원) 승인이 필요합니다.`,
    data: taskInfo
  })
}

/**
 * 신규 티켓 알림
 */
export async function notifyNewTicket(taskInfo: {
  ticketNo: string
  customerName: string
  category: string
  assignedTo?: string
}) {
  // 담당자가 지정된 경우 해당 담당자에게만
  if (taskInfo.assignedTo) {
    return await sendNotification(taskInfo.assignedTo, {
      type: 'new_ticket',
      title: '📋 신규 티켓 배정',
      message: `${taskInfo.customerName}님의 ${taskInfo.category} 티켓이 배정되었습니다.`,
      data: taskInfo
    })
  }

  // 모든 직원에게 브로드캐스트
  return await broadcastToRoles(['ceo', 'admin', 'operator', 'staff'], {
    type: 'new_ticket',
    title: '📋 신규 티켓',
    message: `${taskInfo.customerName}님의 ${taskInfo.category} 티켓이 생성되었습니다.`,
    data: taskInfo
  })
}

/**
 * 업무 완료 알림
 */
export async function notifyTaskCompleted(taskInfo: {
  ticketNo: string
  customerName: string
  completedBy: string
}) {
  return await broadcastToRoles(['ceo', 'admin', 'operator'], {
    type: 'task_completed',
    title: '✅ 업무 완료',
    message: `${taskInfo.customerName}님의 티켓 ${taskInfo.ticketNo}이 처리 완료되었습니다.`,
    data: taskInfo
  })
}

/**
 * 포인트 충전 알림
 */
export async function notifyPointCharged(info: {
  customerName: string
  amount: number
  category: 'general' | 'betting'
}) {
  const categoryName = info.category === 'general' ? '일반' : '베팅'

  return await broadcastToRoles(['ceo', 'admin', 'operator'], {
    type: 'point_charged',
    title: '💰 포인트 충전',
    message: `${info.customerName}님에게 ${categoryName} 포인트 ${info.amount.toLocaleString()}원이 충전되었습니다.`,
    data: info
  })
}

/**
 * 베팅 당첨 알림
 */
export async function notifyBettingWon(info: {
  customerName: string
  matchName: string
  betAmount: number
  winAmount: number
}) {
  return await broadcastToRoles(['ceo', 'admin', 'operator'], {
    type: 'betting_won',
    title: '🎉 베팅 당첨',
    message: `${info.customerName}님이 ${info.matchName}에서 ${info.winAmount.toLocaleString()}원 당첨!`,
    data: info
  })
}
