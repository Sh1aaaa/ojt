import os
import requests
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "change-this-before-deploying")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=os.environ.get("VERCEL") == "1",
    SESSION_COOKIE_SAMESITE="Lax",
)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

def configured():
    return bool(SUPABASE_URL and SUPABASE_ANON_KEY)

def supabase_headers(token=None):
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    else:
        headers["Authorization"] = f"Bearer {SUPABASE_ANON_KEY}"
    return headers

def api_error(response):
    try:
        data = response.json()
        return data.get("msg") or data.get("message") or data.get("error_description") or data.get("error") or "Request failed."
    except Exception:
        return "Request failed. Please try again."

def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("access_token"):
            return jsonify({"error": "Please sign in again."}), 401
        return fn(*args, **kwargs)
    return wrapper

@app.get("/")
def index():
    if not configured():
        return render_template("setup.html")
    return render_template("index.html", employee=session.get("employee"))

@app.post("/api/login")
def login():
    if not configured():
        return jsonify({"error": "Supabase environment variables are not configured."}), 500
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip()
    password = body.get("password") or ""
    if not email or not password:
        return jsonify({"error": "Enter your email and password."}), 400
    try:
        r = requests.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers=supabase_headers(),
            json={"email": email, "password": password},
            timeout=15,
        )
        if not r.ok:
            return jsonify({"error": api_error(r)}), 401
        data = r.json()
        user = data.get("user", {})
        session["access_token"] = data["access_token"]
        session["refresh_token"] = data.get("refresh_token")
        session["employee"] = {
            "id": user.get("id"),
            "email": user.get("email"),
            "name": (user.get("user_metadata") or {}).get("full_name") or user.get("email"),
        }
        return jsonify({"employee": session["employee"]})
    except requests.RequestException:
        return jsonify({"error": "Could not connect to Supabase."}), 503

@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})

@app.get("/api/me")
@login_required
def me():
    return jsonify({"employee": session.get("employee")})

@app.post("/api/clock-in")
@login_required
def clock_in():
    try:
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/clock_in",
            headers=supabase_headers(session["access_token"]),
            json={},
            timeout=15,
        )
        if not r.ok:
            return jsonify({"error": api_error(r)}), 400
        return jsonify({"message": "Time in recorded.", "record": r.json()})
    except requests.RequestException:
        return jsonify({"error": "Could not connect to Supabase."}), 503

@app.post("/api/clock-out")
@login_required
def clock_out():
    try:
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/clock_out",
            headers=supabase_headers(session["access_token"]),
            json={},
            timeout=15,
        )
        if not r.ok:
            return jsonify({"error": api_error(r)}), 400
        return jsonify({"message": "Time out recorded.", "record": r.json()})
    except requests.RequestException:
        return jsonify({"error": "Could not connect to Supabase."}), 503

@app.get("/api/attendance")
@login_required
def attendance():
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/attendance",
            headers=supabase_headers(session["access_token"]),
            params={
                "select": "id,work_date,time_in,time_out",
                "order": "work_date.desc",
                "limit": "30",
            },
            timeout=15,
        )
        if not r.ok:
            return jsonify({"error": api_error(r)}), 400
        return jsonify({"records": r.json()})
    except requests.RequestException:
        return jsonify({"error": "Could not connect to Supabase."}), 503

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
