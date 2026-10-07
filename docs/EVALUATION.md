# Recommender Evaluation

How the "similar places" engine is evaluated offline, the results of the reference run, and what they
do and don't show.

## Method

`recommendation-service/evaluate.py`, as specified in `PROPOSED_METHODOLOGY.md` §8:

- **Temporal 80/20 split.** Interactions are ordered by `created_at`; the oldest 80% train, the newest
  20% test. Every strategy is fit only on the training window: `build_matrix(..., cutoff_time)` filters
  the interaction queries, so nothing from the test window leaks into training.
- **Protocol.** For each user present in both windows, and each place they interacted with in training,
  take the top-K similar places and compare them with the places that user touched in the test window.
- **Metrics.** Precision@K and Recall@K (K = 5, 10), catalogue coverage, and the share of lookups
  served by the `blended` vs `content_only` path.
- **`--compare`** scores three strategies on the *identical* split, with production hyperparameters:
  content-only, collaborative-only, and the served hybrid. That isolates what each half contributes.

## Data for the reference run

CityGuide has no real usage history before launch, so the reference run uses
`scripts/generate_synthetic_interactions.py` (seed 42) against a synthetic catalogue:

| | |
| :-- | :-- |
| Places | 300 across central Bengaluru, 16 types in 5 categories, category-specific descriptions |
| Users | 80, in 8 "taste groups" |
| Interactions | 2,436 over 90 days — 1,707 views, 465 saves, 264 visits |
| Split | 1,948 train / 488 test; all 80 users appear in both |

The generator's behaviour model is deliberately simple and documented in the script: each user prefers
1–2 categories and places near a home point (the intuition the content strategy encodes), and 45% of
their activity comes from a favourite set shared by their taste group (the co-occurrence signal
collaborative filtering is meant to find).

**Treat these numbers as a validation of the pipeline and a comparison between strategies — not as
real-world accuracy.** The data was generated with a collaborative signal built in, so collaborative
filtering doing well on it is expected. Real accuracy needs real interaction history.

## Results (production hyperparameters)

| Metric | Content-only | Collaborative-only | **Hybrid (served)** |
| :-- | --: | --: | --: |
| Precision@5 | 0.0382 | **0.0505** | 0.0351 |
| Precision@10 | 0.0297 | **0.0449** | 0.0309 |
| Recall@5 | 0.0315 | **0.0421** | 0.0288 |
| Recall@10 | 0.0486 | **0.0758** | 0.0512 |
| Catalogue coverage | 100% | 100% | 100% |

Hybrid scoring paths: 76.9% `blended`, 23.1% `content_only` — most places had passed the 5-interaction
cold-start threshold.

### Hyperparameter sensitivity (collaborative-only, same split)

| ALS factors | Regularization | P@5 | P@10 | R@10 |
| --: | --: | --: | --: | --: |
| 50 *(production)* | 0.01 | 0.0505 | 0.0449 | 0.0758 |
| 16 | 0.1 | **0.0765** | **0.0699** | 0.1189 |
| 8 | 0.1 | 0.0745 | 0.0693 | **0.1225** |

With the 16/0.1 setting, the hybrid scores P@5 0.0544 / P@10 0.0516 / R@10 0.0883.

## Findings

1. **The content baseline is a sound cold-start fallback.** Full coverage and non-trivial precision with
   zero history — the property the hybrid's `content_only` path relies on.
2. **Collaborative filtering adds real signal once history exists** — 1.3× content's precision at the
   production settings, ~2× when tuned.
3. **50 latent factors overfits at this scale.** With 80 users, 16 factors and stronger regularization
   do markedly better. The right value depends on the real user/place counts; re-run the sensitivity
   check on real data before choosing.
4. **The 50/50 blend currently gives most of the collaborative gain back.** Within a blended row, pairs
   that have no collaborative score keep their full content score while blended pairs are averaged
   down, so content similarity still dominates the ranking. Options, in order of effort: lower β
   (more collaborative weight), score missing collaborative pairs as 0 instead of keeping content
   only, or rank-normalise both matrices before blending.

Findings 3 and 4 are recommendations, not changes: the production hyperparameters (50 factors,
β = 0.5) are documented design decisions and were left as specified.

## Bugs the evaluation surfaced (fixed)

Running the full pipeline end to end, rather than each piece alone, exposed two defects that unit tests
of individual pieces had not:

- **ALS matrix orientation.** `implicit` ≥ 0.5 expects a *user × item* matrix; the code passed the
  transpose (the pre-0.5 convention), so "item factors" were really *user* factors. With more places
  than users the hybrid crashed with `IndexError`; with more users than places it silently blended
  user-to-user similarity into place recommendations. Fixed, with a regression test using real
  `implicit` and non-square data.
- **Database driver.** SQLAlchemy 2.1 changed the default driver for `postgresql://` URLs from psycopg2
  to psycopg 3, so a fresh `pip install -r requirements.txt` crashed at startup. The URL now names
  `postgresql+psycopg2://` explicitly.

## Reproducing

```bash
cd recommendation-service
python scripts/generate_synthetic_interactions.py --users 80 --per-user 30 --seed 42
python evaluate.py --compare
python scripts/generate_synthetic_interactions.py --purge     # removes every synthetic user + interaction
```

Against the real seeded catalogue the place set differs, so expect different absolute numbers; the
comparison between strategies is the meaningful part. Once the app has real users, skip the generator
and run `python evaluate.py --compare` directly.
