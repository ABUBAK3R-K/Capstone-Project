"""Shared login/role gate for every dashboard page.

Extracted from the original single-file app.py when the business-account
verification and management pages were added (see supabase/migrations/008)
so three pages don't each duplicate the same ~40 lines of Supabase Auth +
role-check boilerplate. Streamlit keeps one `st.session_state` per browser
session across all pages in a multipage app, so signing in on any page
authenticates the rest for the remainder of that session.
"""

import os

import psycopg2
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

# Dev only: set SKIP_AUTH=true in .env to bypass the Supabase login screen.
SKIP_AUTH = os.environ.get("SKIP_AUTH", "false").lower() == "true"


def require_auth() -> bool:
    """Authenticate with Supabase email/password and verify authority/admin role.

    Every dashboard page calls this first and stops rendering if it returns
    False — the role check is the actual authorization boundary (mirrors the
    problem_reports/businesses RLS policies), not just a UI gate.
    """
    if SKIP_AUTH:
        st.session_state["authenticated"] = True
        st.session_state.setdefault("user_email", "dev@localhost")
        st.session_state.setdefault("user_role", "admin (auth bypassed)")
        return True

    if st.session_state.get("authenticated"):
        return True

    st.title("🔐 Admin Dashboard Login")
    st.caption("Only users with 'authority' or 'admin' role can access this dashboard.")

    email = st.text_input("Email", key="login_email")
    password = st.text_input("Password", type="password", key="login_password")

    if st.button("Sign In"):
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            st.error("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env")
            return False

        try:
            from supabase import create_client

            sb = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
            auth_response = sb.auth.sign_in_with_password({"email": email, "password": password})
            user_id = auth_response.user.id

            conn_check = psycopg2.connect(DATABASE_URL)
            cur = conn_check.cursor()
            cur.execute("SELECT role FROM profiles WHERE id = %s", (user_id,))
            row = cur.fetchone()
            cur.close()
            conn_check.close()

            if row and row[0] in ("authority", "admin"):
                st.session_state["authenticated"] = True
                st.session_state["user_email"] = email
                st.session_state["user_role"] = row[0]
                st.rerun()
            else:
                st.error("Access denied. Your account does not have authority or admin privileges.")
                return False
        except Exception as e:
            st.error(f"Login failed: {e}")
            return False

    return False


def render_account_sidebar():
    """Login status + logout, shown identically on every page's sidebar."""
    if "user_email" in st.session_state:
        st.sidebar.caption(
            f"Logged in as **{st.session_state['user_email']}** ({st.session_state.get('user_role', 'unknown')})"
        )
        if st.sidebar.button("Logout"):
            for key in list(st.session_state.keys()):
                del st.session_state[key]
            st.rerun()
