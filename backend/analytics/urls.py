from django.urls import path

from .views import AgentWorkloadView, CategoryTrendsView, OverviewView, SLAView, VolumeView

urlpatterns = [
    path("overview/", OverviewView.as_view(), name="analytics-overview"),
    path("volume/", VolumeView.as_view(), name="analytics-volume"),
    path("agent-workload/", AgentWorkloadView.as_view(), name="analytics-workload"),
    path("category-trends/", CategoryTrendsView.as_view(), name="analytics-category-trends"),
    path("sla/", SLAView.as_view(), name="analytics-sla"),
]
