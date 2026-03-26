-- DS Personal Loan database schema

-- users table for borrower/admin accounts
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  gender TEXT,
  contact TEXT,
  email TEXT NOT NULL UNIQUE,
  address TEXT,
  password TEXT NOT NULL,
  job_type TEXT,
  employer TEXT,
  salary NUMERIC,
  id_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- loans table for requested/active/paid loans
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  interest NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  due_date TIMESTAMP WITHOUT TIME ZONE,
  disbursed_at TIMESTAMP WITHOUT TIME ZONE
);

-- repayments table for payment events
CREATE TABLE IF NOT EXISTS repayments (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  method TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- notifications table for user/admin alerts
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  target TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  read BOOL NOT NULL DEFAULT FALSE
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_repayments_user_id ON repayments(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target);
