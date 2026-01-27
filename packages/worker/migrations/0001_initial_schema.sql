-- Create payment_events table
CREATE TABLE payment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL,
  recovery_branch TEXT NOT NULL,
  due_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_payment_customer ON payment_events(customer_id);
CREATE INDEX idx_payment_created ON payment_events(created_at);
CREATE INDEX idx_payment_branch ON payment_events(recovery_branch);
CREATE INDEX idx_payment_status ON payment_events(status);
CREATE INDEX idx_payment_invoice ON payment_events(invoice_id);

-- Create engagement_events table
CREATE TABLE engagement_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  invoice_id TEXT,
  status TEXT NOT NULL,
  recovery_branch TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_engagement_customer ON engagement_events(customer_id);
CREATE INDEX idx_engagement_message ON engagement_events(message_id);
CREATE INDEX idx_engagement_invoice ON engagement_events(invoice_id);
CREATE INDEX idx_engagement_created ON engagement_events(created_at);

-- Create recovery_logs table
CREATE TABLE recovery_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  payment_event_id INTEGER,
  engagement_event_id INTEGER,
  recovery_branch TEXT NOT NULL,
  message_sent_at TEXT,
  message_delivered_at TEXT,
  message_read_at TEXT,
  payment_received_at TEXT,
  amount INTEGER,
  payment_method TEXT,
  recovery_time_hours INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  FOREIGN KEY (payment_event_id) REFERENCES payment_events(id),
  FOREIGN KEY (engagement_event_id) REFERENCES engagement_events(id)
);

CREATE INDEX idx_recovery_customer ON recovery_logs(customer_id);
CREATE INDEX idx_recovery_invoice ON recovery_logs(invoice_id);
CREATE INDEX idx_recovery_branch ON recovery_logs(recovery_branch);
CREATE INDEX idx_recovery_created ON recovery_logs(created_at);

-- Create customer_cohorts table
CREATE TABLE customer_cohorts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT UNIQUE NOT NULL,
  cohort_month TEXT NOT NULL,
  subscription_start_date TEXT NOT NULL,
  subscription_plan TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_cohort_month ON customer_cohorts(cohort_month);
CREATE INDEX idx_cohort_customer ON customer_cohorts(customer_id);
