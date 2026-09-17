import strawberry
from sqlalchemy import func
from . import mutation_input, oauth2, utils
from .models import User
from .schemas import TokenSchema

@strawberry.type
class Login:
    @strawberry.mutation
    def login(self, info: strawberry.Info, user_input: mutation_input.UserLoginInput) -> TokenSchema:
        db = info.context["db"]
        # Emails are unique regardless of letter case (see mutations._ensure_email_available).
        user = db.query(User).filter(func.lower(User.email) == user_input.email.strip().lower()).first()
        if not user:
            raise Exception("Invalid Credentials")
        if not utils.verify_password(user_input.password , user.password):
            raise Exception("Invalid Credentials")
        access_token = oauth2.create_access_token(data={"user_id": str(user.id)})
        return TokenSchema(
                            access_token = access_token,
                            token_type="Bearer",
                            role=getattr(user.role, "value", user.role),
                            )
        
