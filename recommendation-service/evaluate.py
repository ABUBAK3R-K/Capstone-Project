"""
Offline Evaluation Script for CityGuide Recommendation Engine

Performs a temporal 80/20 train/test split on the interactions table,
trains the HybridStrategy on the training set, and computes standard
information retrieval metrics.

Usage:
    python evaluate.py              # the production hybrid strategy
    python evaluate.py --compare    # content-only vs collaborative-only vs hybrid, same split

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


def Session():
    """A session on DATABASE_URL. Built on first use rather than at import, so
    the metric helpers below can be imported (and unit-tested) without a DB."""
    from database import normalize_database_url

    database_url = normalize_database_url(os.getenv("DATABASE_URL", ""))

    if not database_url:
        print("ERROR: DATABASE_URL is not set. Cannot run evaluation.")
        sys.exit(1)

    return sessionmaker(bind=create_engine(database_url))()


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


def build_strategy(name):
    """The production hybrid, or one of its two halves on its own — same
    hyperparameters as main.py, so the comparison isolates each component."""
    from recommendation.strategy import ContentProximityStrategy
    from recommendation.collaborative import CollaborativeFilteringStrategy, HybridStrategy

    content_strategy = ContentProximityStrategy(text_weight=0.7, geo_weight=0.3, geo_decay_km=2.0)
    if name == "content":
        return content_strategy
    collab_strategy = CollaborativeFilteringStrategy(factors=50, iterations=15)
    if name == "collaborative":
        return collab_strategy
    return HybridStrategy(content_strategy, collab_strategy, blend=0.5)


def score_strategy(session, strategy, cutoff_time, train_users, test_users, eval_users, k_values):
    """Fit `strategy` on the training window and score it against the test window."""
    from recommendation.service import RecommendationService

    rec_service = RecommendationService(strategy=strategy)
    n_places = rec_service.refresh_cache(session, cutoff_time=cutoff_time)

    all_recommended_places = set()
    all_catalog_places = set(rec_service.cached_place_ids)
    scoring_path_counts = defaultdict(int)
    sums = {k: {"precision": 0.0, "recall": 0.0, "count": 0} for k in k_values}

    for user_id in eval_users:
        user_test_items = test_users[user_id]

        # For each place the user interacted with in training,
        # get recommendations and check against test set
        for train_place in train_users[user_id]:
            result = rec_service.get_similar_places(train_place, limit=max(k_values))
            recs = result.recommendations
            if not recs:
                continue

            scoring_path_counts[result.scoring_path] += 1
            rec_place_ids = [r["place_id"] for r in recs]
            all_recommended_places.update(rec_place_ids)

            for k in k_values:
                hits = set(rec_place_ids[:k]) & user_test_items
                sums[k]["precision"] += len(hits) / k
                sums[k]["recall"] += len(hits) / len(user_test_items) if user_test_items else 0.0
                sums[k]["count"] += 1

    metrics = {"places": n_places, "paths": dict(scoring_path_counts)}
    for k in k_values:
        count = sums[k]["count"]
        metrics[f"precision@{k}"] = sums[k]["precision"] / count if count else 0.0
        metrics[f"recall@{k}"] = sums[k]["recall"] / count if count else 0.0
    metrics["coverage"] = (
        len(all_recommended_places) / len(all_catalog_places) * 100 if all_catalog_places else 0.0
    )
    metrics["coverage_counts"] = (len(all_recommended_places), len(all_catalog_places))
    return metrics


def print_metrics(name, metrics, k_values):
    print("-" * 60)
    print(f"  EVALUATION RESULTS — {name}")
    print("-" * 60)
    for k in k_values:
        print(f"\n  Precision@{k}:  {metrics[f'precision@{k}']:.4f}")
        print(f"  Recall@{k}:     {metrics[f'recall@{k}']:.4f}")

    recommended, catalog = metrics["coverage_counts"]
    print(f"\n  Catalog Coverage: {metrics['coverage']:.1f}% ({recommended}/{catalog} places)")

    print("\n  Scoring Path Distribution:")
    total_queries = sum(metrics["paths"].values())
    for path, count in sorted(metrics["paths"].items()):
        pct = count / total_queries * 100 if total_queries > 0 else 0
        print(f"    {path}: {count} ({pct:.1f}%)")
    print()


def print_comparison(all_metrics, k_values):
    names = list(all_metrics)
    rows = [f"precision@{k}" for k in k_values] + [f"recall@{k}" for k in k_values] + ["coverage"]
    print("-" * 60)
    print("  COMPARISON (same temporal split)")
    print("-" * 60)
    print("  " + "metric".ljust(16) + "".join(n.rjust(14) for n in names))
    for row in rows:
        fmt = (lambda v: f"{v:.1f}%") if row == "coverage" else (lambda v: f"{v:.4f}")
        print("  " + row.ljust(16) + "".join(fmt(all_metrics[n][row]).rjust(14) for n in names))
    print()


def evaluate(k_values=(5, 10), strategies=("hybrid",)):
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
        print("For a pre-launch evaluation: python scripts/generate_synthetic_interactions.py")
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

    # 3. Fit on training data only.
    # `cutoff_time` is the created_at of the last training-set interaction;
    # CollaborativeFilteringStrategy and HybridStrategy both filter their SQL
    # queries by it (recommendation/collaborative.py), so the model is fit
    # only on interactions the "past" would actually have had — none of the
    # test window leaks into training.
    cutoff_time = train_data[-1].created_at
    print(f"Training cutoff: {cutoff_time} (interactions after this are held out as test data)\n")

    # 4. Score each requested strategy on the identical split
    all_metrics = {}
    for name in strategies:
        metrics = score_strategy(
            session, build_strategy(name), cutoff_time, train_users, test_users, eval_users, k_values
        )
        print(f"Cached {metrics['places']} places for '{name}'.")
        all_metrics[name] = metrics
        print_metrics(name, metrics, k_values)

    if len(all_metrics) > 1:
        print_comparison(all_metrics, k_values)

    print("=" * 60)
    print("  Evaluation complete.")
    print("=" * 60)

    session.close()
    return all_metrics


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Offline evaluation of the recommender.")
    parser.add_argument(
        "--compare",
        action="store_true",
        help="score content-only, collaborative-only and the hybrid side by side on the same split",
    )
    args = parser.parse_args()
    evaluate(strategies=("content", "collaborative", "hybrid") if args.compare else ("hybrid",))
