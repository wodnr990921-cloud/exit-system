import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserRole } from '@/types'

export function usePermissions() {
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchUserRole() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

          if (userData) {
            setRole(userData.role as UserRole)
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserRole()
  }, [supabase])

  const isAdmin = () => role === 'admin' || role === 'ceo'
  const isOperator = () => role === 'operator' || isAdmin()
  const isStaff = () => role === 'staff' || isOperator()

  const hasPermission = (requiredRole: 'admin' | 'operator' | 'staff') => {
    if (!role) return false

    const hierarchy: Record<UserRole, number> = {
      admin: 4,
      ceo: 4,
      operator: 3,
      staff: 2,
      employee: 1,
    }

    const requiredLevel: Record<string, number> = {
      admin: 4,
      operator: 3,
      staff: 2,
    }

    return hierarchy[role] >= (requiredLevel[requiredRole] || 0)
  }

  return {
    role,
    loading,
    isAdmin,
    isOperator,
    isStaff,
    hasPermission,
  }
}
