-- Add audio support columns to messages and group_messages tables

-- Add to messages table
DO $$
BEGIN
    -- Add message_type column (text, audio, etc.)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'message_type'
    ) THEN
        ALTER TABLE messages ADD COLUMN message_type VARCHAR(20) DEFAULT 'text';
        RAISE NOTICE 'message_type column added to messages table';
    ELSE
        RAISE NOTICE 'message_type column already exists in messages table';
    END IF;
    
    -- Add audio_file_path column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'audio_file_path'
    ) THEN
        ALTER TABLE messages ADD COLUMN audio_file_path VARCHAR(255);
        RAISE NOTICE 'audio_file_path column added to messages table';
    ELSE
        RAISE NOTICE 'audio_file_path column already exists in messages table';
    END IF;
    
    -- Add audio_duration column (in seconds)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'audio_duration'
    ) THEN
        ALTER TABLE messages ADD COLUMN audio_duration INTEGER;
        RAISE NOTICE 'audio_duration column added to messages table';
    ELSE
        RAISE NOTICE 'audio_duration column already exists in messages table';
    END IF;
END $$;

-- Add to group_messages table
DO $$
BEGIN
    -- Add message_type column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'group_messages' AND column_name = 'message_type'
    ) THEN
        ALTER TABLE group_messages ADD COLUMN message_type VARCHAR(20) DEFAULT 'text';
        RAISE NOTICE 'message_type column added to group_messages table';
    ELSE
        RAISE NOTICE 'message_type column already exists in group_messages table';
    END IF;
    
    -- Add audio_file_path column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'group_messages' AND column_name = 'audio_file_path'
    ) THEN
        ALTER TABLE group_messages ADD COLUMN audio_file_path VARCHAR(255);
        RAISE NOTICE 'audio_file_path column added to group_messages table';
    ELSE
        RAISE NOTICE 'audio_file_path column already exists in group_messages table';
    END IF;
    
    -- Add audio_duration column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'group_messages' AND column_name = 'audio_duration'
    ) THEN
        ALTER TABLE group_messages ADD COLUMN audio_duration INTEGER;
        RAISE NOTICE 'audio_duration column added to group_messages table';
    ELSE
        RAISE NOTICE 'audio_duration column already exists in group_messages table';
    END IF;
END $$;

