ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS client_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS client_ip_address VARCHAR(45);--> statement-breakpoint

CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token_hash) WHERE refresh_token_hash IS NOT NULL;
