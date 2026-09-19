import pandas as pd
import streamlit as st

from lib.auth import render_account_sidebar, require_auth
from lib.db import get_connection

st.set_page_config(page_title="Manage Businesses — City Guide Admin", layout="wide")

if not require_auth():
    st.stop()

conn = get_connection()

STATUS_OPTIONS = ["pending", "approved", "rejected"]


@st.cache_data(ttl=30)
def fetch_businesses():
    query = """
    SELECT
        b.id, b.owner_id, b.name, b.category, b.description, b.address,
        b.contact_phone, b.contact_email, b.verification_status, b.created_at,
        p.name AS owner_name
    FROM businesses b
    LEFT JOIN profiles p ON p.id = b.owner_id
    ORDER BY b.created_at DESC
    """
    return pd.read_sql(query, conn)


def save_business(business_id, fields):
    try:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE businesses
            SET name = %s, category = %s, description = %s, address = %s,
                contact_phone = %s, contact_email = %s, verification_status = %s
            WHERE id = %s
            """,
            (
                fields["name"],
                fields["category"],
                fields["description"] or None,
                fields["address"] or None,
                fields["contact_phone"] or None,
                fields["contact_email"] or None,
                fields["verification_status"],
                business_id,
            ),
        )
        conn.commit()
        cur.close()
        fetch_businesses.clear()
        st.rerun()
    except Exception as e:
        st.error(f"Failed to save changes: {e}")


st.title("🏪 Manage Businesses")
render_account_sidebar()
st.caption(
    "Admin override — edits here bypass the owner's own edit access. "
    "\"Remove from listings\" sets status to rejected rather than deleting the row, so booking "
    "history for that business is preserved."
)

df = fetch_businesses()

if df.empty:
    st.info("No businesses in the database yet.")
    st.stop()

st.sidebar.header("🔍 Filters")
status_filter = st.sidebar.multiselect("Status", options=STATUS_OPTIONS, default=STATUS_OPTIONS)
filtered_df = df[df["verification_status"].isin(status_filter)]

st.metric("Businesses shown", len(filtered_df))

for _, row in filtered_df.iterrows():
    with st.expander(f"{row['name']} — {row['verification_status']} ({row['category']})"):
        with st.form(key=f"edit_{row['id']}"):
            cols = st.columns(2)
            with cols[0]:
                name = st.text_input("Name", value=row["name"])
                category = st.text_input("Category", value=row["category"])
                address = st.text_input("Address", value=row["address"] or "")
            with cols[1]:
                contact_phone = st.text_input("Contact phone", value=row["contact_phone"] or "")
                contact_email = st.text_input("Contact email", value=row["contact_email"] or "")
                verification_status = st.selectbox(
                    "Verification status",
                    options=STATUS_OPTIONS,
                    index=STATUS_OPTIONS.index(row["verification_status"]),
                )
            description = st.text_area("Description", value=row["description"] or "")
            st.caption(f"Owner: {row['owner_name'] or row['owner_id']}")

            if st.form_submit_button("Save changes"):
                save_business(
                    row["id"],
                    {
                        "name": name,
                        "category": category,
                        "description": description,
                        "address": address,
                        "contact_phone": contact_phone,
                        "contact_email": contact_email,
                        "verification_status": verification_status,
                    },
                )

        if row["verification_status"] != "rejected":
            remove_key = f"confirm_remove_{row['id']}"
            st.checkbox("I confirm removing this listing from public search/map", key=remove_key)
            if st.button("🗑️ Remove from listings", key=f"remove_{row['id']}"):
                if st.session_state.get(remove_key):
                    save_business(
                        row["id"],
                        {
                            "name": row["name"],
                            "category": row["category"],
                            "description": row["description"],
                            "address": row["address"],
                            "contact_phone": row["contact_phone"],
                            "contact_email": row["contact_email"],
                            "verification_status": "rejected",
                        },
                    )
                else:
                    st.warning("Check the confirmation box first.")
