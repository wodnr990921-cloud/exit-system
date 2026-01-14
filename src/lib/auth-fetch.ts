/**
 * localStorage 기반 인증을 지원하는 커스텀 fetch 함수
 */

export async function authFetch(url: string, options: RequestInit = {}) {
  // localStorage에서 사용자 정보 가져오기
  const authUser = localStorage.getItem('auth_user')
  
  if (!authUser) {
    throw new Error('로그인 정보가 없습니다. 다시 로그인해주세요.')
  }

  const user = JSON.parse(authUser)
  
  // 헤더에 userId 추가
  const headers = new Headers(options.headers)
  headers.set('X-User-Id', user.id)
  
  // Content-Type이 없으면 기본값 설정
  if (!headers.has('Content-Type') && options.method !== 'GET') {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(url, {
    ...options,
    headers,
  })
}
