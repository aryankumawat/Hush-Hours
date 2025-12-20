from flask import Blueprint, jsonify, request, session
from services.chat_service import (
    get_conversations_for_user,
    get_messages_for_conversation
)
from database import get_connection
from datetime import datetime

chat_bp = Blueprint("chat", __name__)

@chat_bp.route("/conversations")
def conversations():
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"error": "Not logged in"}), 401

    print(f"[DEBUG] Fetching conversations for user_id: {user_id} (type: {type(user_id)})")
    data = get_conversations_for_user(user_id)
    print(f"[DEBUG] Returning {len(data)} conversations")
    for conv in data:
        print(f"  - Conversation {conv['conversation_id']} with user: {conv['other_username']} (id: {conv['other_user_id']})")
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
    from datetime import datetime
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

    # Insert message
    cur.execute(
        "INSERT INTO messages (conversation_id, sender_id, content, timestamp) VALUES (%s, %s, %s, %s)",
        (conversation_id, user_id, content, datetime.now())
    )
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

