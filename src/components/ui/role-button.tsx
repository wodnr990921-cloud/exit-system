"use client"

import * as React from "react"
import { Button, ButtonProps } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { type UserRole } from "@/lib/permissions"

export interface RoleButtonProps extends ButtonProps {
  requiredRoles?: UserRole[] | null
  currentUserRole?: UserRole | null
  showBadge?: boolean
  badgeText?: string
}

/**
 * 권한 기반 버튼 컴포넌트
 *
 * 사용자의 권한에 따라 다른 스타일을 적용하는 버튼입니다.
 * - admin/operator 전용: 특별한 색상 (보라색, 주황색)
 * - 모든 직원: 일반 색상
 * - 관리자가 볼 때: 배지로 "관리자 전용" 표시
 *
 * @example
 * ```tsx
 * <RoleButton
 *   requiredRoles={['admin', 'operator']}
 *   currentUserRole={currentUser.role}
 *   showBadge
 * >
 *   승인하기
 * </RoleButton>
 * ```
 */
export const RoleButton = React.forwardRef<HTMLButtonElement, RoleButtonProps>(
  (
    {
      requiredRoles,
      currentUserRole,
      showBadge = true,
      badgeText,
      className,
      children,
      variant,
      ...props
    },
    ref
  ) => {
    // requiredRoles가 없으면 모든 사용자가 접근 가능한 버튼
    const isPublicButton = !requiredRoles || requiredRoles.length === 0

    // 현재 사용자가 관리자인지 확인
    const isCurrentUserAdmin =
      currentUserRole &&
      ["admin", "operator", "ceo"].includes(currentUserRole)

    // 필요한 권한에 관리자 역할이 포함되어 있는지 확인
    const requiresAdminRole =
      requiredRoles &&
      requiredRoles.some((role) => ["admin", "operator", "ceo"].includes(role))

    // 버튼 variant 결정
    let buttonVariant = variant

    if (!buttonVariant) {
      if (requiresAdminRole) {
        // 관리자 전용 버튼
        if (requiredRoles.includes("admin") || requiredRoles.includes("ceo")) {
          buttonVariant = "admin"
        } else if (requiredRoles.includes("operator")) {
          buttonVariant = "operator"
        }
      } else {
        // 일반 버튼
        buttonVariant = "default"
      }
    }

    // 배지 표시 여부 결정
    const shouldShowBadge =
      showBadge && isCurrentUserAdmin && requiresAdminRole && !isPublicButton

    // 배지 텍스트 결정
    let displayBadgeText = badgeText
    if (!displayBadgeText && shouldShowBadge) {
      if (requiredRoles?.includes("ceo")) {
        displayBadgeText = "CEO"
      } else if (requiredRoles?.includes("admin")) {
        displayBadgeText = "관리자"
      } else if (requiredRoles?.includes("operator")) {
        displayBadgeText = "운영자"
      }
    }

    return (
      <div className="relative inline-flex">
        <Button
          ref={ref}
          variant={buttonVariant}
          className={cn("relative", className)}
          {...props}
        >
          {children}
        </Button>
        {shouldShowBadge && displayBadgeText && (
          <Badge
            variant="secondary"
            className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5 bg-purple-600 text-white border-0 shadow-sm"
          >
            {displayBadgeText}
          </Badge>
        )}
      </div>
    )
  }
)

RoleButton.displayName = "RoleButton"

/**
 * 관리자 전용 버튼 (admin, operator, ceo만 사용 가능)
 */
export const AdminButton = React.forwardRef<
  HTMLButtonElement,
  Omit<RoleButtonProps, "requiredRoles">
>(({ ...props }, ref) => (
  <RoleButton
    ref={ref}
    requiredRoles={["admin", "operator", "ceo"]}
    {...props}
  />
))

AdminButton.displayName = "AdminButton"

/**
 * 운영자 전용 버튼
 */
export const OperatorButton = React.forwardRef<
  HTMLButtonElement,
  Omit<RoleButtonProps, "requiredRoles">
>(({ ...props }, ref) => (
  <RoleButton ref={ref} requiredRoles={["operator", "ceo"]} {...props} />
))

OperatorButton.displayName = "OperatorButton"

/**
 * CEO 전용 버튼
 */
export const CEOButton = React.forwardRef<
  HTMLButtonElement,
  Omit<RoleButtonProps, "requiredRoles">
>(({ ...props }, ref) => (
  <RoleButton ref={ref} requiredRoles={["ceo"]} {...props} />
))

CEOButton.displayName = "CEOButton"
