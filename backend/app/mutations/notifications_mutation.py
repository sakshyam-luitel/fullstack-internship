import strawberry
from app.permissions import IsAuthenticated
from app import mutation_input , models , schemas

@strawberry.type
class NotificationMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    def mark_notifications_read(self, info: strawberry.Info, user_input: mutation_input.MarkNotificationsReadInput) -> int:
        """Returns how many unread notifications were marked read."""
        db = info.context["db"]
        current_user = info.context["current_user"]
        query = db.query(models.Notifications).filter(
            models.Notifications.user_id == current_user.id,
            models.Notifications.is_read.is_(False),
        )
        if user_input.ids is not None:
            query = query.filter(models.Notifications.id.in_(user_input.ids))
        updated = query.update({models.Notifications.is_read: True}, synchronize_session=False)
        db.commit()
        return updated
