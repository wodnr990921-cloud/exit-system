// User types
export type UserRole = 'admin' | 'ceo' | 'operator' | 'staff' | 'employee'

export interface User {
  id: string
  email: string
  username: string
  name: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

// Customer types
export interface Customer {
  id: string
  member_number: string
  name: string
  institution: string
  prison_number: string | null
  depositor_name: string | null
  total_point_general: number
  total_point_betting: number
  total_deposit: number
  total_usage: number
  total_betting: number
  created_at: string
  updated_at: string
}

// Task types
export type TaskStatus = 'pending' | 'processing' | 'processed' | 'closed'

export interface Task {
  id: string
  ticket_no: string
  member_id: string
  assignee_id: string | null
  status: TaskStatus
  total_amount: number
  ai_summary: string | null
  reply_content: string | null
  closed_at: string | null
  closed_by: string | null
  letter_id: string | null
  processed_at: string | null
  created_at: string
  updated_at: string
}

export interface TaskItem {
  id: string
  task_id: string
  category: 'book' | 'game' | 'goods' | 'inquiry' | 'other'
  description: string
  amount: number
  status: string
  procurement_status: string | null
  sender_name: string | null
  cost_price?: number
  selling_price?: number
  shipping_cost?: number
  created_at: string
  updated_at: string
}

// Point types
export type PointCategory = 'general' | 'betting'
export type PointType = 'charge' | 'use' | 'refund' | 'exchange'
export type PointStatus = 'pending' | 'approved' | 'confirmed'

export interface Point {
  id: string
  customer_id: string
  amount: number
  category: PointCategory
  type: PointType
  status: PointStatus
  requested_by: string | null
  approved_by: string | null
  reason: string | null
  is_reversed: boolean
  reversed_by: string | null
  reversed_at: string | null
  reversal_reason: string | null
  original_transaction_id: string | null
  created_at: string
  updated_at: string
}

// Inmate types
export interface Inmate {
  id: string
  name: string
  prison_number: string
  current_prison: string
  release_date: string | null
  is_released: boolean
  customer_id: string | null
  created_at: string
  updated_at: string
}

// Prison restriction types
export interface PrisonRestriction {
  id: string
  prison_name: string
  restricted_items: string[]
  notes: string | null
  created_at: string
  updated_at: string
}

// Customer flag types
export type FlagType = 'blacklist' | 'warning' | 'vip'

export interface CustomerFlag {
  id: string
  customer_id: string
  flag_type: FlagType
  reason: string | null
  flagged_by: string
  flagged_at: string
  is_active: boolean
}

// Audit log types
export type AuditAction = 'SELECT' | 'UPDATE' | 'INSERT' | 'DELETE'

export interface AuditLog {
  id: string
  user_id: string
  action: AuditAction
  table_name: string
  record_id: string | null
  old_values: any | null
  new_values: any | null
  ip_address: string | null
  created_at: string
}

// Inventory types
export type InventoryItemType = 'stamp' | 'envelope' | 'paper' | 'label'

export interface InventoryItem {
  id: string
  item_name: string
  item_type: InventoryItemType
  current_quantity: number
  min_quantity: number
  unit: string
  last_restocked_at: string | null
  created_at: string
  updated_at: string
}

export interface InventoryTransaction {
  id: string
  item_id: string
  quantity_change: number
  transaction_type: 'restock' | 'use' | 'adjustment'
  notes: string | null
  user_id: string
  created_at: string
}

// Return types
export type ReturnReason = '이감' | '출소' | '수취인불명' | '금지물품'
export type ReturnStatus = 'pending' | 'resend' | 'disposed'

export interface Return {
  id: string
  task_id: string
  return_reason: ReturnReason
  return_date: string
  status: ReturnStatus
  resend_cost: number
  notes: string | null
  handled_by: string | null
  created_at: string
  updated_at: string
}

// Document retention types
export interface DocumentRetention {
  id: string
  letter_id: string
  retention_days: number
  scheduled_destruction_date: string
  is_destroyed: boolean
  destroyed_at: string | null
  destroyed_by: string | null
  destruction_notes: string | null
  created_at: string
}

// System config types
export type ConfigType = 'string' | 'number' | 'boolean' | 'json'

export interface SystemConfig {
  id: string
  config_key: string
  config_value: string
  config_type: ConfigType
  description: string | null
  updated_by: string | null
  updated_at: string
}

// Monthly settlement types
export interface MonthlySettlement {
  id: string
  year: number
  month: number
  total_revenue: number
  total_cost: number
  total_shipping: number
  net_profit: number
  settled_by: string
  settled_at: string
}

// Dormant points types
export interface DormantPoint {
  id: string
  customer_id: string
  original_point_balance: number
  confiscated_amount: number
  dormant_since: string
  confiscated_at: string
  reason: string
  created_at: string
}

// Game types
export interface Game {
  id: string
  home_team: string
  away_team: string
  game_date: string
  status: 'scheduled' | 'ongoing' | 'finished'
  result: string | null
  is_verified: boolean
  created_at: string
  updated_at: string
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Pagination types
export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
