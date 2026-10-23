from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    DraftPredictView,
    FeedbackViewSet,
    ModelMetricsView,
    ModelRunViewSet,
    ModelStatusView,
    SimilarCasesView,
    TicketReplyView,
    TicketTriageView,
    reload_model,
    ticket_predictions,
)

router = DefaultRouter()
router.register("feedback", FeedbackViewSet, basename="ai-feedback")
router.register("runs", ModelRunViewSet, basename="model-run")

urlpatterns = [
    path("status/", ModelStatusView.as_view(), name="ai-status"),
    path("predict-draft/", DraftPredictView.as_view(), name="ai-predict-draft"),
    path("metrics/", ModelMetricsView.as_view(), name="ai-metrics"),
    path("reload/", reload_model, name="ai-reload"),
    path("tickets/<uuid:ticket_id>/triage/", TicketTriageView.as_view(), name="ai-triage"),
    path("tickets/<uuid:ticket_id>/suggest-reply/", TicketReplyView.as_view(), name="ai-suggest-reply"),
    path("tickets/<uuid:ticket_id>/similar/", SimilarCasesView.as_view(), name="ai-similar"),
    path("tickets/<uuid:ticket_id>/predictions/", ticket_predictions, name="ai-ticket-predictions"),
    path("", include(router.urls)),
]
