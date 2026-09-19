import pandas as pd
import streamlit as st

from lib.auth import render_account_sidebar, require_auth
from lib.db import get_connection
from lib.storage import signed_document_url

st.set_page_config(page_title="Verify Businesses — City Guide Admin", layout="wide")

if not require_auth():
    st.stop()

conn = get_connection()


@st.cache_data(ttl=30)
def fetch_pending_businesses():
    query = """
    SELECT
        b.id, b.owner_id, b.name, b.category, b.description, b.address,
        b.contact_phone, b.contact_email, b.verification_documents, b.created_at,
        p.name AS owner_name,
        ST_Y(b.location::geometry) AS lat,
        ST_X(b.location::geometry) AS lng
    FROM businesses b
    LEFT JOIN profiles p ON p.id = b.owner_id
    WHERE b.verification_status = 'pending'
    ORDER BY b.created_at ASC
    """
    return pd.read_sql(query, conn)


def set_status(business_id, status):
    try:
        cur = conn.cursor()
        cur.execute("UPDATE businesses SET verification_status = %s WHERE id = %s", (status, business_id))
        conn.commit()
        cur.close()
        # The places-mirroring trigger (supabase/migrations/008) reacts to
        # this update automatically — approving inserts into `places`,
        # anything else removes it. No separate places write needed here.
        fetch_pending_businesses.clear()
        st.rerun()
    except Exception as e:
        st.error(f"Failed to update verification status: {e}")


st.title("✅ Business Verification")
render_account_sidebar()
st.caption(
    "Manual review only — there is no automated verification logic. Approving makes the "
    "listing appear in customer search/map immediately; rejecting keeps it hidden."
)

df = fetch_pending_businesses()

if df.empty:
    st.info("No businesses awaiting review.")
    st.stop()

st.metric("Pending review", len(df))

for _, row in df.iterrows():
    with st.expander(f"{row['name']} — {row['category']} (submitted {row['created_at'].strftime('%Y-%m-%d')})"):
        cols = st.columns([2, 1])

        with cols[0]:
            st.write(f"**Owner:** {row['owner_name'] or row['owner_id']}")
            st.write(f"**Description:** {row['description'] or 'N/A'}")
            st.write(f"**Address:** {row['address'] or 'N/A'}")
            st.write(f"**Coordinates:** {row['lat']:.5f}, {row['lng']:.5f}")
            st.write(f"**Contact:** {row['contact_phone'] or 'N/A'} · {row['contact_email'] or 'N/A'}")

            st.write("**Verification documents:**")
            documents = row["verification_documents"] or []
            if not documents:
                st.write("_None uploaded yet._")
            for path in documents:
                url = signed_document_url(path)
                if url:
                    st.markdown(f"- [{path}]({url})")
                else:
                    st.write(f"- {path} _(set SUPABASE_SERVICE_ROLE_KEY in .env to preview documents)_")

        with cols[1]:
            confirm_key = f"confirm_{row['id']}"
            st.checkbox("I confirm this decision", key=confirm_key)

            if st.button("✅ Approve", key=f"approve_{row['id']}"):
                if st.session_state.get(confirm_key):
                    set_status(row["id"], "approved")
                else:
                    st.warning("Check the confirmation box first.")

            if st.button("❌ Reject", key=f"reject_{row['id']}"):
                if st.session_state.get(confirm_key):
                    set_status(row["id"], "rejected")
                else:
                    st.warning("Check the confirmation box first.")
