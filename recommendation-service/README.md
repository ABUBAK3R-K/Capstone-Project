# Recommendation Microservice (/recommendation-service)

FastAPI service behind the app's "Similar places" row. It reads the shared Supabase Postgres
directly, builds a place-to-place similarity matrix, and serves top-N lookups from memory.

## 🧑‍💻 Owner
* **Role:** Recommendation Engineer
* **Responsibilities:** recommendation strategies, the API, offline evaluation.

## 🛠️ Tech Stack
Python 3.10+, FastAPI + Uvicorn, SQLAlchemy + psycopg2, scikit-learn, SciPy, NumPy, `implicit`.

## 🧠 How it recommends

Strategy pattern (`recommendation/`), composed in `main.py`:

| Strategy | File | Idea |
| :-- | :-- | :-- |
| `ContentProximityStrategy` | `strategy.py` | TF-IDF over category + type + description (weight 0.7), fused with geographic proximity `exp(-km / 2)` (weight 0.3). Works with zero history. |
| `CollaborativeFilteringStrategy` | `collaborative.py` | Implicit-feedback ALS over interactions weighted visit 3 / favorite 2 / view 1; TruncatedSVD fallback if `implicit` isn't installed. |
| `HybridStrategy` (served) | `collaborative.py` | Per place: blend content and collaborative 50/50 once it has ≥ 5 interactions (`blended`), else pure content (`content_only`). The path is returned with every response. |

The matrix is built at startup, every `REFRESH_INTERVAL_MINUTES` in the background, and on
`POST /recommendations/refresh`. Builds are swapped in atomically, so requests never see a
half-updated cache.

## 🔌 API

Full reference: [`API.md`](API.md) (Swagger at `/docs`).

| Endpoint | Auth |
| :-- | :-- |
| `GET /recommendations?place_id=…&limit=…` | none |
| `POST /interactions` | `Authorization: Bearer <Supabase access token>` — the user comes from the token |
| `GET /interactions/stats` | none |
| `POST /recommendations/refresh` | `X-Admin-Key: <ADMIN_API_KEY>` |
| `GET /health` | none — pings the database, 503 if unreachable |

The mobile app logs interactions straight to Supabase (RLS-protected); `POST /interactions` remains
for other clients.

## 🚀 Running Locally

```bash
python -m venv .venv
.venv\Scripts\activate                 # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                   # see the comments in it for every variable
uvicorn main:app --reload --port 8000
```

Docker (what Render runs — see `../render.yaml` and `../docs/DEPLOYMENT.md`):
```bash
docker build -t cityguide-recs .
docker run --env-file .env -p 8000:8000 cityguide-recs
```

## 📏 Offline evaluation

```bash
python scripts/generate_synthetic_interactions.py    # pre-launch: fabricate a reproducible history
python evaluate.py --compare                          # content vs collaborative vs hybrid, temporal 80/20 split
python scripts/generate_synthetic_interactions.py --purge
```

Method, results and caveats: [`../docs/EVALUATION.md`](../docs/EVALUATION.md).

## 🧪 Tests

```bash
pip install -r requirements-dev.txt
python -m pytest                        # no database needed; ~92% coverage of the source
```
