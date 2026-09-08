import strawberry

from . import models, schemas
from .permissions import IsAdmin


@strawberry.type
class UserQuery:
    @strawberry.field(permission_classes=[IsAdmin])
    def users(self, info: strawberry.Info) -> list[schemas.UserSchema]:
        db = info.context["db"]
        users = db.query(models.User).order_by(models.User.created_at.desc()).all()

        return [
            schemas.UserSchema(
                id=user.id,
                department_id=user.department_id,
                name=user.name,
                email=user.email,
                password="********",
                role=user.role,
                created_at=user.created_at,
            )
            for user in users
        ]