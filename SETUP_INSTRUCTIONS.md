# Database Setup Instructions

## ⚠️ CRITICAL: You must create the database tables before the app will work!

The error `Could not find the table 'public.markets'` means the tables don't exist yet.

## Quick Setup Steps

### 1. Open Supabase SQL Editor
Go to: https://supabase.com/dashboard/project/oyzbtlhgeqqhlmalxdvm/sql/new

### 2. Run the SQL Migration
Copy the entire contents of `backend/scripts/create_tables.sql` and paste it into the SQL Editor, then click "Run".

**OR** copy this SQL directly:

```sql
-- Create tables for Tempora Prediction Markets

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Markets table
CREATE TABLE IF NOT EXISTS markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'resolved', 'suspended')),
    resolution_date TIMESTAMPTZ NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    baseline_probability DOUBLE PRECISION DEFAULT 0.5,
    initial_liquidity DOUBLE PRECISION DEFAULT 500.0,
    settlement_dates JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    side TEXT NOT NULL CHECK (side IN ('YES', 'NO')),
    price_cents DOUBLE PRECISION NOT NULL,
    shares DOUBLE PRECISION NOT NULL,
    stake DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_category ON markets(category);
CREATE INDEX IF NOT EXISTS idx_markets_created_at ON markets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_market_id ON trades(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- RLS Policies for markets (public read, authenticated write)
CREATE POLICY "Anyone can view markets"
    ON markets FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can create markets"
    ON markets FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update markets"
    ON markets FOR UPDATE
    USING (auth.role() = 'authenticated');

-- RLS Policies for trades
CREATE POLICY "Users can view their own trades"
    ON trades FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own trades"
    ON trades FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON markets TO authenticated;
GRANT ALL ON trades TO authenticated;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_markets_updated_at BEFORE UPDATE ON markets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 3. Verify Tables Were Created
After running the SQL:
- Go to Supabase Dashboard → Table Editor
- You should see: `profiles`, `markets`, and `trades` tables

### 4. Wait for Schema Cache Refresh
PostgREST (Supabase's API layer) may need a few seconds to refresh its schema cache after creating tables. Wait 10-30 seconds after running the SQL.

### 5. Restart Your Backend
Restart your backend server to ensure it picks up the new tables.

### 6. (Optional) Seed Sample Data
```bash
python3 backend/scripts/seed_data.py
```

## Troubleshooting

### Still getting "table not found" errors?
1. **Double-check** you ran the SQL in Supabase Dashboard SQL Editor
2. **Verify** tables exist: Go to Dashboard → Table Editor
3. **Wait** 30 seconds - PostgREST needs time to refresh schema cache
4. **Check** your `SUPABASE_SERVICE_ROLE_KEY` is correct in `backend/.env`

### Registration returns 400 Bad Request?
This might be because Supabase requires email confirmation. Check:
- Supabase Dashboard → Authentication → Settings
- Disable "Enable email confirmations" for testing, OR
- Ensure emails are being sent (check spam folder)

## After Setup

Once tables are created:
- ✅ Markets API will work
- ✅ Trades API will work  
- ✅ Portfolio API will work
- ✅ Auth should work (may need email confirmation disabled)

