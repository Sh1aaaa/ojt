
import os
import requests
from functools import wraps
from flask import Flask, render_template, request, jsonify, session

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "CHANGE_THIS_SECRET")

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
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token or SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
    }


def api_error(response):
    try:
        data = response.json()
        return (
            data.get("msg")
            or data.get("message")
            or data.get("error_description")
            or data.get("error")
            or "Request failed."
        )
    except Exception:
        return "Request failed. Please try again."


def employee_from_user(user):
    metadata = user.get("user_metadata") or {}

    return {
        "id": user.get("id"),
        "email": user.get("email"),
        "name": metadata.get("full_name") or user.get("email"),
        "employee_id": metadata.get("employee_id") or "",
    }


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

    return render_template("index.html")


# PUBLIC EMPLOYEE REGISTRATION
@app.post("/api/register")
def register():

    if not configured():
        return jsonify({
            "error": "Supabase environment variables are not configured."
        }), 500

    body = request.get_json(silent=True) or {}

    full_name = (body.get("full_name") or "").strip()
    employee_id = (body.get("employee_id") or "").strip()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    confirm_password = body.get("confirm_password") or ""

    if not all([
        full_name,
        employee_id,
        email,
        password,
        confirm_password
    ]):
        return jsonify({
            "error": "Please complete all registration fields."
        }), 400

    if password != confirm_password:
        return jsonify({
            "error": "Passwords do not match."
        }), 400

    if len(password) < 8:
        return jsonify({
            "error": "Password must be at least 8 characters."
        }), 400

    try:
        response = requests.post(
            f"{SUPABASE_URL}/auth/v1/signup",
            headers=supabase_headers(),
            json={
                "email": email,
                "password": password,
                "data": {
                    "full_name": full_name,
                    "employee_id": employee_id
                }
            },
            timeout=20
        )

        if not response.ok:
            return jsonify({
                "error": api_error(response)
            }), 400

        data = response.json() or {}
        user = data.get("user") or {}

        access_token = data.get("access_token")

        if access_token:
            session["access_token"] = access_token
            session["refresh_token"] = data.get("refresh_token")
            session["employee"] = employee_from_user(user)

            return jsonify({
                "message": "Account created successfully.",
                "confirmed": True,
                "employee": session["employee"]
            }), 201

        return jsonify({
            "message": (
                "Registration submitted. Check your email "
                "for the confirmation link before signing in."
            ),
            "confirmed": False
        }), 201

    except requests.RequestException:
        return jsonify({
            "error": "Could not connect to Supabase."
        }), 503


# LOGIN
@app.post("/api/login")
def login():

    if not configured():
        return jsonify({
            "error": "Supabase environment variables are not configured."
        }), 500

    body = request.get_json(silent=True) or {}

    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        return jsonify({
            "error": "Enter your email and password."
        }), 400

    try:
        response = requests.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers=supabase_headers(),
            json={
                "email": email,
                "password": password
            },
            timeout=15
        )

        if not response.ok:
            return jsonify({
                "error": api_error(response)
            }), 401

        data = response.json()
        user = data.get("user", {})

        session["access_token"] = data["access_token"]
        session["refresh_token"] = data.get("refresh_token")
        session["employee"] = employee_from_user(user)

        return jsonify({
            "employee": session["employee"]
        })

    except requests.RequestException:
        return jsonify({
            "error": "Could not connect to Supabase."
        }), 503


# LOGOUT
@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


# CURRENT EMPLOYEE
@app.get("/api/me")
@login_required
def me():
    return jsonify({
        "employee": session.get("employee")
    })


# TIME IN
@app.post("/api/clock-in")
@login_required
def clock_in():

    try:
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/clock_in",
            headers=supabase_headers(session["access_token"]),
            json={},
            timeout=15
        )

        if not response.ok:
            return jsonify({
                "error": api_error(response)
            }), 400

        return jsonify({
            "message": "Time in recorded.",
            "record": response.json()
        })

    except requests.RequestException:
        return jsonify({
            "error": "Could not connect to Supabase."
        }), 503


# TIME OUT
@app.post("/api/clock-out")
@login_required
def clock_out():

    try:
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/clock_out",
            headers=supabase_headers(session["access_token"]),
            json={},
            timeout=15
        )

        if not response.ok:
            return jsonify({
                "error": api_error(response)
            }), 400

        return jsonify({
            "message": "Time out recorded.",
            "record": response.json()
        })

    except requests.RequestException:
        return jsonify({
            "error": "Could not connect to Supabase."
        }), 503


# ATTENDANCE HISTORY
@app.get("/api/attendance")
@login_required
def attendance():

    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/attendance",
            headers=supabase_headers(session["access_token"]),
            params={
                "select": "id,work_date,time_in,time_out",
                "order": "work_date.desc",
                "limit": "30"
            },
            timeout=15
        )

        if not response.ok:
            return jsonify({
                "error": api_error(response)
            }), 400

        return jsonify({
            "records": response.json()
        })

    except requests.RequestException:
        return jsonify({
            "error": "Could not connect to Supabase."
        }), 503


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=os.environ.get("FLASK_DEBUG") == "1"
    )
