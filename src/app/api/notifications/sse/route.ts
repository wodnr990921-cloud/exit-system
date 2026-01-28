import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { addConnection, removeConnection } from "@/lib/notification-manager"

/**
 * Server-Sent Events (SSE) for Real-time Notifications
 * 실시간 알림을 위한 SSE 엔드포인트
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    // 사용자 역할 확인
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userData) {
      return new Response('User not found', { status: 404 })
    }

    // SSE 스트림 생성
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      start(controller) {
        // 연결 저장
        addConnection(user.id, controller)

        // 초기 연결 메시지
        const initMessage = {
          id: Date.now().toString(),
          type: 'connection',
          title: '연결됨',
          message: '실시간 알림이 활성화되었습니다.',
          timestamp: new Date().toISOString()
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initMessage)}\n\n`))

        // Heartbeat (30초마다 연결 유지)
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`))
          } catch (error) {
            clearInterval(heartbeat)
            removeConnection(user.id)
          }
        }, 30000)

        // 연결 종료 시 정리
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat)
          removeConnection(user.id)
          controller.close()
        })
      },

      cancel() {
        removeConnection(user.id)
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Nginx에서 버퍼링 방지
      }
    })

  } catch (error) {
    console.error('SSE Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
