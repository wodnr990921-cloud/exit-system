import { useEffect, useState, useRef } from 'react'

export interface Notification {
  id: string
  type: 'approval_request' | 'new_ticket' | 'task_completed' | 'point_charged' | 'betting_won' | 'connection'
  title: string
  message: string
  timestamp: string
  data?: any
}

/**
 * 실시간 알림을 위한 SSE Hook
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // SSE 연결
    const eventSource = new EventSource('/api/notifications/sse')
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log('[SSE] 연결됨')
      setConnected(true)
      setError(null)
    }

    eventSource.onmessage = (event) => {
      try {
        const notification: Notification = JSON.parse(event.data)

        // connection 타입은 무시 (초기 연결 메시지)
        if (notification.type === 'connection') {
          console.log('[SSE] 초기화:', notification.message)
          return
        }

        console.log('[SSE] 알림 수신:', notification)

        setNotifications(prev => [notification, ...prev].slice(0, 50)) // 최대 50개 유지

        // 브라우저 알림 표시 (권한이 있는 경우)
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico',
            tag: notification.id
          })
        }

        // 알림음 재생 (선택사항)
        playNotificationSound()

      } catch (error) {
        console.error('[SSE] 파싱 오류:', error)
      }
    }

    eventSource.onerror = (err) => {
      console.error('[SSE] 오류:', err)
      setConnected(false)
      setError('알림 연결에 실패했습니다.')

      // 재연결 시도 (5초 후)
      setTimeout(() => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          console.log('[SSE] 재연결 시도...')
          eventSource.close()
          // 재연결은 컴포넌트 재마운트 시 자동으로 됨
        }
      }, 5000)
    }

    // 정리
    return () => {
      console.log('[SSE] 연결 종료')
      eventSource.close()
    }
  }, [])

  // 알림 제거
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  // 모든 알림 제거
  const clearNotifications = () => {
    setNotifications([])
  }

  // 브라우저 알림 권한 요청
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      console.warn('브라우저가 알림을 지원하지 않습니다.')
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }

    return false
  }

  return {
    notifications,
    connected,
    error,
    removeNotification,
    clearNotifications,
    requestNotificationPermission,
    unreadCount: notifications.length
  }
}

/**
 * 알림음 재생
 */
function playNotificationSound() {
  try {
    // 간단한 비프음 (Web Audio API)
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 800 // 800Hz
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.2)
  } catch (error) {
    // 알림음 재생 실패는 무시
    console.debug('알림음 재생 실패:', error)
  }
}
