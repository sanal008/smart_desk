from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.role == "ADMIN" or user.is_superuser))


class IsAgentOrAbove(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.role in ("AGENT", "TEAM_LEAD", "ADMIN") or user.is_staff)
        )


class IsTeamLeadOrAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.role in ("TEAM_LEAD", "ADMIN") or user.is_superuser))


class IsOwnerOrStaff(BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        staff = user.role in ("AGENT", "TEAM_LEAD", "ADMIN") or user.is_staff
        if staff:
            return True
        requester = getattr(obj, "requester", None)
        return requester == user
