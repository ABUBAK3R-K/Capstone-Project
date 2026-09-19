"""Shared Postgres connection for every dashboard page.

Connects with the same DATABASE_URL used by app.py's original report
triage — a direct Postgres role that bypasses RLS entirely (see the note in
supabase/migrations/007 about the recommendation service using the same
trust tier). That is why business verification approve/reject needs no
extra RLS carve-out: this connection already sees and can write every row.
"""

import os

import psycopg2
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")


@st.cache_resource
def get_connection():
    if not DATABASE_URL:
        st.error("DATABASE_URL is not set in .env")
        st.stop()
    return psycopg2.connect(DATABASE_URL)
