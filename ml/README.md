# SmartDesk ML pipeline

Offline training lives here; online inference lives in `backend/ai/ml_core.py` (joblib artifacts
are loaded by the Django process). Keeping them separate means training dependencies and notebooks
never have to ship inside the API container.

```
ml/
├── generate_corpus.py   # synthetic labeled corpus → data/tickets.jsonl
├── train.py             # train + evaluate + export artifacts + write report
├── data/                # corpus (gitignored — regenerate in seconds)
└── reports/
    └── evaluation.md    # confusion matrices, per-class metrics, limitations
```

## Usage

```bash
# From the repo root, using the backend's environment:
uv run --project backend python ml/generate_corpus.py
uv run --project backend python ml/train.py

# Or via Django (also records a ModelRun for the monitoring page):
cd backend && uv run python manage.py train_models
```

Artifacts written to `backend/ai/artifacts/`:

| File | Contents |
| --- | --- |
| `triage_models.joblib` | category/priority/routing pipelines, retrieval vectorizer + resolved-case index, urgent lexicon, version |
| `metrics.json` | accuracy, macro/weighted precision-recall-F1, confusion matrices, per-class report, class distributions |

## Corpus

1,500 samples, 250 per category (`billing`, `technical`, `refund`, `account`, `shipping`,
`security`), with tier labels and rule-derived priorities. Templates include realistic
placeholders (invoice ids, order numbers, amounts) plus phrasing noise so TF-IDF does not overfit
slot values.

## Evaluation

`train.py` performs a single stratified 80/20 split shared by all three classifiers and writes
`reports/evaluation.md`. Read [`docs/ML_EVALUATION.md`](../docs/ML_EVALUATION.md) for design
rationale, limitations and the retraining workflow.
