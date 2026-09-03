import strawberry
from sqlalchemy import Uuid
from . import mutation_input
from . schemas import UserSchema
from . import models
from . utils import get_password_hash
from . permissions import IsAdmin

@strawberry.type
class UserMutation:
    @strawberry.mutation(permission_classes=[IsAdmin])
    def create_user(self , info : strawberry.Info , admin_input : mutation_input.UserMutationInput ) -> UserSchema:
        db = info.context.get("db")
        hashed_password = get_password_hash(admin_input.password)
        user = models.User(
            department_id = admin_input.department_id,
            name = admin_input.name,
            email = admin_input.email,
            password = hashed_password,
            role = admin_input.role
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        return UserSchema(
            name = user.name,
            email = user.email,
            department_id = user.department_id,
            role = user.role
        )
    
    
    