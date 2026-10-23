from __future__ import annotations

import importlib.util
import json
import sys
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from ai.ml_core import TriageEngine
from ai.models import ModelRun

REPO_ROOT = settings.BASE_DIR.parent
TRAIN_SCRIPT = REPO_ROOT / "ml" / "train.py"


class Command(BaseCommand):
    help = "Train the ML triage models and record a ModelRun."

    def add_arguments(self, parser):
        parser.add_argument("--reload", action="store_true",
                            help="Reset the in-process model cache after training.")
        parser.add_argument("--notes", default="", help="Free-text note stored on the ModelRun.")

    def handle(self, *args, **options):
        if not TRAIN_SCRIPT.exists():
            raise CommandError(f"Training script not found at {TRAIN_SCRIPT}")

        spec = importlib.util.spec_from_file_location("smartdesk_train", TRAIN_SCRIPT)
        module = importlib.util.module_from_spec(spec)
        sys.modules.setdefault("smartdesk_train", module)
        ml_dir = str(TRAIN_SCRIPT.parent)
        if ml_dir not in sys.path:
            sys.path.insert(0, ml_dir)
        spec.loader.exec_module(module)
        module.main()

        metrics_path = Path(settings.ML_ARTIFACTS_DIR) / "metrics.json"
        if not metrics_path.exists():
            raise CommandError("Training finished but metrics.json is missing.")
        metrics = json.loads(metrics_path.read_text(encoding="utf-8"))

        run, created = ModelRun.objects.update_or_create(
            version=metrics["version"],
            defaults={
                "trained_at": datetime.fromisoformat(metrics["trained_at"]),
                "train_size": metrics.get("train_size", 0),
                "test_size": metrics.get("test_size", 0),
                "metrics": metrics,
                "artifact_path": str(Path(settings.ML_ARTIFACTS_DIR) / "triage_models.joblib"),
                "notes": options["notes"],
            },
        )
        if not created:
            run.trained_at = timezone.now()
            run.save(update_fields=["trained_at"])

        if options["reload"]:
            TriageEngine.reset()

        self.stdout.write(self.style.SUCCESS(
            f"Recorded ModelRun {run.version} "
            f"(category_f1={metrics['category']['macro_f1']}, "
            f"priority_f1={metrics['priority']['macro_f1']})"
        ))
