-- ─── ENUM Types ─────────────────────────────────────────────────────────────

CREATE TYPE user_role        AS ENUM ('customer', 'merchant', 'admin');
CREATE TYPE user_status      AS ENUM ('active', 'suspended', 'banned');
CREATE TYPE wallet_status    AS ENUM ('active', 'suspended');
CREATE TYPE otp_status       AS ENUM ('pending', 'verified', 'expired');
CREATE TYPE admin_role       AS ENUM ('super_admin', 'support', 'finance');

-- ─Users Table ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL          PRIMARY KEY,
  name          VARCHAR(100)    NOT NULL,
  email         VARCHAR(150)    UNIQUE NOT NULL,
  phone         VARCHAR(20)     UNIQUE NOT NULL,
  password      TEXT            NOT NULL,
  role          user_role       NOT NULL DEFAULT 'customer',
  status        user_status     NOT NULL DEFAULT 'active',
  is_verified   BOOLEAN         NOT NULL DEFAULT FALSE,
  avatar_url    TEXT,
  created_at    TIMESTAMP       NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- ─── Wallets Table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wallets (
  id            SERIAL          PRIMARY KEY,
  user_id       INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance       NUMERIC(12, 2)  NOT NULL DEFAULT 0.00,
  status        wallet_status   NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP       NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- ─── OTPs Table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS otps (
  id            SERIAL          PRIMARY KEY,
  user_id       INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone         VARCHAR(20)     NOT NULL,
  code          VARCHAR(6)      NOT NULL,
  status        otp_status      NOT NULL DEFAULT 'pending',
  expires_at    TIMESTAMP       NOT NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- ─── Admins Table ────────────────────────────────────────────────────────────
-- Each admin is also a user (user.role = 'admin')
-- This table stores admin-specific permissions on top of that

CREATE TABLE IF NOT EXISTS admins (
  id                  SERIAL       PRIMARY KEY,
  user_id             INTEGER      NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  admin_role          admin_role   NOT NULL DEFAULT 'support',
  can_manage_users    BOOLEAN      NOT NULL DEFAULT FALSE,
  can_manage_wallets  BOOLEAN      NOT NULL DEFAULT FALSE,
  can_view_reports    BOOLEAN      NOT NULL DEFAULT FALSE,
  can_suspend_users   BOOLEAN      NOT NULL DEFAULT FALSE,
  last_login          TIMESTAMP,
  created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ─── Admin Activity Logs ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_logs (
  id            SERIAL          PRIMARY KEY,
  admin_id      INTEGER         NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  action        VARCHAR(100)    NOT NULL,
  target_table  VARCHAR(50),
  target_id     INTEGER,
  description   TEXT,
  ip_address    VARCHAR(45),
  created_at    TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- ─── Password Reset Tokens ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS password_resets (
  id            SERIAL          PRIMARY KEY,
  user_id       INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token         TEXT            NOT NULL,
  expires_at    TIMESTAMP       NOT NULL,
  used          BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- ─── Refresh Tokens ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            SERIAL          PRIMARY KEY,
  user_id       INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token         TEXT            NOT NULL UNIQUE,
  expires_at    TIMESTAMP       NOT NULL,
  revoked       BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_users_email          ON users(email);
CREATE INDEX idx_users_phone          ON users(phone);
CREATE INDEX idx_users_role           ON users(role);
CREATE INDEX idx_users_status         ON users(status);
CREATE INDEX idx_wallets_user_id      ON wallets(user_id);
CREATE INDEX idx_otps_user_id         ON otps(user_id);
CREATE INDEX idx_otps_status          ON otps(status);
CREATE INDEX idx_admins_user_id       ON admins(user_id);
CREATE INDEX idx_admin_logs_admin_id  ON admin_logs(admin_id);
CREATE INDEX idx_refresh_tokens_user  ON refresh_tokens(user_id);

-- ─── Auto-update updated_at Trigger ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER admins_updated_at
  BEFORE UPDATE ON admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Seed: Default Super Admin ───────────────────────────────────────────────
-- Password: Admin@1234  (bcrypt hash below — change before production!)

INSERT INTO users (name, email, phone, password, role, is_verified, status)
VALUES (
  'Super Admin',
  'admin@fawry.com',
  '+20100000000',
  '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.',
  'admin',
  TRUE,
  'active'
);

INSERT INTO admins (user_id, admin_role, can_manage_users, can_manage_wallets, can_view_reports, can_suspend_users)
VALUES (
  (SELECT id FROM users WHERE email = 'admin@fawry.com'),
  'super_admin',
  TRUE, TRUE, TRUE, TRUE
);

ALTER TABLE users 
ADD COLUMN reset_token TEXT,
ADD COLUMN reset_token_expires_at TIMESTAMP;
