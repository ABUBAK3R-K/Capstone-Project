# Admin Dashboard (/admin-dashboard)

A Streamlit web app for municipal authorities and admins: triage civic reports, and verify and manage
business listings.

## 🧑‍💻 Owner
* **Role:** Admin / Web Developer
* **Responsibilities:** report triage map and status workflow (`reported` → `in_progress` → `fixed`),
  business verification, the authority login gate.

## 🛠️ Tech Stack
* **Framework:** Streamlit (multipage app)
* **Database:** psycopg2 over `DATABASE_URL` (a direct Postgres connection — bypasses RLS, so the
  login gate below is what protects it)
* **Auth:** Supabase Auth email/password, then a server-side check that `profiles.role` is
  `authority` or `admin`
* **Map:** Folium via `streamlit-folium`

## 📂 Contents

| Path | What it is |
| :-- | :-- |
| `app.py` | Civic report triage: status metrics, filters, report map, per-report status actions |
| `pages/1_Verify_Businesses.py` | Review pending businesses and their documents; approve/reject (approval publishes the listing into `places`) |
| `pages/2_Manage_Businesses.py` | Admin override: edit or remove any business listing |
| `lib/auth.py` | Shared login + role gate used by every page |
| `lib/db.py` | Shared Postgres connection |
| `lib/storage.py` | Signed URLs for the private verification-documents bucket |
| `lib/html_safety.py` | Escaping for citizen-written fields rendered as HTML (map popups) |
| `lib/recommendations.py` | Triggers a recommendation-cache rebuild after business changes |
| `tests/` | Unit tests for `lib/` |

## 🚀 Running

```bash
python -m venv .venv && .venv\Scripts\activate     # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
streamlit run app.py                                 # http://localhost:8501
```

`.env`:

| Variable | Required | Purpose |
| :-- | :-- | :-- |
| `DATABASE_URL` | yes | Supabase session-pooler connection string |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | yes | Login |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Inline previews of verification documents |
| `RECOMMENDATIONS_URL`, `ADMIN_API_KEY` | no | Refresh "Similar places" immediately after approving/editing a business |
| `SKIP_AUTH` | no | `true` bypasses login — **local development only** |

## 🔒 Security notes
- Every report field is written by citizens; anything rendered as HTML goes through
  `lib/html_safety.py`.
- Verification documents outside the business's own `{business_id}/` folder are flagged, not shown —
  owners can edit their document list, so this stops one business borrowing another's paperwork.

## 🧪 Tests

```bash
pip install pytest
python -m pytest tests
```
