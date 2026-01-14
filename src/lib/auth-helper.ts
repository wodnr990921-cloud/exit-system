import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * localStorage 기반 인증과 Supabase Auth 모두 지원하는 헬퍼 함수
 */
export async function getCurrentUser(request: NextRequest) {
  const supabase = await createClient()
  
  // 1. 헤더에서 userId 확인 (localStorage 기반 인증)
  const userIdFromHeader = request.headers.get('X-User-Id')
  
  if (userIdFromHeader) {
    console.log('✅ localStorage 인증:', userIdFromHeader)
    return { userId: userIdFromHeader, supabase }
  }
  
  // 2. Supabase Auth 세션 확인 (기존 방식)
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    console.log('✅ Supabase Auth 인증:', user.id)
    return { userId: user.id, supabase }
  }
  
  // 3. 인증 실패
  console.log('❌ 인증 실패')
  return { userId: null, supabase }
}
