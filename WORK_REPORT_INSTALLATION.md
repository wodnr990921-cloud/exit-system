# Work Report System - Installation Guide

This guide walks you through installing and configuring the Work Report System in your existing application.

## Prerequisites

- Next.js application with App Router
- Supabase account and project
- PostgreSQL database (via Supabase)
- Existing authentication system
- Node.js 18+ and npm/yarn/pnpm

## Installation Steps

### Step 1: Database Setup

#### Option A: Using Supabase Dashboard (Recommended)

1. Log in to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `schema_migration_work_reports.sql`
5. Paste into the SQL editor
6. Click **Run** to execute
7. Verify success message

#### Option B: Using psql Command Line

```bash
# Connect to your Supabase database
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run the migration
\i schema_migration_work_reports.sql

# Verify tables created
\dt work_reports
```

#### Option C: Using Supabase CLI

```bash
# Initialize Supabase (if not already done)
supabase init

# Link to your project
supabase link --project-ref [YOUR-PROJECT-REF]

# Create a new migration
supabase migration new work_reports

# Copy contents of schema_migration_work_reports.sql to the new migration file
# Then push to database
supabase db push
```

### Step 2: Verify Database Setup

Run the following queries in Supabase SQL Editor to verify:

```sql
-- Check table exists
SELECT * FROM work_reports LIMIT 1;

-- Check view exists
SELECT * FROM work_reports_summary LIMIT 1;

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'work_reports';

-- Check RLS policies
SELECT policyname FROM pg_policies WHERE tablename = 'work_reports';

-- Expected results:
-- - 5 indexes
-- - 5 policies
```

### Step 3: API Routes Setup

The API route file should already be created at:
```
src/app/api/work-reports/route.ts
```

Verify the file exists and contains GET, POST, and PUT methods.

If not, copy the file from the installation package:
```bash
cp work-reports-api/route.ts src/app/api/work-reports/route.ts
```

### Step 4: UI Component Setup

The widget component should be at:
```
src/app/dashboard/work-report-widget.tsx
```

Verify the file exists. If not, copy from installation package:
```bash
cp work-reports-ui/work-report-widget.tsx src/app/dashboard/work-report-widget.tsx
```

### Step 5: Dashboard Integration

Open `src/app/dashboard/dashboard-client.tsx` and verify the following:

1. **Import statement** at the top:
```typescript
import WorkReportWidget from "./work-report-widget"
```

2. **Widget placement for staff** (around line 433):
```typescript
{/* Work Report Widget */}
<WorkReportWidget />
```

3. **Widget placement for admins** (around line 587):
```typescript
{/* Work Report Widget */}
<WorkReportWidget />
```

If these are not present, add them manually.

### Step 6: Install Dependencies (if needed)

All dependencies should already be installed. Verify:

```bash
# Check package.json includes:
# - @supabase/ssr
# - @supabase/supabase-js
# - lucide-react
# - next

# If any are missing, install:
npm install @supabase/ssr @supabase/supabase-js lucide-react
```

### Step 7: Environment Variables

Verify your `.env.local` file contains:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

These should already be configured for your existing Supabase setup.

### Step 8: Build and Test

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open browser
open http://localhost:3000/dashboard

# Test the system:
# 1. Login to dashboard
# 2. Verify Work Report Widget appears
# 3. Click "출근하기" (Clock In)
# 4. Add consumables and expenses
# 5. Save changes
# 6. Click "퇴근하기" (Clock Out)
```

### Step 9: Test API Endpoints

```bash
# Get auth token from browser DevTools > Application > Cookies
# Copy the session cookie

# Test GET
curl http://localhost:3000/api/work-reports \
  -H "Cookie: your-session-cookie"

# Test POST (Clock In)
curl -X POST http://localhost:3000/api/work-reports \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{"consumables":[],"expenses":[],"message":"Test"}'

# Test PUT (Clock Out)
curl -X PUT http://localhost:3000/api/work-reports \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{"reportId":"YOUR_REPORT_ID","clockOut":true}'
```

### Step 10: Verify Permissions

Test with different user roles:

1. **Employee Account:**
   - Can clock in/out
   - Can view own reports
   - Cannot view other employees' reports

2. **Admin Account:**
   - Can clock in/out for themselves
   - Can view all employee reports
   - Can filter by employee

Test by creating accounts with different roles in Supabase Auth.

## Post-Installation Checklist

- [ ] Database tables created successfully
- [ ] RLS policies are active
- [ ] Indexes are created
- [ ] View `work_reports_summary` exists
- [ ] API routes respond correctly
- [ ] Widget appears on dashboard
- [ ] Clock in functionality works
- [ ] Clock out functionality works
- [ ] Consumables can be added/removed
- [ ] Expenses can be added/removed
- [ ] Message/notes can be saved
- [ ] Permissions work correctly
- [ ] Audit logs are created

## Troubleshooting

### Problem: Widget doesn't appear on dashboard

**Solution:**
1. Check browser console for errors
2. Verify import statement in `dashboard-client.tsx`
3. Ensure file path is correct: `./work-report-widget`
4. Rebuild the app: `npm run build`

### Problem: API returns 401 Unauthorized

**Solution:**
1. Verify user is logged in
2. Check Supabase session cookie exists
3. Verify environment variables are set
4. Check Supabase project URL is correct

### Problem: Database error when creating report

**Solution:**
1. Verify migration ran successfully
2. Check table exists: `SELECT * FROM work_reports;`
3. Verify RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'work_reports';`
4. Check user has proper role in `users` table

### Problem: Can't see inventory items in dropdown

**Solution:**
1. Verify `inventory_items` table has data
2. Check API endpoint: `GET /api/inventory`
3. Verify user has read permissions on inventory
4. Check browser console for errors

### Problem: Already clocked in error on first try

**Solution:**
1. Check for existing active reports: `SELECT * FROM work_reports WHERE status = 'in_progress' AND employee_id = 'YOUR_USER_ID';`
2. Delete test reports if needed
3. Clock out from any active sessions

### Problem: Permission denied errors

**Solution:**
1. Verify RLS policies are enabled: `ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;`
2. Check user role: `SELECT role FROM users WHERE id = 'YOUR_USER_ID';`
3. Re-run the migration script
4. Verify policies with: `SELECT * FROM pg_policies WHERE tablename = 'work_reports';`

### Problem: TypeScript errors in IDE

**Solution:**
1. Ensure all types are defined
2. Run `npm run type-check` to verify
3. Add type definitions if needed
4. Restart TypeScript server in IDE

## Production Deployment

### Pre-Deployment Checklist

- [ ] Run migration on production database
- [ ] Test all API endpoints in production
- [ ] Verify RLS policies are active
- [ ] Enable audit logging
- [ ] Set up monitoring/alerts
- [ ] Configure backup strategy
- [ ] Document for team

### Deploying to Vercel

```bash
# Push code to Git
git add .
git commit -m "Add work report system"
git push origin main

# Vercel will auto-deploy
# Or manually deploy:
vercel --prod

# Verify environment variables in Vercel dashboard
```

### Deploying to Other Platforms

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Set environment variables** on your hosting platform

3. **Deploy build output** according to platform instructions

4. **Run database migration** on production database

5. **Test thoroughly** before releasing to users

## Monitoring & Maintenance

### Database Maintenance

```sql
-- Check report counts
SELECT
  DATE(clock_in) as date,
  COUNT(*) as reports
FROM work_reports
GROUP BY DATE(clock_in)
ORDER BY date DESC
LIMIT 30;

-- Check average work hours
SELECT
  AVG(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600) as avg_hours
FROM work_reports
WHERE clock_out IS NOT NULL;

-- Check consumables usage
SELECT
  c->>'item_name' as item_name,
  SUM((c->>'quantity')::numeric) as total_quantity
FROM work_reports,
jsonb_array_elements(consumables) as c
GROUP BY c->>'item_name'
ORDER BY total_quantity DESC;
```

### Monitoring Queries

```sql
-- Active sessions
SELECT
  u.name,
  wr.clock_in,
  EXTRACT(EPOCH FROM (NOW() - wr.clock_in)) / 3600 as hours_so_far
FROM work_reports wr
JOIN users u ON wr.employee_id = u.id
WHERE wr.status = 'in_progress'
ORDER BY wr.clock_in;

-- Daily summary
SELECT
  DATE(clock_in) as date,
  COUNT(*) as total_reports,
  COUNT(clock_out) as completed_reports,
  AVG(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600) as avg_hours
FROM work_reports
WHERE DATE(clock_in) = CURRENT_DATE
GROUP BY DATE(clock_in);
```

### Performance Optimization

If you notice slow queries:

1. **Add GIN index for JSONB:**
   ```sql
   CREATE INDEX idx_work_reports_consumables_gin ON work_reports USING GIN (consumables);
   CREATE INDEX idx_work_reports_expenses_gin ON work_reports USING GIN (expenses);
   ```

2. **Analyze tables:**
   ```sql
   ANALYZE work_reports;
   ```

3. **Vacuum regularly:**
   ```sql
   VACUUM ANALYZE work_reports;
   ```

## Backup & Recovery

### Backup Strategy

```bash
# Backup work_reports table
pg_dump -h your-host -U postgres -t work_reports your_db > work_reports_backup.sql

# Or use Supabase backup feature
# Dashboard > Database > Backups
```

### Recovery

```bash
# Restore from backup
psql -h your-host -U postgres your_db < work_reports_backup.sql
```

## Security Considerations

1. **RLS Policies:** Always keep RLS enabled on production
2. **Audit Logs:** Monitor for suspicious activity
3. **API Rate Limiting:** Consider implementing rate limits
4. **Input Validation:** All inputs are validated server-side
5. **SQL Injection:** Using Supabase client prevents SQL injection
6. **XSS Protection:** All user inputs are sanitized by React

## Support & Updates

### Getting Help

1. Check error logs in Supabase Dashboard
2. Review API response errors
3. Check browser console for client errors
4. Review audit logs for investigation
5. Consult documentation files

### Version Updates

When updating the system:
1. Backup database first
2. Test in staging environment
3. Review changelog
4. Run any new migrations
5. Deploy during low-traffic period
6. Monitor for issues

## Additional Resources

- **Main Documentation:** `WORK_REPORT_SYSTEM_README.md`
- **API Reference:** `WORK_REPORT_API_GUIDE.md`
- **Database Schema:** `schema_migration_work_reports.sql`
- **UI Component:** `src/app/dashboard/work-report-widget.tsx`
- **API Routes:** `src/app/api/work-reports/route.ts`

## Success Metrics

After installation, monitor:
- Daily active users (employees clocking in)
- Average work hours per employee
- Consumables usage trends
- Expense reporting compliance
- API error rates
- User feedback

## Next Steps

1. Train employees on how to use the system
2. Monitor for first few days
3. Collect feedback
4. Adjust as needed
5. Consider additional features (see README for ideas)

---

**Installation Date:** _____________________
**Installed By:** _____________________
**Production URL:** _____________________
**Database:** _____________________

---

**Last Updated:** 2026-01-14
**Version:** 1.0.0
