CREATE TYPE audit_action_type AS ENUM (
  'auth', 'project', 'server', 'role', 'webhook', 'member', 'sync', 'permission'
);--> statement-breakpoint

CREATE TYPE audit_severity AS ENUM ('info', 'warning', 'error');--> statement-breakpoint

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  actor_id VARCHAR(255) REFERENCES members(id) ON DELETE SET NULL,
  actor_name VARCHAR(255),
  action_type audit_action_type NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  severity audit_severity DEFAULT 'info' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);--> statement-breakpoint

CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);--> statement-breakpoint
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);--> statement-breakpoint
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);--> statement-breakpoint
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);--> statement-breakpoint
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);
