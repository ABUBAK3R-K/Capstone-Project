import os
import streamlit as st
import pandas as pd
import psycopg2
import folium
from streamlit_folium import st_folium
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

st.set_page_config(page_title="City Guide Admin", layout="wide")


# --- Supabase Auth (authority/admin role check) ---
def check_auth():
    """Authenticate using Supabase email/password and verify user has authority/admin role."""
    if "authenticated" in st.session_state and st.session_state["authenticated"]:
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
            
            # Sign in with Supabase Auth
            auth_response = sb.auth.sign_in_with_password({
                "email": email,
                "password": password,
            })
            user_id = auth_response.user.id
            
            # Check role in profiles table via direct Postgres
            conn_check = psycopg2.connect(DATABASE_URL)
            cur = conn_check.cursor()
            cur.execute("SELECT role FROM profiles WHERE id = %s", (user_id,))
            row = cur.fetchone()
            cur.close()
            conn_check.close()
            
            if row and row[0] in ('authority', 'admin'):
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

if not check_auth():
    st.stop()


# --- Database Connection ---
@st.cache_resource
def init_connection():
    if not DATABASE_URL:
        st.error("DATABASE_URL is not set in .env")
        st.stop()
    return psycopg2.connect(DATABASE_URL)

conn = init_connection()


# --- Data Fetching ---
@st.cache_data(ttl=60)
def fetch_reports():
    query = """
    SELECT 
        id, 
        category, 
        description, 
        status, 
        photo_url, 
        created_at,
        resolved_at,
        ST_Y(location::geometry) as lat, 
        ST_X(location::geometry) as lng 
    FROM problem_reports
    ORDER BY created_at DESC
    """
    return pd.read_sql(query, conn)


# --- Status Update Action with confirmation ---
def advance_status(report_id, current_status):
    new_status = 'in_progress' if current_status == 'reported' else 'fixed'
    try:
        cur = conn.cursor()
        if new_status == 'fixed':
            cur.execute(
                "UPDATE problem_reports SET status = %s, resolved_at = NOW() WHERE id = %s",
                (new_status, report_id)
            )
        else:
            cur.execute(
                "UPDATE problem_reports SET status = %s WHERE id = %s",
                (new_status, report_id)
            )
        conn.commit()
        cur.close()
        fetch_reports.clear()
        st.rerun()
    except Exception as e:
        st.error(f"Failed to update status: {e}")


# --- Header ---
st.title("🏛️ Admin Dashboard — Civic Reports")
if "user_email" in st.session_state:
    st.caption(f"Logged in as **{st.session_state['user_email']}** ({st.session_state.get('user_role', 'unknown')})")
    if st.sidebar.button("Logout"):
        for key in list(st.session_state.keys()):
            del st.session_state[key]
        st.rerun()

# Load data
df = fetch_reports()

if df.empty:
    st.info("No reports found in the database.")
    st.stop()


# --- Summary Metrics ---
st.subheader("📊 Overview")
col1, col2, col3, col4 = st.columns(4)
col1.metric("Total Reports", len(df))
col2.metric("🔴 Reported", len(df[df['status'] == 'reported']))
col3.metric("🟠 In Progress", len(df[df['status'] == 'in_progress']))
col4.metric("🟢 Fixed", len(df[df['status'] == 'fixed']))

# Category breakdown
st.sidebar.header("📈 By Category")
for cat, count in df['category'].value_counts().items():
    st.sidebar.write(f"**{cat}**: {count}")

st.sidebar.markdown("---")


# --- Sidebar Filters ---
st.sidebar.header("🔍 Filters")
status_filter = st.sidebar.multiselect("Status", options=df['status'].unique(), default=df['status'].unique())
category_filter = st.sidebar.multiselect("Category", options=df['category'].unique(), default=df['category'].unique())

filtered_df = df[(df['status'].isin(status_filter)) & (df['category'].isin(category_filter))]


# --- Interactive Map View ---
st.subheader("🗺️ Geographic Overview")
if not filtered_df.empty:
    center_lat = filtered_df['lat'].mean()
    center_lng = filtered_df['lng'].mean()
    m = folium.Map(location=[center_lat, center_lng], zoom_start=13)

    colors = {'reported': 'red', 'in_progress': 'orange', 'fixed': 'green'}
    
    for idx, row in filtered_df.iterrows():
        color = colors.get(row['status'], 'blue')
        popup_html = f"<b>{row['category']}</b><br>Status: {row['status']}<br>{row['description']}"
        if row['photo_url']:
            popup_html += f"<br><a href='{row['photo_url']}' target='_blank'>View Photo</a>"
            
        folium.Marker(
            [row['lat'], row['lng']],
            popup=popup_html,
            icon=folium.Icon(color=color, icon='info-sign')
        ).add_to(m)

    st_folium(m, width=1000, height=500)
else:
    st.warning("No data matches the selected filters.")


# --- Data Table and Actions ---
st.subheader("📋 Actionable Reports")

for idx, row in filtered_df.iterrows():
    with st.expander(f"{row['category']} — {row['status'].replace('_', ' ').title()} ({row['created_at'].strftime('%Y-%m-%d')})"):
        cols = st.columns([2, 1, 1])
        
        with cols[0]:
            st.write(f"**Description:** {row['description'] or 'N/A'}")
            st.write(f"**Coordinates:** {row['lat']:.5f}, {row['lng']:.5f}")
            if pd.notna(row.get('resolved_at')):
                st.write(f"**Resolved at:** {row['resolved_at'].strftime('%Y-%m-%d %H:%M')}")
            if row['photo_url']:
                st.image(row['photo_url'], width=300)
                
        with cols[1]:
            st.write(f"**Current Status:** {row['status']}")
            
        with cols[2]:
            if row['status'] == 'reported':
                # Confirmation via checkbox before status change
                confirm_key = f"confirm_{row['id']}"
                st.checkbox("I confirm this action", key=confirm_key)
                if st.button("▶ Mark In Progress", key=f"btn_{row['id']}"):
                    if st.session_state.get(confirm_key):
                        advance_status(row['id'], row['status'])
                    else:
                        st.warning("Check the confirmation box first.")
            elif row['status'] == 'in_progress':
                confirm_key = f"confirm_{row['id']}"
                st.checkbox("I confirm this action", key=confirm_key)
                if st.button("✅ Mark as Fixed", key=f"btn_{row['id']}"):
                    if st.session_state.get(confirm_key):
                        advance_status(row['id'], row['status'])
                    else:
                        st.warning("Check the confirmation box first.")
            else:
                st.success("✅ Issue Resolved")
