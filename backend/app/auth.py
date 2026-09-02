import strawberry
from schemas import token_schema
from mutations_input import mutation_input
from models  import User
import oauth2 , utils
from schemas.token_schema import TokenSchema

@strawberry.type
class Login:
    @strawberry.mutation
    def login(self , info : strawberry.Info, user_input : mutation_input.UserLoginInput) -> token_schema.TokenData :
        db = info.context["db"]
        user = db.query(User).filter(user_input.email == User.email).first()
        if not user:
            raise Exception("Invalid Credentials")
        if not utils.verify_password(user_input.password , user.password):
            raise Exception("Invalid Credentials")
        access_token = oauth2.create_access_token(data={"user_id": user.id})
        return TokenSchema(
                            access_token = access_token,
                            token_type="bearer"
                            )
        
