# CampusCare — Production Database & Disaster Recovery Guide

This document outlines the database backup, recovery, data-integrity, and security policies for the CampusCare platform deployed on Supabase/PostgreSQL.

---

## 1. Supabase Infrastructure Backup Architecture

CampusCare utilizes Supabase managed PostgreSQL infrastructure:
- **Automated Daily Backups**: Managed by Supabase infrastructure on Point-In-Time Recovery (PITR) enabled tiers or standard daily snapshot tier.
- **Physical Backup Responsibility**: Managed at the cloud infrastructure layer by Supabase/GCP Cloud SQL engine.
- **Logical Backup Option**: Standard PostgreSQL `pg_dump` utility can be executed against the database connection string for manual logical backups.

---

## 2. Point-In-Time Recovery (PITR) & Restore Workflows

If a catastrophic database event or corrupted data migration occurs:

1. **Dashboard Restore Procedure**:
   - Access the **Supabase Dashboard** -> **Project Settings** -> **Database**.
   - Navigate to **Backups**.
   - Select the desired restore timestamp (up to 7 days for Pro/Enterprise PITR tiers).
   - Initiate the restore procedure to restore database state to a clean point in time.

2. **Manual Logical Recovery (`pg_dump` / `pg_restore`)**:
   ```bash
   # Export logical database backup
   pg_dump -h db.<project-ref>.supabase.co -U postgres -d postgres -F c -b -v -f campuscare_backup.dump

   # Restore logical dump
   pg_restore -h db.<project-ref>.supabase.co -U postgres -d postgres -v -c campuscare_backup.dump
   ```

---

## 3. Post-Restoration Verification Protocol

Immediately after restoring a database snapshot or running `schema.sql`:

1. **Verify Row-Level Security (RLS)**:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   -- Ensure all tables return rowsecurity = true
   ```

2. **Verify Realtime Publication Setup**:
   ```sql
   SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
   -- Ensure notifications, sos_alerts, appointments, system_health_events, scheduler_logs are present
   ```

3. **Verify pg_cron Schedule Setup**:
   ```sql
   SELECT * FROM cron.job;
   -- Ensure campuscare_reminder_job is active with '*/5 * * * *' schedule
   ```

4. **Verify Storage Buckets**:
   ```sql
   SELECT id, name, public FROM storage.buckets;
   -- Ensure 'incident-evidence' is present and private (public = false)
   ```

---

## 4. Migration & Schema Maintenance Protocol

- All database schema updates must be idempotently recorded in `/supabase/schema.sql`.
- Statements should use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `CREATE OR REPLACE FUNCTION`.
- `SECURITY DEFINER` functions must explicitly set `search_path = public, pg_temp` to prevent search_path escalation vulnerabilities.
- Function authorization must rely on trusted database records via `auth.uid()` rather than client-supplied parameters.
