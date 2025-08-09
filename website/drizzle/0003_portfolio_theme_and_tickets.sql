-- Add portfolio theme to user and create support ticketing tables

-- Create enums if not exist
DO $$
BEGIN
    CREATE TYPE ticket_status AS ENUM ('OPEN', 'PENDING', 'SOLVED', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE ticket_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add user column for per-portfolio theme
ALTER TABLE "user"
    ADD COLUMN IF NOT EXISTS "portfolio_theme" varchar(20) DEFAULT 'default';

-- Optional banner image per user
ALTER TABLE "user"
    ADD COLUMN IF NOT EXISTS "banner_image" text;

-- Support ticket main table
CREATE TABLE IF NOT EXISTS support_ticket (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    subject VARCHAR(200) NOT NULL,
    status ticket_status NOT NULL DEFAULT 'OPEN',
    priority ticket_priority NOT NULL DEFAULT 'LOW',
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_user ON support_ticket(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_status ON support_ticket(status);
CREATE INDEX IF NOT EXISTS idx_ticket_updated ON support_ticket(updated_at);

-- Support ticket messages
CREATE TABLE IF NOT EXISTS support_ticket_message (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES support_ticket(id) ON DELETE CASCADE,
    author_user_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    is_staff_reply BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_message_ticket ON support_ticket_message(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_message_created ON support_ticket_message(created_at);


