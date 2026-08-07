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
PASSWORD = os.environ.get("DASHBOARD_PASSWORD", "supersecret")

st.set_page_config(page_title="City Guide Admin", layout="wide")

# --- Simple Password Auth ---
def check_password():
    def password_entered():
        if st.session_state["password"] == PASSWORD:
            st.session_state["password_correct"] = True
            del st.session_state["password"]
        else:
            st.session_state["password_correct"] = False

    if "password_correct" not in st.session_state:
        st.text_input("Enter Dashboard Password", type="password", on_change=password_entered, key="password")
        return False
    elif not st.session_state["password_correct"]:
        st.text_input("Enter Dashboard Password", type="password", on_change=password_entered, key="password")
        st.error("Incorrect Password")
        return False
    return True

if not check_password():
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
@st.cache_data(ttl=60) # Cache data for 60 seconds
def fetch_reports():
    # Use ST_Y and ST_X to cleanly extract lat/lng from PostGIS binary format
    query = """
    SELECT 
        id, 
        category, 
        description, 
        status, 
        photo_url, 
        created_at,
        ST_Y(location::geometry) as lat, 
        ST_X(location::geometry) as lng 
    FROM problem_reports
    ORDER BY created_at DESC
    """
    return pd.read_sql(query, conn)

# --- Status Update Action ---
def advance_status(report_id, current_status):
    new_status = 'in_progress' if current_status == 'reported' else 'fixed'
    try:
        cur = conn.cursor()
        cur.execute("UPDATE problem_reports SET status = %s WHERE id = %s", (new_status, report_id))
        conn.commit()
        cur.close()
        # Clear cache to force a re-fetch of the updated data
        fetch_reports.clear()
        st.rerun()
    except Exception as e:
        st.error(f"Failed to update status: {e}")

st.title("Admin Dashboard - Civic Reports")

# Load data
df = fetch_reports()

if df.empty:
    st.info("No reports found in the database.")
    st.stop()

# --- Sidebar Filters ---
st.sidebar.header("Filters")
status_filter = st.sidebar.multiselect("Status", options=df['status'].unique(), default=df['status'].unique())
category_filter = st.sidebar.multiselect("Category", options=df['category'].unique(), default=df['category'].unique())

filtered_df = df[(df['status'].isin(status_filter)) & (df['category'].isin(category_filter))]


# --- Interactive Map View ---
st.subheader("Geographic Overview")
if not filtered_df.empty:
    center_lat = filtered_df['lat'].mean()
    center_lng = filtered_df['lng'].mean()
    m = folium.Map(location=[center_lat, center_lng], zoom_start=13)

    # Color code markers by status
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
st.subheader("Actionable Reports")

for idx, row in filtered_df.iterrows():
    # Use expanders to keep the list tidy
    with st.expander(f"{row['category']} - {row['status'].replace('_', ' ').title()} ({row['created_at'].strftime('%Y-%m-%d')})"):
        cols = st.columns([2, 1, 1])
        
        with cols[0]:
            st.write(f"**Description:** {row['description'] or 'N/A'}")
            st.write(f"**Coordinates:** {row['lat']:.5f}, {row['lng']:.5f}")
            if row['photo_url']:
                st.image(row['photo_url'], width=300)
                
        with cols[1]:
            st.write(f"**Current Status:** {row['status']}")
            
        with cols[2]:
            if row['status'] == 'reported':
                if st.button("Mark as In Progress", key=f"btn_{row['id']}"):
                    advance_status(row['id'], row['status'])
            elif row['status'] == 'in_progress':
                if st.button("Mark as Fixed", key=f"btn_{row['id']}"):
                    advance_status(row['id'], row['status'])
            else:
                st.success("Issue Resolved")
