import { createClient } from "@/lib/supabase/server"

export interface NotificationData {
  customerId: string
  notificationType: "charge" | "deposit" | "transfer" | "win" | "transfer_sent" | "transfer_received"
  message: string
  relatedTaskId?: string
  relatedPointId?: string
  relatedTaskItemId?: string
}

export async function createCustomerNotification(data: NotificationData): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.from("customer_notifications").insert({
      customer_id: data.customerId,
      notification_type: data.notificationType,
      message: data.message,
      related_task_id: data.relatedTaskId || null,
      related_point_id: data.relatedPointId || null,
      related_task_item_id: data.relatedTaskItemId || null,
      sent: false,
    })

    if (error) {
      console.error("Error creating customer notification:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Error in createCustomerNotification:", error)
    return false
  }
}

/**
 * 포인트 충전 알림 생성
 */
export async function createChargeNotification(
  customerId: string,
  customerName: string,
  amount: number,
  category: "general" | "betting",
  pointId?: string
): Promise<boolean> {
  const categoryLabel = category === "general" ? "일반" : "배팅"
  const message = `[충전] ${customerName}님, ${categoryLabel} 포인트 ${amount.toLocaleString()}원 충전되었습니다. 현재 잔액: 확인 필요`

  return createCustomerNotification({
    customerId,
    notificationType: "charge",
    message,
    relatedPointId: pointId,
  })
}

/**
 * 입금 알림 생성
 */
export async function createDepositNotification(
  customerId: string,
  customerName: string,
  depositorName: string,
  amount: number,
  pointId?: string
): Promise<boolean> {
  const message = `[입금] ${customerName}님, "${depositorName}"으로 ${amount.toLocaleString()}원 입금 정상 처리되었습니다!`

  return createCustomerNotification({
    customerId,
    notificationType: "deposit",
    message,
    relatedPointId: pointId,
  })
}

/**
 * 당첨 알림 생성
 */
export async function createWinNotification(
  customerId: string,
  customerName: string,
  gameDate: string,
  gameName: string,
  odds: number,
  taskItemId?: string
): Promise<boolean> {
  const message = `[당첨] 축하합니다. ${customerName}님, "${gameDate}"- "${gameName}" 배당 "${odds.toFixed(1)}배"로 당첨 처리되었습니다!`

  return createCustomerNotification({
    customerId,
    notificationType: "win",
    message,
    relatedTaskItemId: taskItemId,
  })
}

/**
 * 포인트 양도 알림 생성 (보낸 사람용)
 */
export async function createTransferSentNotification(
  customerId: string,
  customerName: string,
  recipientName: string,
  amount: number,
  pointId?: string
): Promise<boolean> {
  const message = `[양도] ${customerName}님, ${recipientName}님 앞으로 포인트 ${amount.toLocaleString()}원 이전 정상 처리 되었습니다.`

  return createCustomerNotification({
    customerId,
    notificationType: "transfer_sent",
    message,
    relatedPointId: pointId,
  })
}

/**
 * 포인트 양도 알림 생성 (받은 사람용)
 */
export async function createTransferReceivedNotification(
  customerId: string,
  customerName: string,
  senderName: string,
  amount: number,
  pointId?: string
): Promise<boolean> {
  const message = `[충전] ${customerName}님, ${senderName}님께서 포인트 ${amount.toLocaleString()}원을 선물하셨습니다. "현재 잔액: 확인 필요"`

  return createCustomerNotification({
    customerId,
    notificationType: "transfer_received",
    message,
    relatedPointId: pointId,
  })
}

/**
 * 이체완료 알림 생성
 */
export async function createTransferCompleteNotification(
  customerId: string,
  customerName: string,
  accountInfo: string,
  depositorName: string,
  amount: number,
  taskId?: string
): Promise<boolean> {
  const message = `[이체] ${customerName}님, 요청하신 "${accountInfo}"에 "${depositorName}" 이름으로 ${amount.toLocaleString()}원 입금 정상 처리되었습니다.`

  return createCustomerNotification({
    customerId,
    notificationType: "transfer",
    message,
    relatedTaskId: taskId,
  })
}
