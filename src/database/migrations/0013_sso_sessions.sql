CREATE TABLE sso_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id VARCHAR(255) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_used_at TIMESTAMPTZ
);--> statement-breakpoint

CREATE INDEX idx_sso_sessions_member_id ON sso_sessions(member_id);--> statement-breakpoint
CREATE INDEX idx_sso_sessions_token_hash ON sso_sessions(token_hash);--> statement-breakpoint
CREATE INDEX idx_sso_sessions_expires_at ON sso_sessions(expires_at);
