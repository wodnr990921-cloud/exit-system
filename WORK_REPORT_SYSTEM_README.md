# Work Report System Documentation

## Overview

The Work Report System is a comprehensive daily work tracking solution that enables employees to clock in/out, report consumables used, track expenses, and log daily work notes. The system is prominently displayed on the dashboard home page for easy access.

## Features

### 1. Clock In/Out Functionality
- One-click clock in/out buttons
- Automatic timestamp recording
- Visual status indicator (clocked in vs. not clocked in)
- Real-time work hours calculation
- Prevents multiple active sessions per day

### 2. Consumables Tracking
- Dropdown selection from registered inventory items
- Quantity and unit tracking
- Real-time inventory integration
- Add/remove consumables dynamically
- Displays item code, name, quantity, and unit

### 3. Expense Reporting
- Track daily work-related expenses
- Fields: description, amount, category
- Automatic total calculation
- Add/remove expenses dynamically
- Visual categorization

### 4. Work Notes
- Text area for daily work messages
- Record special notes, accomplishments, or issues
- Persistent storage with auto-save

### 5. Permissions & Access
- All employees can create and view their own reports
- Admins/operators can view all employee reports
- Row-level security enforcement
- Audit logging for all actions

## Database Schema

### Table: `work_reports`

```sql
CREATE TABLE work_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
    clock_out TIMESTAMP WITH TIME ZONE,
    consumables JSONB DEFAULT '[]'::jsonb,
    expenses JSONB DEFAULT '[]'::jsonb,
    message TEXT,
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### JSONB Structure

**Consumables Array:**
```json
[
  {
    "item_code": "ENV-001",
    "item_name": "봉투",
    "quantity": 50,
    "unit": "개"
  }
]
```

**Expenses Array:**
```json
[
  {
    "description": "택시비",
    "amount": 15000,
    "category": "교통비"
  }
]
```

### Indexes
- `idx_work_reports_employee_id` - Fast employee lookup
- `idx_work_reports_clock_in` - Date-based queries
- `idx_work_reports_status` - Filter by status
- `idx_work_reports_employee_date` - Combined employee + date queries

### View: `work_reports_summary`
Provides calculated fields including:
- Employee name and username
- Hours worked
- Consumables count
- Expenses count
- Total expenses amount

## API Endpoints

### GET /api/work-reports
Retrieve work reports with optional filters.

**Query Parameters:**
- `date` - Filter by specific date (YYYY-MM-DD)
- `employeeId` - Filter by specific employee (admin only)
- `status` - Filter by status (`in_progress` or `completed`)
- `startDate`, `endDate` - Filter by date range

**Response:**
```json
{
  "success": true,
  "reports": [
    {
      "id": "uuid",
      "employee_id": "uuid",
      "clock_in": "2026-01-14T09:00:00Z",
      "clock_out": "2026-01-14T18:00:00Z",
      "consumables": [...],
      "expenses": [...],
      "message": "Completed all tasks",
      "status": "completed",
      "users": {
        "id": "uuid",
        "name": "John Doe",
        "username": "johndoe"
      }
    }
  ]
}
```

### POST /api/work-reports
Create a new work report (clock in).

**Request Body:**
```json
{
  "consumables": [],
  "expenses": [],
  "message": ""
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully clocked in",
  "report": { ... }
}
```

**Validations:**
- Only one active session per employee per day
- Authenticated users only
- Automatic timestamp generation

### PUT /api/work-reports
Update work report (clock out or modify data).

**Request Body:**
```json
{
  "reportId": "uuid",
  "clockOut": true,
  "consumables": [...],
  "expenses": [...],
  "message": "Daily work completed"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully clocked out",
  "report": { ... }
}
```

**Validations:**
- Report must exist and belong to user (or user is admin)
- Cannot clock out twice
- Consumables must have `item_code` and `quantity`
- Expenses must have `description` and `amount`

## UI Component

### File: `src/app/dashboard/work-report-widget.tsx`

**Key Features:**
1. **Status Display** - Shows current clock-in status with visual indicators
2. **Clock Buttons** - Large, prominent clock in/out buttons
3. **Consumables Form** - Dropdown + quantity input with add/remove
4. **Expenses Form** - Description + amount + category with add/remove
5. **Notes Area** - Multi-line text input for work messages
6. **Save Button** - Persists changes without clocking out

**Component States:**
- `currentReport` - Active work report
- `consumables` - Array of consumable items
- `expenses` - Array of expense entries
- `message` - Work notes
- `inventoryItems` - Available consumables from inventory

**Real-time Updates:**
- Work hours calculation every render
- Total expenses calculation
- Inventory item dropdown population

## Integration

The Work Report Widget is integrated into the main dashboard (`src/app/dashboard/dashboard-client.tsx`) and appears:

1. **For Staff/Employees** - First widget after welcome message
2. **For Admins/Operators** - First widget after header

Both user types have full access to create and manage their own work reports.

## Installation & Setup

### Step 1: Run Database Migration

```bash
psql -h your-host -U your-user -d your-database -f schema_migration_work_reports.sql
```

Or via Supabase Dashboard:
1. Go to SQL Editor
2. Copy contents of `schema_migration_work_reports.sql`
3. Execute the migration

### Step 2: Verify Tables & Policies

Check that the following are created:
- Table: `work_reports`
- Indexes: 5 indexes on work_reports
- View: `work_reports_summary`
- Policies: 5 RLS policies
- Trigger: `trigger_update_work_reports_updated_at`

### Step 3: Test API Endpoints

```bash
# Clock In
curl -X POST http://localhost:3000/api/work-reports \
  -H "Content-Type: application/json" \
  -d '{"consumables":[],"expenses":[],"message":""}'

# Get Today's Report
curl http://localhost:3000/api/work-reports?date=2026-01-14

# Clock Out
curl -X PUT http://localhost:3000/api/work-reports \
  -H "Content-Type: application/json" \
  -d '{"reportId":"uuid","clockOut":true}'
```

### Step 4: Verify Dashboard Integration

1. Login to dashboard
2. Navigate to home page (`/dashboard`)
3. Verify Work Report Widget appears prominently
4. Test clock in/out functionality
5. Add consumables and expenses
6. Save changes and verify persistence

## Usage Examples

### Example 1: Basic Clock In/Out

1. Employee arrives at work
2. Clicks "출근하기" (Clock In) button
3. Widget shows "출근 중" (Clocked In) status
4. Works throughout the day
5. Before leaving, clicks "퇴근하기" (Clock Out) button
6. Report status changes to "completed"

### Example 2: Recording Consumables

1. Employee clocked in
2. Opens consumables section
3. Selects "봉투 (ENV-001)" from dropdown
4. Enters quantity "50"
5. Clicks "추가" (Add)
6. Item appears in list
7. Clicks "변경사항 저장" (Save Changes)

### Example 3: Tracking Expenses

1. Employee clocked in
2. Opens expenses section
3. Enters description "택시비" (Taxi fare)
4. Enters amount "15000"
5. Enters category "교통비" (Transportation)
6. Clicks "추가" (Add)
7. Total updates automatically
8. Clicks "변경사항 저장" (Save Changes)

### Example 4: Admin Viewing Reports

1. Admin logs in
2. Navigates to Work Reports API (or creates admin view)
3. Filters by date or employee
4. Reviews all employee work reports
5. Exports data for payroll/analysis

## Security

### Row-Level Security (RLS)
- Employees can only view/edit their own reports
- Admins can view/edit all reports
- Enforced at database level

### API Authorization
- All endpoints require authentication
- Token validation via Supabase Auth
- IP address logging for audit trail

### Data Validation
- Type checking on all inputs
- JSONB structure validation
- Prevents duplicate clock-ins
- Prevents double clock-outs

## Audit Logging

All work report actions are logged to `audit_logs` table:
- `clock_in` - Employee clocked in
- `clock_out` - Employee clocked out
- `update_work_report` - Report modified
- Includes user ID, timestamp, IP address, and changes

## Future Enhancements

### Potential Features
1. **Mobile App** - Native mobile app for field workers
2. **GPS Tracking** - Verify clock-in location
3. **Photo Attachments** - Attach photos to work reports
4. **Approval Workflow** - Manager approval for expenses
5. **Reports & Analytics** - Dashboard for work hours analysis
6. **Notifications** - Remind employees to clock in/out
7. **Overtime Tracking** - Automatic overtime calculation
8. **Team Calendar** - View team attendance
9. **Export Options** - PDF/Excel export of reports
10. **Integration** - Connect with payroll systems

### Performance Optimizations
1. Add materialized views for complex queries
2. Implement caching for inventory items
3. Add pagination for large datasets
4. Optimize JSONB queries with GIN indexes

## Troubleshooting

### Issue: Can't clock in
**Solution:** Check if already clocked in today. Only one active session allowed per day.

### Issue: Consumables dropdown empty
**Solution:** Verify inventory items exist in `inventory_items` table and API is returning data.

### Issue: Permission denied
**Solution:** Check RLS policies and ensure user is authenticated. Verify user role in `users` table.

### Issue: Widget not appearing
**Solution:** Verify `work-report-widget.tsx` is imported in `dashboard-client.tsx`. Check console for errors.

### Issue: API 500 error
**Solution:** Check server logs. Verify database schema is created. Test database connection.

## Support

For issues or questions:
1. Check server logs (`console.error` output)
2. Verify database schema is up to date
3. Test API endpoints directly
4. Review audit logs for clues
5. Contact system administrator

## Changelog

### Version 1.0.0 (2026-01-14)
- Initial release
- Clock in/out functionality
- Consumables tracking
- Expense reporting
- Work notes
- Database schema with RLS
- API endpoints (GET, POST, PUT)
- Dashboard integration
- Admin permissions
- Audit logging

---

**Created:** 2026-01-14
**Last Updated:** 2026-01-14
**Version:** 1.0.0
