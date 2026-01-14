/**
 * 권한 시스템
 *
 * 역할 정의:
 * - ceo: 최고 경영자
 * - admin: 관리자
 * - operator: 운영자
 * - staff: 일반 직원
 * - employee: 임시 직원
 */

export type UserRole = "ceo" | "admin" | "operator" | "staff" | "employee"

export interface User {
  id: string
  name: string | null
  username: string
  role: UserRole
}

/**
 * 권한 레벨 정의
 * 높은 숫자일수록 높은 권한
 */
export const ROLE_LEVELS: Record<UserRole, number> = {
  ceo: 100,
  admin: 80,
  operator: 60,
  staff: 40,
  employee: 20,
}

/**
 * 관리자 권한을 가진 역할들
 */
export const ADMIN_ROLES: UserRole[] = ["ceo", "admin", "operator"]

/**
 * 일반 직원 역할들
 */
export const STAFF_ROLES: UserRole[] = ["staff", "employee"]

/**
 * 특정 역할이 관리자인지 확인
 */
export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role)
}

/**
 * 특정 역할이 운영자 이상인지 확인
 */
export function isOperatorRole(role: UserRole): boolean {
  return ["ceo", "admin", "operator"].includes(role)
}

/**
 * 특정 역할이 직원인지 확인
 */
export function isStaffRole(role: UserRole): boolean {
  return STAFF_ROLES.includes(role)
}

/**
 * 두 역할을 비교하여 첫 번째 역할이 두 번째 역할보다 높은지 확인
 */
export function hasHigherRole(role1: UserRole, role2: UserRole): boolean {
  return ROLE_LEVELS[role1] > ROLE_LEVELS[role2]
}

/**
 * 특정 역할이 최소 요구 권한을 만족하는지 확인
 */
export function hasMinimumRole(
  userRole: UserRole,
  minimumRole: UserRole
): boolean {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[minimumRole]
}

/**
 * 사용자가 특정 기능에 접근할 수 있는지 확인
 */
export function canAccess(
  userRole: UserRole,
  requiredRoles: UserRole[] | null
): boolean {
  // requiredRoles가 null이면 모든 사용자 접근 가능
  if (!requiredRoles || requiredRoles.length === 0) {
    return true
  }

  return requiredRoles.includes(userRole)
}

/**
 * 역할에 따른 색상 가져오기
 */
export function getRoleColor(role: UserRole): string {
  const colorMap: Record<UserRole, string> = {
    ceo: "purple",
    admin: "purple",
    operator: "orange",
    staff: "blue",
    employee: "gray",
  }

  return colorMap[role]
}

/**
 * 역할에 따른 표시 이름 가져오기
 */
export function getRoleDisplayName(role: UserRole): string {
  const displayNames: Record<UserRole, string> = {
    ceo: "CEO",
    admin: "관리자",
    operator: "운영자",
    staff: "직원",
    employee: "임시직",
  }

  return displayNames[role]
}

/**
 * 역할에 따른 배지 색상 클래스 가져오기
 */
export function getRoleBadgeClass(role: UserRole): string {
  const badgeClasses: Record<UserRole, string> = {
    ceo: "bg-purple-600 text-white",
    admin: "bg-purple-600 text-white",
    operator: "bg-orange-600 text-white",
    staff: "bg-blue-600 text-white",
    employee: "bg-gray-600 text-white",
  }

  return badgeClasses[role]
}
