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

ALTER TABLE users
ADD COLUMN pin TEXT DEFAULT NULL;

CREATE TYPE transaction_type    AS ENUM ('topup', 'transfer', 'bill_payment', 'withdrawal', 'refund');
CREATE TYPE transaction_status  AS ENUM ('initiated', 'pending', 'processing', 'completed', 'failed', 'reversed');
CREATE TYPE payment_method      AS ENUM ('card', 'bank_transfer', 'agent');

CREATE TABLE IF NOT EXISTS transactions (
  id                SERIAL              PRIMARY KEY,
  reference_no      VARCHAR(20)         UNIQUE NOT NULL,
  wallet_id         INTEGER             NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id           INTEGER             NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  type              transaction_type    NOT NULL,
  status            transaction_status  NOT NULL DEFAULT 'initiated',
  amount            NUMERIC(12, 2)      NOT NULL CHECK (amount > 0),
  fee               NUMERIC(12, 2)      NOT NULL DEFAULT 0.00,
  payment_method    payment_method,
  description       TEXT,
  metadata          JSONB               DEFAULT '{}',
  created_at        TIMESTAMP           NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP           NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_wallet_id   ON transactions(wallet_id);
CREATE INDEX idx_transactions_user_id     ON transactions(user_id);
CREATE INDEX idx_transactions_status      ON transactions(status);
CREATE INDEX idx_transactions_type        ON transactions(type);
CREATE INDEX idx_transactions_reference   ON transactions(reference_no);

CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


  -- 1. Platform revenue table
CREATE TABLE IF NOT EXISTS platform_revenue (
  id            SERIAL          PRIMARY KEY,
  transaction_id INTEGER        NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  amount        NUMERIC(12, 2)  NOT NULL,
  type          VARCHAR(50)     NOT NULL, -- topup_fee, transfer_fee, bill_fee
  created_at    TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_revenue_transaction ON platform_revenue(transaction_id);
CREATE INDEX idx_platform_revenue_created_at  ON platform_revenue(created_at);

-- 2. Platform wallet table (one row only)
CREATE TABLE IF NOT EXISTS platform_wallet (
  id            SERIAL          PRIMARY KEY,
  balance       NUMERIC(15, 2)  NOT NULL DEFAULT 0.00,
  total_earned  NUMERIC(15, 2)  NOT NULL DEFAULT 0.00,
  updated_at    TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- 3. Insert the one platform wallet row
INSERT INTO platform_wallet (balance, total_earned) VALUES (0.00, 0.00);

-- Store user bank accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id              SERIAL        PRIMARY KEY,
  user_id         INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_name       VARCHAR(100)  NOT NULL,
  account_number  VARCHAR(50)   NOT NULL,
  account_name    VARCHAR(100)  NOT NULL,
  is_default      BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_accounts_user_id ON bank_accounts(user_id);

CREATE TYPE payment_request_status AS ENUM ('pending', 'paid', 'cancelled', 'expired');

CREATE TABLE IF NOT EXISTS payment_requests (
  id            SERIAL                  PRIMARY KEY,
  reference_no  TEXT                    UNIQUE NOT NULL,
  requester_id  INTEGER                 NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payer_phone   VARCHAR(20),
  amount        NUMERIC(12, 2)          NOT NULL CHECK (amount > 0),
  note          TEXT,
  status        payment_request_status  NOT NULL DEFAULT 'pending',
  expires_at    TIMESTAMP               NOT NULL,
  paid_at       TIMESTAMP,
  created_at    TIMESTAMP               NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_requests_requester ON payment_requests(requester_id);
CREATE INDEX idx_payment_requests_status    ON payment_requests(status);
CREATE INDEX idx_payment_requests_reference ON payment_requests(reference_no);


CREATE TABLE IF NOT EXISTS merchants (
  id              SERIAL        PRIMARY KEY,
  user_id         INTEGER       NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  business_name   VARCHAR(150)  NOT NULL,
  business_type   VARCHAR(100),
  iban            VARCHAR(100)  NOT NULL,
  webhook_url     TEXT,
  api_key         TEXT          NOT NULL UNIQUE,
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_merchants_user_id  ON merchants(user_id);
CREATE INDEX idx_merchants_api_key  ON merchants(api_key);
CREATE INDEX idx_merchants_is_active ON merchants(is_active);

CREATE TRIGGER merchants_updated_at
  BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();



CREATE TYPE charge_status AS ENUM ('pending', 'completed', 'failed', 'expired', 'refunded');

CREATE TABLE IF NOT EXISTS merchant_charges (
  id              SERIAL        PRIMARY KEY,
  merchant_id     INTEGER       NOT NULL REFERENCES merchants(id)  ON DELETE CASCADE,
  customer_id     INTEGER       REFERENCES users(id)               ON DELETE SET NULL,
  order_id        VARCHAR(100)  NOT NULL,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency        VARCHAR(10)   NOT NULL DEFAULT 'EGP',
  description     TEXT,
  status          charge_status NOT NULL DEFAULT 'pending',
  payment_token   TEXT          NOT NULL UNIQUE,
  payment_url     TEXT          NOT NULL,
  callback_url    TEXT,
  customer_phone  VARCHAR(20),
  paid_at         TIMESTAMP,
  expires_at      TIMESTAMP     NOT NULL,
  metadata        JSONB         DEFAULT '{}',
  created_at      TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_merchant_charges_merchant_id   ON merchant_charges(merchant_id);
CREATE INDEX idx_merchant_charges_customer_id   ON merchant_charges(customer_id);
CREATE INDEX idx_merchant_charges_order_id      ON merchant_charges(order_id);
CREATE INDEX idx_merchant_charges_payment_token ON merchant_charges(payment_token);
CREATE INDEX idx_merchant_charges_status        ON merchant_charges(status);

CREATE TRIGGER merchant_charges_updated_at
  BEFORE UPDATE ON merchant_charges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


CREATE TYPE settlement_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS settlements (
  id              SERIAL            PRIMARY KEY,
  merchant_id     INTEGER           NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  amount          NUMERIC(12, 2)    NOT NULL CHECK (amount > 0),
  fee             NUMERIC(12, 2)    NOT NULL DEFAULT 0.00,
  net_amount      NUMERIC(12, 2)    NOT NULL,
  currency        VARCHAR(10)       NOT NULL DEFAULT 'EGP',
  status          settlement_status NOT NULL DEFAULT 'pending',
  iban            VARCHAR(100)      NOT NULL,
  bank_reference  VARCHAR(100),
  period_from     TIMESTAMP         NOT NULL,
  period_to       TIMESTAMP         NOT NULL,
  settled_at      TIMESTAMP,
  notes           TEXT,
  created_at      TIMESTAMP         NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP         NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_settlements_merchant_id ON settlements(merchant_id);
CREATE INDEX idx_settlements_status      ON settlements(status);
CREATE INDEX idx_settlements_created_at  ON settlements(created_at);

CREATE TRIGGER settlements_updated_at
  BEFORE UPDATE ON settlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed some settlements for testing
INSERT INTO settlements
  (merchant_id, amount, fee, net_amount, currency, status, iban, bank_reference, period_from, period_to, settled_at)
VALUES
  (1, 5000.00, 25.00, 4975.00, 'EGP', 'completed', 'EG380019000500000000263180002', 'BANK-REF-001', NOW() - INTERVAL '30 days', NOW() - INTERVAL '15 days', NOW() - INTERVAL '14 days'),
  (1, 3000.00, 15.00, 2985.00, 'EGP', 'completed', 'EG380019000500000000263180002', 'BANK-REF-002', NOW() - INTERVAL '15 days', NOW() - INTERVAL '1 day',  NOW() - INTERVAL '1 day'),
  (1, 1500.00, 7.50,  1492.50, 'EGP', 'pending',   'EG380019000500000000263180002', NULL,           NOW() - INTERVAL '1 day',  NOW(),                       NULL);

CREATE TABLE IF NOT EXISTS agents (
  id              SERIAL        PRIMARY KEY,
  user_id         INTEGER       NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  business_name   VARCHAR(150)  NOT NULL,
  location        VARCHAR(255),
  float_balance   NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TYPE agent_transaction_type AS ENUM ('cashin', 'cashout', 'float_topup');
CREATE TYPE agent_transaction_status AS ENUM ('pending', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS agent_transactions (
  id              SERIAL                    PRIMARY KEY,
  agent_id        INTEGER                   NOT NULL REFERENCES agents(id)  ON DELETE CASCADE,
  user_id         INTEGER                   NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  type            agent_transaction_type    NOT NULL,
  status          agent_transaction_status  NOT NULL DEFAULT 'pending',
  amount          NUMERIC(12,2)             NOT NULL CHECK (amount > 0),
  fee             NUMERIC(12,2)             NOT NULL DEFAULT 0.00,
  reference_no    TEXT                      NOT NULL UNIQUE,
  note            TEXT,
  created_at      TIMESTAMP                 NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_user_id               ON agents(user_id);
CREATE INDEX idx_agent_transactions_agent_id  ON agent_transactions(agent_id);
CREATE INDEX idx_agent_transactions_user_id   ON agent_transactions(user_id);
CREATE INDEX idx_agent_transactions_type      ON agent_transactions(type);

CREATE TRIGGER agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add agent role to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'agent';

-- Seed a test agent
INSERT INTO users (name, email, phone, password, role, is_verified, status)
VALUES (
  'Test Agent',
  'agent@fawry.com',
  '+20111000000',
  '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.',
  'agent',
  TRUE, 
  'active'
);

INSERT INTO agents (user_id, business_name, location, float_balance)
VALUES (
  (SELECT id FROM users WHERE email = 'agent@fawry.com'),
  'Fawry Agent Branch 1',
  'Cairo, Egypt',
  10000.00
);

CREATE TYPE withdrawal_code_status AS ENUM ('pending', 'used', 'expired', 'cancelled');

CREATE TABLE IF NOT EXISTS withdrawal_codes (
  id            SERIAL                  PRIMARY KEY,
  user_id       INTEGER                 NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code          VARCHAR(10)             NOT NULL UNIQUE,
  amount        NUMERIC(12,2)           NOT NULL CHECK (amount > 0),
  status        withdrawal_code_status  NOT NULL DEFAULT 'pending',
  expires_at    TIMESTAMP               NOT NULL,
  used_at       TIMESTAMP,
  used_by_agent INTEGER                 REFERENCES agents(id),
  created_at    TIMESTAMP               NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_withdrawal_codes_user_id ON withdrawal_codes(user_id);
CREATE INDEX idx_withdrawal_codes_code    ON withdrawal_codes(code);
CREATE INDEX idx_withdrawal_codes_status  ON withdrawal_codes(status);