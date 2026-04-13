CREATE TABLE IF NOT EXISTS requisition_approval_steps (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id VARCHAR NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  stage VARCHAR NOT NULL,
  assigned_to VARCHAR REFERENCES managed_users(id) ON DELETE SET NULL,
  assigned_to_name VARCHAR,
  decision VARCHAR NOT NULL DEFAULT 'pending',
  comments TEXT,
  decided_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_approval_steps_requisition ON requisition_approval_steps(requisition_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_assigned ON requisition_approval_steps(assigned_to);
CREATE INDEX IF NOT EXISTS idx_approval_steps_decision ON requisition_approval_steps(decision);
