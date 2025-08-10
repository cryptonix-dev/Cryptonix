-- Friends & Direct Messages schema

DO $$ BEGIN CREATE TYPE friendship_status AS ENUM ('PENDING','ACCEPTED','BLOCKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS friendship (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uniq_friend_pair UNIQUE (requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friend_requester ON friendship(requester_id);
CREATE INDEX IF NOT EXISTS idx_friend_addressee ON friendship(addressee_id);

CREATE TABLE IF NOT EXISTS conversation (
  id SERIAL PRIMARY KEY,
  is_group BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_participant (
  conversation_id INTEGER NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  last_read_message_id INTEGER,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_participant_convo ON conversation_participant(conversation_id);
CREATE INDEX IF NOT EXISTS idx_participant_user ON conversation_participant(user_id);

CREATE TABLE IF NOT EXISTS message (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_message_convo ON message(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_sender ON message(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_created ON message(created_at);


