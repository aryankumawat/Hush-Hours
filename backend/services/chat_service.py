from database import get_connection
from datetime import datetime

def get_conversations_for_user(user_id):
    conn = get_connection()
    cur = conn.cursor()

    # Ensure user_id is an integer
    if not user_id:
        print(f"[DEBUG chat.py] user_id is None or falsy, returning empty list")
        return []

    # Convert to int if it's not already
    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        print(f"[DEBUG chat.py] user_id cannot be converted to int: {user_id}")
        return []

    print(f"[DEBUG chat.py] Querying conversations for user_id: {user_id} (type: {type(user_id)})")
    
    # First, let's verify the user exists
    cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
    user_exists = cur.fetchone()
    if not user_exists:
        print(f"[DEBUG chat.py] ERROR: User {user_id} does not exist in database!")
        cur.close()
        conn.close()
        return []
    
    # First, check ALL conversations in database
    cur.execute("SELECT COUNT(*) FROM conversations")
    total_convos = cur.fetchone()[0]
    print(f"[DEBUG chat.py] Total conversations in entire database: {total_convos}")
    
    # Check all conversations for this user
    cur.execute("""
        SELECT id, user1_id, user2_id 
        FROM conversations 
        WHERE user1_id = %s OR user2_id = %s
    """, (user_id, user_id))
    all_convos = cur.fetchall()
    print(f"[DEBUG chat.py] Total conversations for user {user_id}: {len(all_convos)}")
    for conv in all_convos:
        other_id = conv[2] if conv[1] == user_id else conv[1]
        print(f"  - Conversation {conv[0]}: user1={conv[1]}, user2={conv[2]}, other_user_id={other_id}")
    
    # Also check conversations for user 8 (demo3) if different
    if user_id != 8:
        cur.execute("""
            SELECT id, user1_id, user2_id 
            FROM conversations 
            WHERE user1_id = 8 OR user2_id = 8
        """)
        user8_convos = cur.fetchall()
        print(f"[DEBUG chat.py] Total conversations for user 8 (demo3): {len(user8_convos)}")
        for conv in user8_convos:
            other_id = conv[2] if conv[1] == 8 else conv[1]
            print(f"  - Conversation {conv[0]}: user1={conv[1]}, user2={conv[2]}, other_user_id={other_id}")
    
    # Now check if other users exist
    for conv in all_convos:
        other_id = conv[2] if conv[1] == user_id else conv[1]
        cur.execute("SELECT id, username FROM users WHERE id = %s", (other_id,))
        other_user = cur.fetchone()
        if not other_user:
            print(f"[WARNING] Conversation {conv[0]} has other_user_id {other_id} which doesn't exist in users table!")
        else:
            print(f"[DEBUG] Conversation {conv[0]} - other user exists: {other_user[1]} (id: {other_user[0]})")
    
    # Get all conversations for this user, including those with no messages yet
    # Use INNER JOIN to ensure the other user exists
    # IMPORTANT: Make sure we're comparing integers, not strings
    query = """
        SELECT
            c.id AS conversation_id,
            u.id AS other_user_id,
            u.username AS other_username,
            u.display_name AS other_display_name,
            u.avatar_key AS other_avatar,
            (SELECT MAX(timestamp) FROM messages WHERE conversation_id = c.id) AS last_message_time,
            (SELECT content FROM messages 
             WHERE conversation_id = c.id 
             ORDER BY timestamp DESC, id DESC LIMIT 1) AS last_message_content,
            CASE WHEN lc.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_liked
        FROM conversations c
        INNER JOIN users u
          ON u.id = CASE
              WHEN c.user1_id = %s THEN c.user2_id
              ELSE c.user1_id
            END
        LEFT JOIN liked_chats lc ON lc.conversation_id = c.id AND lc.user_id = %s
        WHERE (c.user1_id = %s OR c.user2_id = %s)
        ORDER BY 
            (SELECT MAX(timestamp) FROM messages WHERE conversation_id = c.id) DESC NULLS LAST,
            c.id DESC
    """
    print(f"[DEBUG chat.py] Executing query with user_id={user_id} (type: {type(user_id)})")
    cur.execute(query, (user_id, user_id, user_id, user_id))

    rows = cur.fetchall()
    print(f"[DEBUG chat.py] Found {len(rows)} conversations after JOIN with users")
    
    # Also check raw conversation count
    cur.execute("""
        SELECT COUNT(*) FROM conversations 
        WHERE user1_id = %s OR user2_id = %s
    """, (user_id, user_id))
    raw_count = cur.fetchone()[0]
    print(f"[DEBUG chat.py] Raw conversation count (no JOIN): {raw_count}")
    
    # If there's a mismatch, find which conversations are missing
    if raw_count > len(rows):
        print(f"[DEBUG chat.py] WARNING: {raw_count - len(rows)} conversations are missing after JOIN!")
        cur.execute("""
            SELECT c.id, c.user1_id, c.user2_id,
                   CASE WHEN c.user1_id = %s THEN c.user2_id ELSE c.user1_id END as other_user_id
            FROM conversations c
            WHERE (c.user1_id = %s OR c.user2_id = %s)
            AND NOT EXISTS (
                SELECT 1 FROM users u 
                WHERE u.id = CASE WHEN c.user1_id = %s THEN c.user2_id ELSE c.user1_id END
            )
        """, (user_id, user_id, user_id, user_id))
        missing = cur.fetchall()
        for m in missing:
            print(f"  - Missing conversation {m[0]}: user1={m[1]}, user2={m[2]}, other_user_id={m[3]} (user doesn't exist!)")

    conversations = []

    for row in rows:
        conv_data = {
            "conversation_id": row[0],
            "other_user_id": row[1],
            "other_username": row[2],
            "other_display_name": row[3] or row[2],  # Use display_name, fallback to username
            "other_avatar": row[4],
            "last_message_time": row[5].isoformat() if row[5] else None,
            "last_message_content": row[6],
            "is_liked": row[7] if len(row) > 7 else False,
            "is_group": False  # Explicitly mark as not a group
        }
        conversations.append(conv_data)
        print(f"[DEBUG chat_service] Added conversation {conv_data['conversation_id']} with {conv_data['other_display_name']} (user_id: {conv_data['other_user_id']})")

    cur.close()
    conn.close()
    
    # Debug: Log conversation order with last message times
    print(f"[DEBUG chat_service] Returning {len(conversations)} conversations:")
    for i, conv in enumerate(conversations):
        print(f"  {i+1}. Conversation {conv['conversation_id']} with {conv['other_display_name']} - last_message_time: {conv['last_message_time']}")
    
    # SQL already sorted, but ensure Python list maintains order
    # Sort by last_message_time DESC (most recent first), then by conversation_id DESC
    conversations.sort(key=lambda x: (
        x["last_message_time"] if x["last_message_time"] else "1970-01-01T00:00:00",
        x["conversation_id"]
    ), reverse=True)
    
    print(f"[DEBUG chat_service] After Python sort:")
    for i, conv in enumerate(conversations):
        print(f"  {i+1}. Conversation {conv['conversation_id']} with {conv['other_display_name']} - last_message_time: {conv['last_message_time']}")
    
    # Also get groups the user is a member of
    # IMPORTANT: Only get groups where user is actually a member
    from services.group_service import get_user_joined_groups
    groups = get_user_joined_groups(user_id)
    
    print(f"[DEBUG chat_service] User {user_id} is a member of {len(groups)} groups")
    
    # Add groups to conversations list
    for group in groups:
        conversations.append({
            "conversation_id": None,  # Groups don't have conversation_id
            "group_id": group["group_id"],
            "other_display_name": group["name"],
            "other_avatar": None,  # Groups use icon, not avatar
            "last_message_time": group["last_message_time"],
            "last_message_content": group["last_message_content"],
            "is_liked": group.get("is_liked", False),  # Get liked status from group data
            "is_group": True  # Flag to identify groups
        })
    
    # Re-sort everything by last_message_time
    conversations.sort(key=lambda x: (
        x["last_message_time"] if x["last_message_time"] else "1970-01-01T00:00:00",
        x.get("group_id", 0) or x.get("conversation_id", 0)
    ), reverse=True)
    
    return conversations


def get_messages_for_conversation(conversation_id):
    conn = get_connection()
    cur = conn.cursor()

    # Check if message_color column exists
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='messages' AND column_name='message_color'
    """)
    message_color_column_exists = cur.fetchone() is not None
    
    # CRITICAL: Order by timestamp ASC (oldest first), then by id ASC (earlier messages first)
    # This ensures messages appear in chronological order from top to bottom
    # Use NULLS LAST to handle any NULL timestamps (they should be rare)
    if message_color_column_exists:
    elif message_color_column_exists:
        cur.execute("""
            SELECT 
                m.id, 
                m.sender_id, 
                m.content, 
                m.timestamp,
                u.avatar_key,
                COALESCE(m.message_color, '#6b7280') AS message_color
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE m.conversation_id = %s
            ORDER BY 
                m.timestamp ASC NULLS LAST,
                m.id ASC
        """, (conversation_id,))
    else:
        cur.execute("""
            SELECT 
                m.id, 
                m.sender_id, 
                m.content, 
                m.timestamp,
                u.avatar_key
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE m.conversation_id = %s
            ORDER BY 
                m.timestamp ASC NULLS LAST,
                m.id ASC
        """, (conversation_id,))

    rows = cur.fetchall()
    cur.close()
    conn.close()

    print(f"[DEBUG chat_service] message_color_column_exists: {message_color_column_exists}")
    print(f"[DEBUG chat_service] Fetched {len(rows)} messages")
    if rows and len(rows) > 0:
        print(f"[DEBUG chat_service] First row length: {len(rows[0])}, columns: {rows[0]}")

    # Convert directly to JSON format - SQL already sorted correctly
    messages = []
    for row in rows:
        timestamp = row[3]
        message_data = {
            "id": row[0],
            "sender_id": row[1],
            "content": row[2],
            "created_at": timestamp.isoformat() if timestamp else None,
            "timestamp": timestamp.isoformat() if timestamp else None,
            "sender_avatar": row[4]
        }
        # Add message_color if column exists
        if message_color_column_exists and len(row) > 5:
            message_data["message_color"] = row[5] if row[5] else "#6b7280"
        else:
            message_data["message_color"] = "#6b7280"  # Default grey
        
        
        messages.append(message_data)

    # CRITICAL: Double-check ordering in Python as a safeguard
    # Sort by timestamp (oldest first), then by ID (lower ID = earlier message)
    # This ensures correct order even if database returns out of order
    def sort_key(msg):
        timestamp_str = msg.get('timestamp') or msg.get('created_at') or '1970-01-01T00:00:00'
        try:
            # Handle ISO format timestamps
            if 'Z' in timestamp_str:
                timestamp_str = timestamp_str.replace('Z', '+00:00')
            timestamp = datetime.fromisoformat(timestamp_str)
            timestamp_val = timestamp.timestamp()
        except Exception as e:
            # If timestamp parsing fails, use 0 and rely on ID ordering
            print(f"[DEBUG chat_service] Error parsing timestamp '{timestamp_str}': {e}")
            timestamp_val = 0
        msg_id = msg.get('id', 0)
        return (timestamp_val, msg_id)
    
    messages.sort(key=sort_key)
    
    # Debug: Log first and last message to verify order
    if messages:
        print(f"[DEBUG chat_service] Messages for conversation {conversation_id} (after Python sort):")
        print(f"  First message: id={messages[0]['id']}, sender_id={messages[0]['sender_id']}, content='{messages[0]['content'][:20]}...', timestamp={messages[0]['timestamp']}")
        print(f"  Last message: id={messages[-1]['id']}, sender_id={messages[-1]['sender_id']}, content='{messages[-1]['content'][:20]}...', timestamp={messages[-1]['timestamp']}")
        print(f"  Total messages: {len(messages)}")
        # Log all message IDs and timestamps for debugging
        print(f"  All message IDs in order: {[m['id'] for m in messages]}")
        print(f"  All timestamps in order: {[m.get('timestamp') or m.get('created_at') for m in messages]}")

    return messages
