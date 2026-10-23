from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CategoryViewSet, SLAPolicyViewSet, TicketViewSet

router = DefaultRouter()
router.register("tickets", TicketViewSet, basename="ticket")
router.register("categories", CategoryViewSet, basename="category")
router.register("sla-policies", SLAPolicyViewSet, basename="sla-policy")

urlpatterns = [
    path("", include(router.urls)),
]
