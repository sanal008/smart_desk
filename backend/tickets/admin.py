from django.contrib import admin

from .models import Attachment, Category, SLAPolicy, Ticket, TicketActivity, TicketComment


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "default_team", "icon")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name",)


@admin.register(SLAPolicy)
class SLAPolicyAdmin(admin.ModelAdmin):
    list_display = ("category", "priority", "response_minutes", "resolution_minutes")
    list_filter = ("priority", "category")


class AttachmentInline(admin.TabularInline):
    model = Attachment
    extra = 0


class CommentInline(admin.TabularInline):
    model = TicketComment
    extra = 0
    readonly_fields = ("author", "body", "created_at")


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ("number", "title", "status", "priority", "category", "assignee", "created_at")
    list_filter = ("status", "priority", "category", "team")
    search_fields = ("number", "title", "description")
    readonly_fields = ("number",)
    inlines = [CommentInline, AttachmentInline]
    raw_id_fields = ("requester", "assignee")


@admin.register(TicketComment)
class TicketCommentAdmin(admin.ModelAdmin):
    list_display = ("ticket", "author", "is_internal", "is_ai_draft", "created_at")
    list_filter = ("is_internal", "is_ai_draft")


@admin.register(TicketActivity)
class TicketActivityAdmin(admin.ModelAdmin):
    list_display = ("ticket", "action", "actor", "is_ai_actor", "created_at")
    list_filter = ("action", "is_ai_actor")
    readonly_fields = ("ticket", "actor", "action", "field", "old_value", "new_value",
                       "metadata", "created_at", "is_ai_actor")
