# Work Report API Quick Reference Guide

## Base URL
```
/api/work-reports
```

## Authentication
All endpoints require authentication via Supabase Auth session cookie.

---

## Endpoints

### 1. GET - Retrieve Work Reports

**URL:** `GET /api/work-reports`

**Description:** Fetch work reports with optional filters. Regular employees see only their own reports. Admins see all reports.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string (YYYY-MM-DD) | No | Filter by specific date |
| `employeeId` | UUID | No | Filter by employee (admin only) |
| `status` | string | No | Filter by status: `in_progress` or `completed` |
| `startDate` | string (YYYY-MM-DD) | No | Start of date range |
| `endDate` | string (YYYY-MM-DD) | No | End of date range |

**Example Requests:**

```bash
# Get today's active report
GET /api/work-reports?date=2026-01-14&status=in_progress

# Get all reports for an employee (admin only)
GET /api/work-reports?employeeId=123e4567-e89b-12d3-a456-426614174000

# Get reports for date range
GET /api/work-reports?startDate=2026-01-01&endDate=2026-01-31

# Get all my reports
GET /api/work-reports
```

**Success Response (200):**

```json
{
  "success": true,
  "reports": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "employee_id": "987fcdeb-51a2-43f1-b123-456789abcdef",
      "clock_in": "2026-01-14T09:00:00.000Z",
      "clock_out": "2026-01-14T18:00:00.000Z",
      "consumables": [
        {
          "item_code": "ENV-001",
          "item_name": "봉투",
          "quantity": 50,
          "unit": "개"
        }
      ],
      "expenses": [
        {
          "description": "택시비",
          "amount": 15000,
          "category": "교통비"
        }
      ],
      "message": "Completed all tasks for the day",
      "status": "completed",
      "created_at": "2026-01-14T09:00:00.000Z",
      "updated_at": "2026-01-14T18:00:00.000Z",
      "users": {
        "id": "987fcdeb-51a2-43f1-b123-456789abcdef",
        "name": "John Doe",
        "username": "johndoe"
      }
    }
  ]
}
```

**Error Responses:**

```json
// 401 Unauthorized
{
  "error": "Unauthorized"
}

// 500 Internal Server Error
{
  "error": "Failed to fetch work reports"
}
```

---

### 2. POST - Create Work Report (Clock In)

**URL:** `POST /api/work-reports`

**Description:** Create a new work report and clock in. Only one active report allowed per employee per day.

**Request Body:**

```json
{
  "consumables": [
    {
      "item_code": "ENV-001",
      "item_name": "봉투",
      "quantity": 50,
      "unit": "개"
    }
  ],
  "expenses": [
    {
      "description": "택시비",
      "amount": 15000,
      "category": "교통비"
    }
  ],
  "message": "Starting work day"
}
```

**All fields are optional.** You can clock in with empty arrays:

```json
{
  "consumables": [],
  "expenses": [],
  "message": ""
}
```

**Consumable Object Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `item_code` | string | Yes | Inventory item code |
| `item_name` | string | No | Item name (auto-populated) |
| `quantity` | number | Yes | Quantity used |
| `unit` | string | No | Unit (e.g., "개", "박스") |

**Expense Object Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | Yes | Expense description |
| `amount` | number | Yes | Amount in currency |
| `category` | string | No | Expense category |

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/work-reports \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "consumables": [],
    "expenses": [],
    "message": "Starting my shift"
  }'
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Successfully clocked in",
  "report": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "employee_id": "987fcdeb-51a2-43f1-b123-456789abcdef",
    "clock_in": "2026-01-14T09:00:00.000Z",
    "clock_out": null,
    "consumables": [],
    "expenses": [],
    "message": "Starting my shift",
    "status": "in_progress",
    "created_at": "2026-01-14T09:00:00.000Z",
    "updated_at": "2026-01-14T09:00:00.000Z",
    "users": {
      "id": "987fcdeb-51a2-43f1-b123-456789abcdef",
      "name": "John Doe",
      "username": "johndoe"
    }
  }
}
```

**Error Responses:**

```json
// 400 Bad Request - Already clocked in
{
  "error": "You already have an active work session. Please clock out first."
}

// 400 Bad Request - Invalid consumable format
{
  "error": "Invalid consumable format. item_code and quantity are required."
}

// 400 Bad Request - Invalid expense format
{
  "error": "Invalid expense format. description and amount are required."
}

// 401 Unauthorized
{
  "error": "Unauthorized"
}

// 500 Internal Server Error
{
  "error": "Failed to create work report"
}
```

---

### 3. PUT - Update Work Report (Clock Out or Modify)

**URL:** `PUT /api/work-reports`

**Description:** Update an existing work report. Can clock out, update consumables, expenses, or message.

**Request Body:**

```json
{
  "reportId": "123e4567-e89b-12d3-a456-426614174000",
  "clockOut": true,
  "consumables": [
    {
      "item_code": "ENV-001",
      "item_name": "봉투",
      "quantity": 50,
      "unit": "개"
    }
  ],
  "expenses": [
    {
      "description": "점심식사",
      "amount": 12000,
      "category": "식비"
    }
  ],
  "message": "Completed all deliveries"
}
```

**Request Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reportId` | UUID | Yes | ID of report to update |
| `clockOut` | boolean | No | Set to `true` to clock out |
| `consumables` | array | No | Replace consumables array |
| `expenses` | array | No | Replace expenses array |
| `message` | string | No | Update work message |

**Note:** Only include fields you want to update. Omitted fields remain unchanged.

**Example Requests:**

```bash
# Clock out only
curl -X PUT http://localhost:3000/api/work-reports \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "reportId": "123e4567-e89b-12d3-a456-426614174000",
    "clockOut": true
  }'

# Update message without clocking out
curl -X PUT http://localhost:3000/api/work-reports \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "reportId": "123e4567-e89b-12d3-a456-426614174000",
    "message": "Finished task #123"
  }'

# Clock out with final updates
curl -X PUT http://localhost:3000/api/work-reports \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "reportId": "123e4567-e89b-12d3-a456-426614174000",
    "clockOut": true,
    "consumables": [...],
    "expenses": [...],
    "message": "All work completed for the day"
  }'
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Successfully clocked out",
  "report": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "employee_id": "987fcdeb-51a2-43f1-b123-456789abcdef",
    "clock_in": "2026-01-14T09:00:00.000Z",
    "clock_out": "2026-01-14T18:00:00.000Z",
    "consumables": [
      {
        "item_code": "ENV-001",
        "item_name": "봉투",
        "quantity": 50,
        "unit": "개"
      }
    ],
    "expenses": [
      {
        "description": "점심식사",
        "amount": 12000,
        "category": "식비"
      }
    ],
    "message": "Completed all deliveries",
    "status": "completed",
    "created_at": "2026-01-14T09:00:00.000Z",
    "updated_at": "2026-01-14T18:00:00.000Z",
    "users": {
      "id": "987fcdeb-51a2-43f1-b123-456789abcdef",
      "name": "John Doe",
      "username": "johndoe"
    }
  }
}
```

**Error Responses:**

```json
// 400 Bad Request - Missing reportId
{
  "error": "reportId is required"
}

// 400 Bad Request - Already clocked out
{
  "error": "Already clocked out"
}

// 403 Forbidden - Not your report
{
  "error": "You don't have permission to update this report"
}

// 404 Not Found - Report doesn't exist
{
  "error": "Work report not found"
}

// 400 Bad Request - Invalid format
{
  "error": "Invalid consumable format. item_code and quantity are required."
}

// 401 Unauthorized
{
  "error": "Unauthorized"
}

// 500 Internal Server Error
{
  "error": "Failed to update work report"
}
```

---

## Complete Workflow Example

### Step 1: Clock In (Morning)

```bash
POST /api/work-reports
{
  "consumables": [],
  "expenses": [],
  "message": "Starting work day"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully clocked in",
  "report": {
    "id": "abc123...",
    "clock_in": "2026-01-14T09:00:00Z",
    "status": "in_progress",
    ...
  }
}
```

### Step 2: Update During Day (Multiple Times)

```bash
PUT /api/work-reports
{
  "reportId": "abc123...",
  "consumables": [
    {"item_code": "ENV-001", "quantity": 25, "unit": "개"}
  ],
  "message": "Processed 50 orders"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Work report updated",
  ...
}
```

### Step 3: Add Expense (During Day)

```bash
PUT /api/work-reports
{
  "reportId": "abc123...",
  "expenses": [
    {"description": "택시비", "amount": 15000, "category": "교통비"}
  ]
}
```

### Step 4: Clock Out (Evening)

```bash
PUT /api/work-reports
{
  "reportId": "abc123...",
  "clockOut": true,
  "message": "All tasks completed. Total orders: 127"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully clocked out",
  "report": {
    "id": "abc123...",
    "clock_in": "2026-01-14T09:00:00Z",
    "clock_out": "2026-01-14T18:00:00Z",
    "status": "completed",
    ...
  }
}
```

---

## JavaScript/TypeScript Examples

### Using Fetch API

```typescript
// Clock In
async function clockIn() {
  const response = await fetch('/api/work-reports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      consumables: [],
      expenses: [],
      message: 'Starting work'
    })
  });

  const data = await response.json();

  if (data.success) {
    console.log('Clocked in:', data.report);
  } else {
    console.error('Error:', data.error);
  }
}

// Clock Out
async function clockOut(reportId: string) {
  const response = await fetch('/api/work-reports', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reportId,
      clockOut: true
    })
  });

  const data = await response.json();

  if (data.success) {
    console.log('Clocked out:', data.report);
  } else {
    console.error('Error:', data.error);
  }
}

// Get Today's Report
async function getTodayReport() {
  const today = new Date().toISOString().split('T')[0];
  const response = await fetch(`/api/work-reports?date=${today}&status=in_progress`);
  const data = await response.json();

  if (data.success && data.reports.length > 0) {
    return data.reports[0];
  }
  return null;
}

// Add Consumable
async function addConsumable(reportId: string, consumables: any[]) {
  const response = await fetch('/api/work-reports', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reportId,
      consumables
    })
  });

  return await response.json();
}
```

---

## Data Type Reference

### TypeScript Interfaces

```typescript
interface WorkReport {
  id: string;
  employee_id: string;
  clock_in: string;  // ISO 8601 timestamp
  clock_out: string | null;  // ISO 8601 timestamp or null
  consumables: Consumable[];
  expenses: Expense[];
  message: string;
  status: 'in_progress' | 'completed';
  created_at: string;  // ISO 8601 timestamp
  updated_at: string;  // ISO 8601 timestamp
  users?: {
    id: string;
    name: string;
    username: string;
  };
}

interface Consumable {
  item_code: string;
  item_name: string;
  quantity: number;
  unit: string;
}

interface Expense {
  description: string;
  amount: number;
  category?: string;
}
```

---

## Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid input or validation error |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Not authorized for this resource |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Server Error | Server error occurred |

---

## Rate Limiting

Currently no rate limiting is implemented. Consider adding rate limiting in production.

---

## Best Practices

1. **Always check `success` field** in response before processing data
2. **Handle errors gracefully** - Display user-friendly messages
3. **Validate data client-side** before sending to API
4. **Use proper date formats** - Always use ISO 8601 (YYYY-MM-DD)
5. **Store reportId** after clock in for later updates
6. **Update incrementally** - Don't wait until clock out to save data
7. **Implement auto-save** - Save consumables/expenses/message periodically
8. **Check for active session** before allowing clock in
9. **Confirm clock out** - Ask user to confirm before clocking out
10. **Log API errors** - Help with debugging and monitoring

---

## Testing

### Test Clock In
```bash
curl -X POST http://localhost:3000/api/work-reports \
  -H "Content-Type: application/json" \
  -d '{"consumables":[],"expenses":[],"message":"Test"}'
```

### Test Get Reports
```bash
curl http://localhost:3000/api/work-reports?date=2026-01-14
```

### Test Clock Out
```bash
curl -X PUT http://localhost:3000/api/work-reports \
  -H "Content-Type: application/json" \
  -d '{"reportId":"YOUR_REPORT_ID","clockOut":true}'
```

---

**Last Updated:** 2026-01-14
**API Version:** 1.0.0
