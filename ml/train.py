from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

ML_DIR = Path(__file__).parent
REPO_ROOT = ML_DIR.parent
ARTIFACTS_DIR = REPO_ROOT / "backend" / "ai" / "artifacts"
REPORTS_DIR = ML_DIR / "reports"
DATA_PATH = ML_DIR / "data" / "tickets.jsonl"

MODEL_VERSION = datetime.now(timezone.utc).strftime("v%Y%m%d-%H%M")

URGENT_LEXICON = (
    "urgent asap immediately legal breach outage down locked production ransomware "
    "compromised escalate breaking blocked crash cannot"
).split()


def load_rows() -> list[dict]:
    if not DATA_PATH.exists():
        print("Corpus missing — generating it first...")
        from generate_corpus import main as generate_main

        generate_main()
    rows = []
    with DATA_PATH.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def text_of(row: dict) -> str:
    return f"{row['subject']}\n{row['description']}"


def text_of_with_category(row: dict) -> str:
    return f"cat_{row['category']} tier_{row['tier']} {text_of(row)}"


def make_vectorizer() -> TfidfVectorizer:
    return TfidfVectorizer(
        max_features=12000,
        ngram_range=(1, 2),
        min_df=2,
        sublinear_tf=True,
        strip_accents="unicode",
    )


def make_classifier(seed: int = 42) -> LogisticRegression:
    return LogisticRegression(
        max_iter=2000,
        class_weight="balanced",
        C=4.0,
        random_state=seed,
    )


def build_pipeline() -> Pipeline:
    return Pipeline([("tfidf", make_vectorizer()), ("clf", make_classifier())])


def urgency_features(row: dict) -> str:
    t = text_of(row).lower()
    hits = " ".join(f"kw_{w}" for w in URGENT_LEXICON if w in t)
    return f"tier_{row['tier']} cat_{row['category']} {hits} {text_of(row)}"


def train_one(name, X_train, y_train, X_test, y_test, classes=None) -> dict:
    pipe = build_pipeline()
    pipe.fit(X_train, y_train)
    preds = pipe.predict(X_test)
    labels = sorted(set(y_train) | set(y_test))
    metrics = {
        "accuracy": round(float(accuracy_score(y_test, preds)), 4),
        "macro_precision": round(float(precision_score(y_test, preds, average="macro", zero_division=0)), 4),
        "macro_recall": round(float(recall_score(y_test, preds, average="macro", zero_division=0)), 4),
        "macro_f1": round(float(f1_score(y_test, preds, average="macro", zero_division=0)), 4),
        "weighted_f1": round(float(f1_score(y_test, preds, average="weighted", zero_division=0)), 4),
        "support": int(len(y_test)),
        "labels": labels,
        "confusion_matrix": confusion_matrix(y_test, preds, labels=labels).tolist(),
        "per_class": classification_report(
            y_test, preds, labels=labels, output_dict=True, zero_division=0
        ),
    }
    print(f"[{name}] accuracy={metrics['accuracy']} macro_f1={metrics['macro_f1']}")
    return {"model": pipe, "metrics": metrics}


def main() -> None:
    rows = load_rows()
    print(f"Loaded {len(rows)} samples")

    texts = [text_of(r) for r in rows]
    tier_texts = [urgency_features(r) for r in rows]
    route_texts = [text_of_with_category(r) for r in rows]
    y_cat = [r["category"] for r in rows]
    y_pri = [r["priority"] for r in rows]
    y_team = [r["team"] for r in rows]

    idx = np.arange(len(rows))
    tr, te = train_test_split(idx, test_size=0.2, random_state=42, stratify=y_cat)

    category = train_one(
        "category",
        [texts[i] for i in tr], [y_cat[i] for i in tr],
        [texts[i] for i in te], [y_cat[i] for i in te],
    )
    priority = train_one(
        "priority",
        [tier_texts[i] for i in tr], [y_pri[i] for i in tr],
        [tier_texts[i] for i in te], [y_pri[i] for i in te],
    )
    routing = train_one(
        "routing",
        [route_texts[i] for i in tr], [y_team[i] for i in tr],
        [route_texts[i] for i in te], [y_team[i] for i in te],
    )

    resolved = [r for r in rows if r.get("resolved") and r.get("resolution_note")]
    retrieval = Pipeline([("tfidf", make_vectorizer()), ("clf", make_classifier())])
    retrieval.named_steps["tfidf"].fit([text_of(r) for r in resolved])
    matrix = retrieval.named_steps["tfidf"].transform([text_of(r) for r in resolved])

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    payload = {
        "category": category["model"],
        "priority": priority["model"],
        "routing": routing["model"],
        "retrieval_vectorizer": retrieval.named_steps["tfidf"],
        "resolved_cases": resolved,
        "resolved_matrix": matrix,
        "urgent_lexicon": URGENT_LEXICON,
        "version": MODEL_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    artifact_path = ARTIFACTS_DIR / "triage_models.joblib"
    joblib.dump(payload, artifact_path)

    all_metrics = {
        "version": MODEL_VERSION,
        "trained_at": payload["trained_at"],
        "train_size": int(len(tr)),
        "test_size": int(len(te)),
        "category": category["metrics"],
        "priority": priority["metrics"],
        "routing": routing["metrics"],
        "class_distribution": {
            "category": dict(Counter(y_cat)),
            "priority": dict(Counter(y_pri)),
            "team": dict(Counter(y_team)),
        },
    }
    (ARTIFACTS_DIR / "metrics.json").write_text(
        json.dumps(all_metrics, indent=2), encoding="utf-8"
    )

    write_report(all_metrics)
    print(f"\nArtifacts -> {artifact_path}")
    print(f"Report    -> {REPORTS_DIR / 'evaluation.md'}")


def write_report(m: dict) -> None:
    lines = [
        "# SmartDesk AI — Model Evaluation Report",
        "",
        f"- **Model version:** `{m['version']}`",
        f"- **Trained at:** {m['trained_at']}",
        f"- **Train / test split:** {m['train_size']} / {m['test_size']} (stratified, 80/20)",
        "",
        "## Headline metrics",
        "",
        "| Task | Accuracy | Macro precision | Macro recall | Macro F1 | Weighted F1 |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for task in ("category", "priority", "routing"):
        t = m[task]
        lines.append(
            f"| {task.capitalize()} | {t['accuracy']:.3f} | {t['macro_precision']:.3f} "
            f"| {t['macro_recall']:.3f} | {t['macro_f1']:.3f} | {t['weighted_f1']:.3f} |"
        )
    lines += ["", "## Class distributions", ""]
    for task, dist in m["class_distribution"].items():
        lines.append(f"- **{task}:** {', '.join(f'{k}={v}' for k, v in sorted(dist.items()))}")
    for task in ("category", "priority", "routing"):
        t = m[task]
        labels = t["labels"]
        cm = t["confusion_matrix"]
        lines += [
            "",
            f"## {task.capitalize()} — confusion matrix",
            "",
            "| actual \\ predicted | " + " | ".join(labels) + " |",
            "| --- | " + " | ".join("---" for _ in labels) + " |",
        ]
        for i, label in enumerate(labels):
            lines.append(f"| **{label}** | " + " | ".join(str(v) for v in cm[i]) + " |")
        lines += [
            "",
            "### Per-class F1",
            "",
            "| Class | Precision | Recall | F1 | Support |",
            "| --- | --- | --- | --- | --- |",
        ]
        for label in labels:
            c = t["per_class"][label]
            lines.append(
                f"| {label} | {c['precision']:.3f} | {c['recall']:.3f} | {c['f1-score']:.3f} | {c['support']} |"
            )
    lines += [
        "",
        "## Known limitations",
        "",
        "- Training data is synthetic and template-generated, so metrics are optimistic",
        "  compared to real-world support language.",
        "- Priority labels come from a rule function; the model learns to imitate it,",
        "  so it cannot exceed the rule's quality.",
        "- Sentiment uses the VADER lexicon — accurate on explicit affect, weak on sarcasm.",
        "- Reply drafting is retrieval-based (most similar resolved case), not generative,",
        "  so replies are conservative and always require agent review.",
        "",
        "## Retraining",
        "",
        "```bash",
        "python ml/generate_corpus.py   # refresh corpus",
        "python ml/train.py             # retrain + rewrite this report",
        "```",
        "",
        "Agent feedback captured in the UI (`AgentFeedback`) is the intended source of",
        "real labels for the next training round.",
        "",
    ]
    (REPORTS_DIR / "evaluation.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
