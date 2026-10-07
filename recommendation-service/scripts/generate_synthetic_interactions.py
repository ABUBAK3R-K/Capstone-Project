"""
Synthetic interaction generator for offline evaluation.

The collaborative half of the hybrid recommender, and evaluate.py's
precision/recall numbers, need interaction history that a pre-launch
capstone deployment doesn't have. This script fabricates a plausible,
reproducible history against the real `places` catalogue so the full
pipeline (ALS training, hybrid blending, temporal-split evaluation) can be
exercised end to end.

Behaviour model (deliberately simple and documented, so results are
interpretable in the report):
  * Every user has a home point (near a random place) and 1–2 preferred
    categories. Places are sampled with weight
        category_affinity × exp(-distance_km / DISTANCE_DECAY_KM)
    — the same intuition the content strategy encodes.
  * Users belong to one of N "taste groups". Each group shares a small
    favourite set of places, and a fraction of every user's interactions
    come from it. That co-occurrence is the signal collaborative filtering
    is meant to discover and content similarity alone cannot.
  * Types: view 70%, favorite 20%, visit 10% (the 1/2/3 weights in
    recommendation/collaborative.py). Timestamps are spread over the last
    --days days, so evaluate.py's temporal split has a real past/future.

Numbers produced from this data validate the PIPELINE and let strategies be
compared against each other; they are not a measure of real-world accuracy.
Say so wherever they're reported.

Synthetic users are real rows in auth.users/profiles (interactions.user_id
references profiles), marked by an @synthetic.cityguide.invalid email.
Remove everything this script created with --purge.

Usage (from recommendation-service/, with DATABASE_URL in .env):
    python scripts/generate_synthetic_interactions.py --users 80 --per-user 30
    python scripts/generate_synthetic_interactions.py --purge
"""

import argparse
import math
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402

from database import SessionLocal, engine  # noqa: E402

SYNTHETIC_EMAIL_DOMAIN = "synthetic.cityguide.invalid"
DISTANCE_DECAY_KM = 3.0
PREFERRED_CATEGORY_AFFINITY = 6.0
OTHER_CATEGORY_AFFINITY = 1.0
GROUP_FAVOURITES = 12
GROUP_SHARE = 0.45
TYPE_WEIGHTS = {"view": 0.70, "favorite": 0.20, "visit": 0.10}
EARTH_RADIUS_KM = 6371.0
INSERT_BATCH = 500


def haversine_km(lat1, lng1, lat2, lng2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def load_places(db):
    rows = db.execute(text("""
        SELECT id::text AS id, category,
               ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
        FROM places
    """)).fetchall()
    return [{"id": r.id, "category": r.category, "lat": float(r.lat), "lng": float(r.lng)} for r in rows]


def weighted_choice(rng, items, weights):
    total = sum(weights)
    if total <= 0:
        return rng.choice(items)
    pick = rng.random() * total
    for item, weight in zip(items, weights):
        pick -= weight
        if pick <= 0:
            return item
    return items[-1]


def make_users(rng, places, n_users, n_groups):
    categories = sorted({p["category"] for p in places})
    groups = []
    for _ in range(n_groups):
        anchor = rng.choice(places)
        near = sorted(places, key=lambda p: haversine_km(anchor["lat"], anchor["lng"], p["lat"], p["lng"]))
        groups.append([p["id"] for p in near[: GROUP_FAVOURITES * 3]][::3] or [anchor["id"]])

    users = []
    for i in range(n_users):
        home = rng.choice(places)
        users.append({
            "id": str(uuid.UUID(int=rng.getrandbits(128), version=4)),
            "email": f"user{i:04d}@{SYNTHETIC_EMAIL_DOMAIN}",
            "home": (home["lat"], home["lng"]),
            "preferred": set(rng.sample(categories, k=min(len(categories), rng.choice([1, 2])))),
            "group": groups[i % n_groups],
        })
    return users


def generate_interactions(rng, places, users, per_user, days):
    by_id = {p["id"]: p for p in places}
    now = datetime.now(timezone.utc)
    window = timedelta(days=days)
    types, type_weights = zip(*TYPE_WEIGHTS.items())

    rows = []
    for user in users:
        home_lat, home_lng = user["home"]
        weights = [
            (PREFERRED_CATEGORY_AFFINITY if p["category"] in user["preferred"] else OTHER_CATEGORY_AFFINITY)
            * math.exp(-haversine_km(home_lat, home_lng, p["lat"], p["lng"]) / DISTANCE_DECAY_KM)
            for p in places
        ]
        count = max(1, int(rng.gauss(per_user, per_user * 0.3)))
        for _ in range(count):
            if rng.random() < GROUP_SHARE:
                place = by_id[rng.choice(user["group"])]
            else:
                place = weighted_choice(rng, places, weights)
            rows.append({
                "user_id": user["id"],
                "place_id": place["id"],
                "interaction_type": weighted_choice(rng, list(types), list(type_weights)),
                "created_at": now - window * rng.random(),
            })
    rows.sort(key=lambda r: r["created_at"])
    return rows


def insert_all(db, users, rows):
    # Signup provisioning (migration 006's trigger) creates each profiles row.
    db.execute(
        text("""
            INSERT INTO auth.users (id, email, raw_user_meta_data)
            VALUES (CAST(:id AS uuid), :email, CAST(:meta AS jsonb))
        """),
        [{"id": u["id"], "email": u["email"], "meta": '{"name": "Synthetic user", "synthetic": true}'} for u in users],
    )
    for i in range(0, len(rows), INSERT_BATCH):
        db.execute(
            text("""
                INSERT INTO interactions (user_id, place_id, interaction_type, created_at)
                VALUES (CAST(:user_id AS uuid), CAST(:place_id AS uuid), :interaction_type, :created_at)
            """),
            rows[i:i + INSERT_BATCH],
        )
    db.commit()


def purge(db):
    pattern = f"%@{SYNTHETIC_EMAIL_DOMAIN}"
    ids = "SELECT id FROM auth.users WHERE email LIKE :pattern"
    interactions = db.execute(text(f"DELETE FROM interactions WHERE user_id IN ({ids})"), {"pattern": pattern}).rowcount
    db.execute(text(f"DELETE FROM profiles WHERE id IN ({ids})"), {"pattern": pattern})
    users = db.execute(text("DELETE FROM auth.users WHERE email LIKE :pattern"), {"pattern": pattern}).rowcount
    db.commit()
    print(f"Purged {users} synthetic users and {interactions} interactions.")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--users", type=int, default=80)
    parser.add_argument("--per-user", type=int, default=30, help="mean interactions per user")
    parser.add_argument("--groups", type=int, default=8, help="taste groups sharing favourite places")
    parser.add_argument("--days", type=int, default=90, help="history window ending now")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--dry-run", action="store_true", help="generate and summarise, write nothing")
    parser.add_argument("--purge", action="store_true", help="delete everything this script created")
    args = parser.parse_args()

    if engine is None:
        print("ERROR: DATABASE_URL is not set.")
        sys.exit(1)

    db = SessionLocal()
    try:
        if args.purge:
            purge(db)
            return

        existing = db.execute(
            text("SELECT COUNT(*) FROM auth.users WHERE email LIKE :p"), {"p": f"%@{SYNTHETIC_EMAIL_DOMAIN}"}
        ).scalar()
        if existing and not args.dry_run:
            print(f"ERROR: {existing} synthetic users already exist. Run with --purge first to regenerate.")
            sys.exit(1)

        places = load_places(db)
        if len(places) < 2:
            print("ERROR: need at least 2 places — seed the catalogue first (supabase/seed).")
            sys.exit(1)

        rng = random.Random(args.seed)
        users = make_users(rng, places, args.users, max(1, args.groups))
        rows = generate_interactions(rng, places, users, args.per_user, args.days)

        type_counts = {t: sum(1 for r in rows if r["interaction_type"] == t) for t in TYPE_WEIGHTS}
        distinct_places = len({r["place_id"] for r in rows})
        print(
            f"Generated {len(rows)} interactions for {len(users)} users over {args.days} days "
            f"across {distinct_places}/{len(places)} places — {type_counts}"
        )
        if args.dry_run:
            print("Dry run: nothing written.")
            return

        insert_all(db, users, rows)
        print("Written. Next: python evaluate.py --compare, then POST /recommendations/refresh.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
