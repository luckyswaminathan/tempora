# Database Setup

## Quick Setup

The easiest way to set up your database tables is through the Supabase Dashboard:

1. **Go to SQL Editor** in your Supabase Dashboard:
   - https://supabase.com/dashboard/project/oyzbtlhgeqqhlmalxdvm/sql

2. **Copy and paste** the contents of `create_tables.sql` into the editor

3. **Click "Run"** to execute the migration

This will create:
- `profiles` table (user profiles)
- `markets` table (prediction markets)
- `trades` table (user trades)
- All necessary indexes and RLS policies

## What the SQL Does

- Creates 3 main tables with proper relationships
- Sets up Row Level Security (RLS) policies
- Creates indexes for better query performance
- Adds triggers for auto-updating timestamps

## After Setup

Once the tables are created, you can:

1. **Seed sample data** (optional):
   ```bash
   python backend/scripts/seed_data.py
   ```

2. **Start your backend**:
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```

## Troubleshooting

If you get "table not found" errors:
- Make sure you ran the SQL migration in Supabase Dashboard
- Check that your `SUPABASE_SERVICE_ROLE_KEY` is correct
- Verify tables exist in Supabase Dashboard -> Table Editor

