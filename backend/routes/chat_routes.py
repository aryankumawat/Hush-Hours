from flask import Blueprint, jsonify, request, session
from services.chat_service import (
    get_conversations_for_user,
    get_messages_for_conversation
)
from database import get_connection

chat_bp = Blueprint("chat", __name__)

@chat_bp.route("/conversations")
def conversations():
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"error": "Not logged in"}), 401

    print(f"[DEBUG chat_routes] Fetching conversations for user_id: {user_id} (type: {type(user_id)})")
    data = get_conversations_for_user(user_id)
    print(f"[DEBUG chat_routes] Returning {len(data)} conversations to frontend")
    for i, conv in enumerate(data):
        if conv.get('is_group'):
            print(f"  {i+1}. Group {conv.get('group_id')}: {conv.get('other_display_name', 'Unknown')}")
        else:
            print(f"  {i+1}. Conversation {conv.get('conversation_id')} with user: {conv.get('other_username', conv.get('other_display_name', 'Unknown'))} (id: {conv.get('other_user_id')}), last_msg: {conv.get('last_message_time')}")
    return jsonify(data)



@chat_bp.route("/conversations/<int:conversation_id>/messages")
def conversation_messages(conversation_id):
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"error": "Not logged in"}), 401

    # Verify user is part of this conversation
    from database import get_connection
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM conversations WHERE id = %s AND (user1_id = %s OR user2_id = %s)",
        (conversation_id, user_id, user_id)
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"error": "Conversation not found or access denied"}), 403
    
    cur.close()
    conn.close()

    messages = get_messages_for_conversation(conversation_id)
    return jsonify(messages)



@chat_bp.route("/messages", methods=["POST"])
def send_message():
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"error": "Not logged in"}), 401

    data = request.json
    conversation_id = data.get("conversation_id")
    content = data.get("content")

    if not conversation_id or not content:
        return jsonify({"error": "Missing conversation_id or content"}), 400

    # Verify user is part of this conversation
    from database import get_connection
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute(
        "SELECT id FROM conversations WHERE id = %s AND (user1_id = %s OR user2_id = %s)",
        (conversation_id, user_id, user_id)
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"error": "Conversation not found or access denied"}), 403

    # Get user's message color
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='users' AND column_name='message_color'
    """)
    color_column_exists = cur.fetchone() is not None
    
    message_color = "#6b7280"  # Default grey
    if color_column_exists:
        cur.execute("SELECT message_color FROM users WHERE id = %s", (user_id,))
        result = cur.fetchone()
        if result and result[0]:
            message_color = result[0]
    
    # Check if message_color column exists in messages table
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='messages' AND column_name='message_color'
    """)
    message_color_column_exists = cur.fetchone() is not None
    
    # Insert message with color if column exists
    # Use PostgreSQL's NOW() for consistent timestamp precision and timezone handling
    if message_color_column_exists:
        cur.execute(
            "INSERT INTO messages (conversation_id, sender_id, content, timestamp, message_color) VALUES (%s, %s, %s, NOW(), %s)",
            (conversation_id, user_id, content, message_color)
        )
        print(f"[DEBUG chat_routes] Saved message with color: {message_color} (user_id: {user_id})")
        print(f"[DEBUG chat_routes] message_color_column_exists: {message_color_column_exists}")
    else:
        # Try to create the column if it doesn't exist
        try:
            cur.execute("ALTER TABLE messages ADD COLUMN message_color VARCHAR(7) DEFAULT '#6b7280'")
            conn.commit()
            print(f"[DEBUG chat_routes] Created message_color column, now inserting with color: {message_color}")
            cur.execute(
                "INSERT INTO messages (conversation_id, sender_id, content, timestamp, message_color) VALUES (%s, %s, %s, NOW(), %s)",
                (conversation_id, user_id, content, message_color)
            )
        except Exception as e:
            print(f"[DEBUG chat_routes] Could not create column or insert with color: {e}")
            cur.execute(
                "INSERT INTO messages (conversation_id, sender_id, content, timestamp) VALUES (%s, %s, %s, NOW())",
                (conversation_id, user_id, content)
            )
            print(f"[DEBUG chat_routes] message_color column doesn't exist, message saved without color")
    
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"success": True})


@chat_bp.route("/conversations/<int:conversation_id>/like", methods=["POST"])
def like_conversation(conversation_id):
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"error": "Not logged in"}), 401

    # Verify user is part of this conversation
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute(
        "SELECT id FROM conversations WHERE id = %s AND (user1_id = %s OR user2_id = %s)",
        (conversation_id, user_id, user_id)
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"error": "Conversation not found or access denied"}), 403

    # Check if already liked
    cur.execute(
        "SELECT id FROM liked_chats WHERE user_id = %s AND conversation_id = %s",
        (user_id, conversation_id)
    )
    if cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"success": True, "is_liked": True})

    # Add to liked chats
    cur.execute(
        "INSERT INTO liked_chats (user_id, conversation_id) VALUES (%s, %s)",
        (user_id, conversation_id)
    )
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"success": True, "is_liked": True})


@chat_bp.route("/conversations/<int:conversation_id>/like", methods=["DELETE"])
def unlike_conversation(conversation_id):
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"error": "Not logged in"}), 401

    # Verify user is part of this conversation
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute(
        "SELECT id FROM conversations WHERE id = %s AND (user1_id = %s OR user2_id = %s)",
        (conversation_id, user_id, user_id)
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"error": "Conversation not found or access denied"}), 403

    # Remove from liked chats
    cur.execute(
        "DELETE FROM liked_chats WHERE user_id = %s AND conversation_id = %s",
        (user_id, conversation_id)
    )
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"success": True, "is_liked": False})

