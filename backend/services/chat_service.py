from database import get_connection

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

    print(f"[DEBUG chat.py] Querying conversations for user_id: {user_id}")
    
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
    
    cur.execute("""
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
        JOIN users u
          ON u.id = CASE
              WHEN c.user1_id = %s THEN c.user2_id
              ELSE c.user1_id
            END
        LEFT JOIN liked_chats lc ON lc.conversation_id = c.id AND lc.user_id = %s
        WHERE c.user1_id = %s OR c.user2_id = %s
        ORDER BY 
            (SELECT MAX(timestamp) FROM messages WHERE conversation_id = c.id) DESC NULLS LAST,
            c.id DESC
    """, (user_id, user_id, user_id, user_id))

    rows = cur.fetchall()
    print(f"[DEBUG chat.py] Found {len(rows)} conversations in database")
    
    # Also check raw conversation count
    cur.execute("""
        SELECT COUNT(*) FROM conversations 
        WHERE user1_id = %s OR user2_id = %s
    """, (user_id, user_id))
    raw_count = cur.fetchone()[0]
    print(f"[DEBUG chat.py] Raw conversation count (no JOIN): {raw_count}")

    conversations = []

    for row in rows:
        conversations.append({
            "conversation_id": row[0],
            "other_user_id": row[1],
            "other_username": row[2],
            "other_display_name": row[3] or row[2],  # Use display_name, fallback to username
            "other_avatar": row[4],
            "last_message_time": row[5].isoformat() if row[5] else None,
            "last_message_content": row[6],
            "is_liked": row[7] if len(row) > 7 else False
        })

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
    
    return conversations


def get_messages_for_conversation(conversation_id):
    conn = get_connection()
    cur = conn.cursor()

    # CRITICAL: Order by timestamp ASC (oldest first), then by id ASC (earlier messages first)
    # This ensures messages appear in chronological order from top to bottom
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
            COALESCE(m.timestamp, '1970-01-01'::timestamp) ASC,
            m.id ASC
    """, (conversation_id,))

    rows = cur.fetchall()
    cur.close()
    conn.close()

    # Convert directly to JSON format - SQL already sorted correctly
    messages = []
    for row in rows:
        timestamp = row[3]
        messages.append({
            "id": row[0],
            "sender_id": row[1],
            "content": row[2],
            "created_at": timestamp.isoformat() if timestamp else None,
            "timestamp": timestamp.isoformat() if timestamp else None,
            "sender_avatar": row[4]
        })

    # Debug: Log first and last message to verify order
    if messages:
        print(f"[DEBUG chat_service] Messages for conversation {conversation_id}:")
        print(f"  First message: id={messages[0]['id']}, content='{messages[0]['content'][:20]}...', timestamp={messages[0]['timestamp']}")
        print(f"  Last message: id={messages[-1]['id']}, content='{messages[-1]['content'][:20]}...', timestamp={messages[-1]['timestamp']}")
        print(f"  Total messages: {len(messages)}")

    return messages
