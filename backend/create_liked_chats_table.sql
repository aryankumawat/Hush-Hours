-- Create table for liked chats (favorites)
CREATE TABLE IF NOT EXISTS liked_chats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, conversation_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_liked_chats_user_id ON liked_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_liked_chats_conversation_id ON liked_chats(conversation_id);

