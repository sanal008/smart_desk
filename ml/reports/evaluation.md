# SmartDesk AI — Model Evaluation Report

- **Model version:** `v20261023-1136`
- **Trained at:** 2026-10-23T11:36:21.435202+00:00
- **Train / test split:** 1200 / 300 (stratified, 80/20)

## Headline metrics

| Task | Accuracy | Macro precision | Macro recall | Macro F1 | Weighted F1 |
| --- | --- | --- | --- | --- | --- |
| Category | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| Priority | 0.867 | 0.847 | 0.916 | 0.873 | 0.866 |
| Routing | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |

## Class distributions

- **category:** account=250, billing=250, refund=250, security=250, shipping=250, technical=250
- **priority:** high=680, low=195, medium=468, urgent=157
- **team:** engineering=250, finance=500, logistics=250, security=250, support=250

## Category — confusion matrix

| actual \ predicted | account | billing | refund | security | shipping | technical |
| --- | --- | --- | --- | --- | --- | --- |
| **account** | 50 | 0 | 0 | 0 | 0 | 0 |
| **billing** | 0 | 50 | 0 | 0 | 0 | 0 |
| **refund** | 0 | 0 | 50 | 0 | 0 | 0 |
| **security** | 0 | 0 | 0 | 50 | 0 | 0 |
| **shipping** | 0 | 0 | 0 | 0 | 50 | 0 |
| **technical** | 0 | 0 | 0 | 0 | 0 | 50 |

### Per-class F1

| Class | Precision | Recall | F1 | Support |
| --- | --- | --- | --- | --- |
| account | 1.000 | 1.000 | 1.000 | 50.0 |
| billing | 1.000 | 1.000 | 1.000 | 50.0 |
| refund | 1.000 | 1.000 | 1.000 | 50.0 |
| security | 1.000 | 1.000 | 1.000 | 50.0 |
| shipping | 1.000 | 1.000 | 1.000 | 50.0 |
| technical | 1.000 | 1.000 | 1.000 | 50.0 |

## Priority — confusion matrix

| actual \ predicted | high | low | medium | urgent |
| --- | --- | --- | --- | --- |
| **high** | 106 | 4 | 12 | 14 |
| **low** | 0 | 42 | 0 | 0 |
| **medium** | 8 | 2 | 76 | 0 |
| **urgent** | 0 | 0 | 0 | 36 |

### Per-class F1

| Class | Precision | Recall | F1 | Support |
| --- | --- | --- | --- | --- |
| high | 0.930 | 0.779 | 0.848 | 136.0 |
| low | 0.875 | 1.000 | 0.933 | 42.0 |
| medium | 0.864 | 0.884 | 0.874 | 86.0 |
| urgent | 0.720 | 1.000 | 0.837 | 36.0 |

## Routing — confusion matrix

| actual \ predicted | engineering | finance | logistics | security | support |
| --- | --- | --- | --- | --- | --- |
| **engineering** | 50 | 0 | 0 | 0 | 0 |
| **finance** | 0 | 100 | 0 | 0 | 0 |
| **logistics** | 0 | 0 | 50 | 0 | 0 |
| **security** | 0 | 0 | 0 | 50 | 0 |
| **support** | 0 | 0 | 0 | 0 | 50 |

### Per-class F1

| Class | Precision | Recall | F1 | Support |
| --- | --- | --- | --- | --- |
| engineering | 1.000 | 1.000 | 1.000 | 50.0 |
| finance | 1.000 | 1.000 | 1.000 | 100.0 |
| logistics | 1.000 | 1.000 | 1.000 | 50.0 |
| security | 1.000 | 1.000 | 1.000 | 50.0 |
| support | 1.000 | 1.000 | 1.000 | 50.0 |

## Known limitations

- Training data is synthetic and template-generated, so metrics are optimistic
  compared to real-world support language.
- Priority labels come from a rule function; the model learns to imitate it,
  so it cannot exceed the rule's quality.
- Sentiment uses the VADER lexicon — accurate on explicit affect, weak on sarcasm.
- Reply drafting is retrieval-based (most similar resolved case), not generative,
  so replies are conservative and always require agent review.

## Retraining

```bash
python ml/generate_corpus.py   # refresh corpus
python ml/train.py             # retrain + rewrite this report
```

Agent feedback captured in the UI (`AgentFeedback`) is the intended source of
real labels for the next training round.
