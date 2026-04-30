-- Nuclear Reset: Remove existing tables to ensure a clean slate
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

-- Ensure public schema is accessible (fixes 42501 permission errors in some cases)
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO postgres;

-- Users Table
CREATE TABLE users (
  telegram_id BIGINT PRIMARY KEY,
  first_name TEXT,
  username TEXT,
  balance DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products Table
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT,
  variants JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders Table
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL,
  user_info JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Grant Permissions to anon/auth roles
GRANT ALL ON products TO postgres, anon, authenticated;
GRANT ALL ON orders TO postgres, anon, authenticated;
GRANT ALL ON users TO postgres, anon, authenticated;

-- Policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public read products" ON products;
    CREATE POLICY "Public read products" ON products FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Enable insert for all users" ON products;
    CREATE POLICY "Enable insert for all users" ON products FOR INSERT WITH CHECK (true);

    DROP POLICY IF EXISTS "Enable update for all users" ON products;
    CREATE POLICY "Enable update for all users" ON products FOR UPDATE USING (true);

    DROP POLICY IF EXISTS "Enable delete for all users" ON products;
    CREATE POLICY "Enable delete for all users" ON products FOR DELETE USING (true);
    
    DROP POLICY IF EXISTS "Public insert orders" ON orders;
    CREATE POLICY "Public insert orders" ON orders FOR INSERT WITH CHECK (true);

    DROP POLICY IF EXISTS "Enable all access for users" ON users;
    CREATE POLICY "Enable all access for users" ON users FOR ALL USING (true);
END $$;
