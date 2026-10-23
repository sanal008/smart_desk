from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("tickets.urls")),
    path("api/ai/", include("ai.urls")),
    path("api/analytics/", include("analytics.urls")),
]
