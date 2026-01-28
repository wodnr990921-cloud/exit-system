import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/work-reports
 * Retrieve work reports with optional filters
 * Query params:
 * - date: Filter by specific date (YYYY-MM-DD)
 * - employeeId: Filter by specific employee
 * - status: Filter by status (in_progress, completed)
 * - startDate, endDate: Filter by date range
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Get user role
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    const isAdmin = userData?.role && ["admin", "operator", "ceo"].includes(userData.role)

    const date = searchParams.get("date")
    const employeeId = searchParams.get("employeeId")
    const status = searchParams.get("status")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Build query
    let query = supabase
      .from("daily_daily_work_reports")
      .select(`
        *,
        users:user_id (
          id,
          name,
          username
        )
      `)
      .order("clock_in_time", { ascending: false })

    // Apply filters based on user role
    if (!isAdmin) {
      // Regular employees can only see their own reports
      query = query.eq("user_id", user.id)
    } else if (employeeId) {
      // Admins can filter by specific employee
      query = query.eq("user_id", employeeId)
    }

    // Date filters
    if (date) {
      query = query.eq("report_date", date)
    } else if (startDate && endDate) {
      query = query.gte("report_date", startDate).lte("report_date", endDate)
    } else if (startDate) {
      query = query.gte("report_date", startDate)
    } else if (endDate) {
      query = query.lte("report_date", endDate)
    }

    // Status filter
    if (status) {
      query = query.eq("status", status)
    }

    const { data: reports, error } = await query

    if (error) {
      console.error("Error fetching work reports:", error)
      return NextResponse.json(
        { error: "Failed to fetch work reports" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      reports: reports || [],
    })
  } catch (error: any) {
    console.error("Work reports GET error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/work-reports
 * Create a new work report (clock in)
 * Body: {
 *   consumables?: Array<{item_code: string, item_name: string, quantity: number, unit: string}>,
 *   expenses?: Array<{description: string, amount: number, category?: string}>,
 *   message?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { supplies_used = [], expenses = [], handover_notes = "" } = body

    // Check if user already has a work report today
    const today = new Date().toISOString().split("T")[0]
    const { data: existingReport } = await supabase
      .from("daily_work_reports")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("report_date", today)
      .single()

    if (existingReport) {
      return NextResponse.json(
        { error: "You already have a work report for today. Please use PUT to update it." },
        { status: 400 }
      )
    }

    // Validate supplies format
    if (supplies_used.length > 0) {
      for (const item of supplies_used) {
        if (!item.code || !item.quantity) {
          return NextResponse.json(
            { error: "Invalid supply format. code and quantity are required." },
            { status: 400 }
          )
        }
      }
    }

    // Validate expenses format
    if (expenses.length > 0) {
      for (const expense of expenses) {
        if (!expense.item || !expense.amount) {
          return NextResponse.json(
            { error: "Invalid expense format. item and amount are required." },
            { status: 400 }
          )
        }
      }
    }

    // Calculate total costs
    const total_supply_cost = supplies_used.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0)
    const total_expense_amount = expenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0)

    // Create work report with clock in time
    const { data: report, error: insertError } = await supabase
      .from("daily_work_reports")
      .insert({
        user_id: user.id,
        report_date: today,
        clock_in_time: new Date().toISOString(),
        supplies_used: supplies_used,
        expenses: expenses,
        handover_notes: handover_notes,
        total_supply_cost,
        total_expense_amount,
        status: "draft",
      })
      .select(`
        *,
        users:user_id (
          id,
          name,
          username
        )
      `)
      .single()

    if (insertError) {
      console.error("Error creating work report:", insertError)
      return NextResponse.json(
        { error: "Failed to create work report" },
        { status: 500 }
      )
    }

    // Create audit log (if audit_logs table exists)
    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "clock_in",
        table_name: "daily_work_reports",
        record_id: report.id,
        changes: { clock_in_time: report.clock_in_time },
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      })
    } catch (auditError) {
      // Audit log is optional, don't fail the request
      console.warn("Could not create audit log:", auditError)
    }

    return NextResponse.json({
      success: true,
      message: "Successfully clocked in",
      report: report,
    })
  } catch (error: any) {
    console.error("Work reports POST error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/work-reports
 * Update work report (clock out or update consumables/expenses/message)
 * Body: {
 *   reportId: string (required),
 *   clockOut?: boolean,
 *   consumables?: Array<{item_code: string, item_name: string, quantity: number, unit: string}>,
 *   expenses?: Array<{description: string, amount: number, category?: string}>,
 *   message?: string
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { reportId, clockOut, supplies_used, expenses, handover_notes } = body

    if (!reportId) {
      return NextResponse.json(
        { error: "reportId is required" },
        { status: 400 }
      )
    }

    // Get existing report
    const { data: existingReport, error: fetchError } = await supabase
      .from("daily_work_reports")
      .select("*")
      .eq("id", reportId)
      .single()

    if (fetchError || !existingReport) {
      return NextResponse.json(
        { error: "Work report not found" },
        { status: 404 }
      )
    }

    // Check ownership (only the employee or admin can update)
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    const isAdmin = userData?.role && ["admin", "operator", "ceo"].includes(userData.role)

    if (existingReport.user_id !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: "You don't have permission to update this report" },
        { status: 403 }
      )
    }

    // Prepare update data
    const updateData: any = {}

    if (clockOut) {
      if (existingReport.clock_out_time) {
        return NextResponse.json(
          { error: "Already clocked out" },
          { status: 400 }
        )
      }
      updateData.clock_out_time = new Date().toISOString()
      updateData.status = "submitted" // Changed from completed to submitted
    }

    if (supplies_used !== undefined) {
      // Validate supplies format
      for (const item of supplies_used) {
        if (!item.code || !item.quantity) {
          return NextResponse.json(
            { error: "Invalid supply format. code and quantity are required." },
            { status: 400 }
          )
        }
      }
      updateData.supplies_used = supplies_used
      updateData.total_supply_cost = supplies_used.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0)
    }

    if (expenses !== undefined) {
      // Validate expenses format
      for (const expense of expenses) {
        if (!expense.item || !expense.amount) {
          return NextResponse.json(
            { error: "Invalid expense format. item and amount are required." },
            { status: 400 }
          )
        }
      }
      updateData.expenses = expenses
      updateData.total_expense_amount = expenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0)
    }

    if (handover_notes !== undefined) {
      updateData.handover_notes = handover_notes
    }

    // Update work report
    const { data: updatedReport, error: updateError } = await supabase
      .from("daily_work_reports")
      .update(updateData)
      .eq("id", reportId)
      .select(`
        *,
        users:user_id (
          id,
          name,
          username
        )
      `)
      .single()

    if (updateError) {
      console.error("Error updating work report:", updateError)
      return NextResponse.json(
        { error: "Failed to update work report" },
        { status: 500 }
      )
    }

    // Create audit log (if audit_logs table exists)
    const auditAction = clockOut ? "clock_out" : "update_work_report"
    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: auditAction,
        table_name: "daily_work_reports",
        record_id: reportId,
        changes: updateData,
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      })
    } catch (auditError) {
      // Audit log is optional, don't fail the request
      console.warn("Could not create audit log:", auditError)
    }

    return NextResponse.json({
      success: true,
      message: clockOut ? "Successfully clocked out" : "Work report updated",
      report: updatedReport,
    })
  } catch (error: any) {
    console.error("Work reports PUT error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}
