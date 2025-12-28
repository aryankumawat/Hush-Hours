from flask import Blueprint, request, jsonify, session
from services.auth_service import register_user, login_user, get_user_by_id

auth_bp = Blueprint("auth", __name__)



@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.json

    username = data.get("username")
    display_name = data.get("display_name")
    age = data.get("age")
    gender = data.get("gender")
    password = data.get("password")
    avatar = data.get("avatar")

    # Debug: Log registration data
    print(f"[DEBUG register] Registration data received:")
    print(f"  username: {username}")
    print(f"  display_name: {display_name}")
    print(f"  age: {age}")
    print(f"  gender: {gender}")
    print(f"  avatar: {avatar}")

    success, result = register_user(
        username,
        display_name,
        age,
        gender,
        password,
        avatar
    )

    if success:
        user = get_user_by_id(result)  # register_user now returns user_id on success
        if user:
            session["user_id"] = user["id"]
            session.permanent = True  # Make session persistent
            print(f"Session set for user_id: {user['id']}")
        return jsonify({ "success": True})
    else:
        return jsonify({ "success": False, "error": result }), 400



@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json

    username = data.get("username")
    password = data.get("password")

    success, user = login_user(username, password)

    if not success:
        return jsonify({ "success": False }), 401
    
    session["user_id"] = user["id"]
    session.permanent = True  # Make session persistent
    print(f"[DEBUG login] Session set for user_id: {user['id']}")
    return jsonify({"success": True})


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True})

