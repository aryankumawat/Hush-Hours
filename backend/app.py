from flask import Flask, request, jsonify, render_template, session, redirect
import os
from routes.auth_routes import auth_bp
from routes.chat_routes import chat_bp
from routes.user_routes import user_bp
from routes.group_routes import group_bp
from services.auth_service import register_user, login_user, get_user_by_id
from services.chat_service import get_conversations_for_user, get_messages_for_conversation


# Get the directory where this file is located
basedir = os.path.abspath(os.path.dirname(__file__))
app = Flask(__name__, template_folder=os.path.join(basedir, 'templates'), static_folder=os.path.join(basedir, 'static'))
app.secret_key = "dev-secret-change-later"
# Configure session to be more persistent
app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hours
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.register_blueprint(auth_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(user_bp)
app.register_blueprint(group_bp)


@app.route("/")
def home():
    return render_template("register.html")


@app.route("/app")
def app_page():
    # Check if user is logged in
    user_id = session.get("user_id")
    if not user_id:
        # Redirect to login if not authenticated
        print(f"[DEBUG app.py] No user_id in session, redirecting to login")
        return redirect("/")
    
    try:
        print(f"[DEBUG app.py] Rendering app.html for user_id: {user_id}")
        return render_template("app.html")
    except Exception as e:
        print(f"[DEBUG app.py] Error rendering app.html: {e}")
        import traceback
        traceback.print_exc()
        return f"Error loading app: {str(e)}", 500




if __name__ == "__main__":
    app.run(debug=True)
