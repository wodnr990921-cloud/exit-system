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
      .from("work_reports")
      .select(`
        *,
        users:employee_id (
          id,
          name,
          username
        )
      `)
      .order("clock_in", { ascending: false })

    // Apply filters based on user role
    if (!isAdmin) {
      // Regular employees can only see their own reports
      query = query.eq("employee_id", user.id)
    } else if (employeeId) {
      // Admins can filter by specific employee
      query = query.eq("employee_id", employeeId)
    }

    // Date filters
    if (date) {
      const startOfDay = `${date}T00:00:00Z`
      const endOfDay = `${date}T23:59:59Z`
      query = query.gte("clock_in", startOfDay).lte("clock_in", endOfDay)
    } else if (startDate && endDate) {
      query = query.gte("clock_in", `${startDate}T00:00:00Z`).lte("clock_in", `${endDate}T23:59:59Z`)
    } else if (startDate) {
      query = query.gte("clock_in", `${startDate}T00:00:00Z`)
    } else if (endDate) {
      query = query.lte("clock_in", `${endDate}T23:59:59Z`)
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
    const { consumables = [], expenses = [], message = "" } = body

    // Check if user already has an active (in_progress) work report today
    const today = new Date().toISOString().split("T")[0]
    const { data: existingReport } = await supabase
      .from("work_reports")
      .select("id, status")
      .eq("employee_id", user.id)
      .eq("status", "in_progress")
      .gte("clock_in", `${today}T00:00:00Z`)
      .lte("clock_in", `${today}T23:59:59Z`)
      .single()

    if (existingReport) {
      return NextResponse.json(
        { error: "You already have an active work session. Please clock out first." },
        { status: 400 }
      )
    }

    // Validate consumables format
    if (consumables.length > 0) {
      for (const item of consumables) {
        if (!item.item_code || !item.quantity) {
          return NextResponse.json(
            { error: "Invalid consumable format. item_code and quantity are required." },
            { status: 400 }
          )
        }
      }
    }

    // Validate expenses format
    if (expenses.length > 0) {
      for (const expense of expenses) {
        if (!expense.description || !expense.amount) {
          return NextResponse.json(
            { error: "Invalid expense format. description and amount are required." },
            { status: 400 }
          )
        }
      }
    }

    // Create work report with clock in time
    const { data: report, error: insertError } = await supabase
      .from("work_reports")
      .insert({
        employee_id: user.id,
        clock_in: new Date().toISOString(),
        consumables: consumables,
        expenses: expenses,
        message: message,
        status: "in_progress",
      })
      .select(`
        *,
        users:employee_id (
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

    // Create audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "clock_in",
      table_name: "work_reports",
      record_id: report.id,
      changes: { clock_in: report.clock_in },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    })

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
    const { reportId, clockOut, consumables, expenses, message } = body

    if (!reportId) {
      return NextResponse.json(
        { error: "reportId is required" },
        { status: 400 }
      )
    }

    // Get existing report
    const { data: existingReport, error: fetchError } = await supabase
      .from("work_reports")
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

    if (existingReport.employee_id !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: "You don't have permission to update this report" },
        { status: 403 }
      )
    }

    // Prepare update data
    const updateData: any = {}

    if (clockOut) {
      if (existingReport.clock_out) {
        return NextResponse.json(
          { error: "Already clocked out" },
          { status: 400 }
        )
      }
      updateData.clock_out = new Date().toISOString()
      updateData.status = "completed"
    }

    if (consumables !== undefined) {
      // Validate consumables format
      for (const item of consumables) {
        if (!item.item_code || !item.quantity) {
          return NextResponse.json(
            { error: "Invalid consumable format. item_code and quantity are required." },
            { status: 400 }
          )
        }
      }
      updateData.consumables = consumables
    }

    if (expenses !== undefined) {
      // Validate expenses format
      for (const expense of expenses) {
        if (!expense.description || !expense.amount) {
          return NextResponse.json(
            { error: "Invalid expense format. description and amount are required." },
            { status: 400 }
          )
        }
      }
      updateData.expenses = expenses
    }

    if (message !== undefined) {
      updateData.message = message
    }

    // Update work report
    const { data: updatedReport, error: updateError } = await supabase
      .from("work_reports")
      .update(updateData)
      .eq("id", reportId)
      .select(`
        *,
        users:employee_id (
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

    // Create audit log
    const auditAction = clockOut ? "clock_out" : "update_work_report"
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: auditAction,
      table_name: "work_reports",
      record_id: reportId,
      changes: updateData,
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    })

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
