from django.http import Http404
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAgentOrAbove
from tickets.models import Ticket

from . import services
from .ml_core import ModelNotTrainedError, TriageEngine
from .models import AgentFeedback, MLPrediction, ModelRun
from .serializers import (
    AgentFeedbackSerializer,
    DraftPredictSerializer,
    FeedbackRequestSerializer,
    MLPredictionSerializer,
    ModelRunSerializer,
    SuggestReplySerializer,
)


class ModelStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        engine = TriageEngine.instance()
        return Response(
            {
                "is_ready": engine.is_ready,
                "version": engine.version if engine.is_ready else None,
                "artifact": str(engine.artifact_file),
            }
        )


class DraftPredictView(APIView):
    permission_classes = [IsAgentOrAbove]

    def post(self, request):
        serializer = DraftPredictSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            return Response(services.predict_draft(**serializer.validated_data))
        except ModelNotTrainedError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class TicketTriageView(APIView):
    permission_classes = [IsAgentOrAbove]

    def post(self, request, ticket_id):
        try:
            ticket = Ticket.objects.get(pk=ticket_id)
        except Ticket.DoesNotExist:
            raise Http404 from None
        force = bool(request.data.get("force", True))
        result = services.triage_ticket(ticket, actor=request.user, force=force)
        if result.get("status") == "error":
            return Response(result, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(result)


class TicketReplyView(APIView):
    permission_classes = [IsAgentOrAbove]

    def post(self, request, ticket_id):
        try:
            ticket = Ticket.objects.get(pk=ticket_id)
        except Ticket.DoesNotExist:
            raise Http404 from None
        serializer = SuggestReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = services.suggest_reply(ticket, agent_name=request.user.get_full_name() or request.user.username)
        except ModelNotTrainedError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if serializer.validated_data.get("save_as_draft"):
            comment = ticket.comments.create(
                author=request.user, body=result["label"], is_ai_draft=True
            )
            return Response({"draft": result, "saved_comment_id": comment.id})
        return Response({"draft": result})

    def get(self, request, ticket_id):
        prediction = MLPrediction.objects.filter(
            ticket_id=ticket_id, task="reply"
        ).order_by("-created_at").first()
        if not prediction:
            return Response({"detail": "No draft yet."}, status=404)
        return Response(MLPredictionSerializer(prediction).data)


class SimilarCasesView(APIView):
    permission_classes = [IsAgentOrAbove]

    def get(self, request, ticket_id):
        try:
            ticket = Ticket.objects.get(pk=ticket_id)
        except Ticket.DoesNotExist:
            raise Http404 from None
        engine = TriageEngine.instance()
        try:
            cases = engine.similar_resolved(ticket.text_blob, k=int(request.query_params.get("k", 3)))
        except ModelNotTrainedError as exc:
            return Response({"detail": str(exc)}, status=503)
        return Response({"cases": cases})


class FeedbackViewSet(viewsets.ModelViewSet):
    serializer_class = AgentFeedbackSerializer
    filterset_fields = ["prediction__task", "accepted", "reviewer"]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return AgentFeedback.objects.select_related("prediction__ticket", "reviewer").order_by(
            "-created_at"
        )

    def get_permissions(self):
        return [IsAgentOrAbove()]

    def create(self, request, *args, **kwargs):
        serializer = FeedbackRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            feedback = services.record_feedback(
                serializer.validated_data["prediction_id"],
                request.user,
                accepted=serializer.validated_data["accepted"],
                corrected_label=serializer.validated_data.get("corrected_label", ""),
                note=serializer.validated_data.get("note", ""),
            )
        except MLPrediction.DoesNotExist:
            return Response({"detail": "Prediction not found."}, status=404)
        return Response(AgentFeedbackSerializer(feedback).data, status=201)


class ModelMetricsView(APIView):
    permission_classes = [IsAgentOrAbove]

    def get(self, request):
        return Response(services.model_monitoring_payload())


class ModelRunViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ModelRunSerializer
    queryset = ModelRun.objects.all()
    lookup_field = "version"

    def get_permissions(self):
        return [IsAgentOrAbove()]


@api_view(["POST"])
@permission_classes([IsAgentOrAbove])
def reload_model(request):
    TriageEngine.reset()
    engine = TriageEngine.instance()
    return Response({"is_ready": engine.is_ready, "version": engine.version if engine.is_ready else None})


@api_view(["GET"])
@permission_classes([IsAgentOrAbove])
def ticket_predictions(request, ticket_id):
    preds = MLPrediction.objects.filter(ticket_id=ticket_id).order_by("-created_at")
    return Response(MLPredictionSerializer(preds, many=True).data)
