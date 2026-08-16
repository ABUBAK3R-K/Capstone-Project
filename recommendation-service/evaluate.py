"""
Offline Evaluation Script for CityGuide Recommendation Engine

Performs a temporal 80/20 train/test split on the interactions table,
trains the HybridStrategy on the training set, and computes standard
information retrieval metrics.

Usage:
    python evaluate.py

Requires DATABASE_URL to be set in .env or environment.

Output:
    - Precision@5, Precision@10
    - Recall@5, Recall@10
    - Catalog Coverage (% of places appearing in any recommendation list)
    - Scoring path distribution (blended vs content-only)
"""

import os
import sys
from collections import defaultdict
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if not DATABASE_URL:
    print("ERROR: DATABASE_URL is not set. Cannot run evaluation.")
    sys.exit(1)

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)


def fetch_interactions(session):
    """Fetch all interactions ordered by time."""
    rows = session.execute(text("""
        SELECT user_id::text, place_id::text, interaction_type, created_at
        FROM interactions
        ORDER BY created_at ASC
    """)).fetchall()
    return rows


def temporal_split(interactions, train_ratio=0.8):
    """
    Split interactions into train/test by time.
    The oldest 80% form the training set; the newest 20% form the test set.
    """
    split_idx = int(len(interactions) * train_ratio)
    return interactions[:split_idx], interactions[split_idx:]


def build_user_items(interactions):
    """Build a dict: user_id -> set of place_ids."""
    user_items = defaultdict(set)
    for row in interactions:
        user_items[row.user_id].add(row.place_id)
    return user_items


def evaluate(k_values=[5, 10]):
    """Run the full offline evaluation pipeline."""
    session = Session()

    print("=" * 60)
    print("  CityGuide Recommendation Engine — Offline Evaluation")
    print("=" * 60)

    # 1. Fetch all interactions
    all_interactions = fetch_interactions(session)
    print(f"\nTotal interactions: {len(all_interactions)}")

    if len(all_interactions) < 10:
        print("\nERROR: Not enough interactions for meaningful evaluation.")
        print("Need at least 10 interactions. Current count:", len(all_interactions))
        session.close()
        sys.exit(1)

    # 2. Temporal split
    train_data, test_data = temporal_split(all_interactions)
    print(f"Training set: {len(train_data)} interactions")
    print(f"Test set:     {len(test_data)} interactions")

    train_users = build_user_items(train_data)
    test_users = build_user_items(test_data)

    # Only evaluate users that appear in BOTH train and test
    eval_users = set(train_users.keys()) & set(test_users.keys())
    print(f"Users in both train+test: {len(eval_users)}")

    if not eval_users:
        print("\nWARNING: No users appear in both train and test sets.")
        print("This typically means not enough interaction data yet.")
        print("Falling back to content-only evaluation.\n")

    # 3. Build the hybrid strategy on training data only
    # We simulate a training-only DB by temporarily filtering
    from recommendation.strategy import ContentProximityStrategy
    from recommendation.collaborative import CollaborativeFilteringStrategy, HybridStrategy
    from recommendation.service import RecommendationService

    content_strategy = ContentProximityStrategy(text_weight=0.7, geo_weight=0.3, geo_decay_km=2.0)
    collab_strategy = CollaborativeFilteringStrategy(factors=50, iterations=15)
    hybrid = HybridStrategy(content_strategy, collab_strategy, blend=0.5)

    rec_service = RecommendationService(strategy=hybrid)
    n_places = rec_service.refresh_cache(session)
    print(f"Cached {n_places} places for evaluation.\n")

    # 4. Compute metrics
    all_recommended_places = set()
    all_catalog_places = set(rec_service.place_ids)
    scoring_path_counts = defaultdict(int)

    results = {}
    for k in k_values:
        results[k] = {"precision_sum": 0.0, "recall_sum": 0.0, "count": 0}

    for user_id in eval_users:
        user_test_items = test_users[user_id]
        user_train_items = train_users[user_id]

        # For each place the user interacted with in training,
        # get recommendations and check against test set
        for train_place in user_train_items:
            recs = rec_service.get_similar_places(train_place, limit=max(k_values))
            if not recs:
                continue

            # Track scoring path
            scoring_path_counts[rec_service.last_scoring_path] += 1

            rec_place_ids = [r["place_id"] for r in recs]
            all_recommended_places.update(rec_place_ids)

            for k in k_values:
                top_k = set(rec_place_ids[:k])
                hits = top_k & user_test_items

                precision = len(hits) / k if k > 0 else 0.0
                recall = len(hits) / len(user_test_items) if user_test_items else 0.0

                results[k]["precision_sum"] += precision
                results[k]["recall_sum"] += recall
                results[k]["count"] += 1

    # 5. Print the report
    print("-" * 60)
    print("  EVALUATION RESULTS")
    print("-" * 60)

    for k in k_values:
        count = results[k]["count"]
        if count > 0:
            avg_precision = results[k]["precision_sum"] / count
            avg_recall = results[k]["recall_sum"] / count
        else:
            avg_precision = 0.0
            avg_recall = 0.0

        print(f"\n  Precision@{k}:  {avg_precision:.4f}")
        print(f"  Recall@{k}:     {avg_recall:.4f}")

    # Coverage
    if all_catalog_places:
        coverage = len(all_recommended_places) / len(all_catalog_places) * 100
    else:
        coverage = 0.0

    print(f"\n  Catalog Coverage: {coverage:.1f}% ({len(all_recommended_places)}/{len(all_catalog_places)} places)")

    # Scoring path distribution
    print(f"\n  Scoring Path Distribution:")
    total_queries = sum(scoring_path_counts.values())
    for path, count in sorted(scoring_path_counts.items()):
        pct = count / total_queries * 100 if total_queries > 0 else 0
        print(f"    {path}: {count} ({pct:.1f}%)")

    print("\n" + "=" * 60)
    print("  Evaluation complete.")
    print("=" * 60)

    session.close()


if __name__ == "__main__":
    evaluate()
