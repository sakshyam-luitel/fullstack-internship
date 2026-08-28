import strawberry
from mutation_input import UserLogin
import schemas , models , utils , oauth2

@strawberry.type
class LoginUserMutation:
    @strawberry.mutation
    def login_user(self , info : strawberry.Info , user_input : UserLogin) -> schemas.Token:
        db = info.context['db']
        user = db.query(models.User).filter(user_input.email == models.User.email).first()
        if not user:
            raise Exception("Invalid Credentials")
        if not utils.verify_password(user_input.password , user.password):
            raise Exception("Invalid Credentials")
        
        access_token = oauth2.create_access_token(data={"user_id": user.id})
        
        return schemas.Token(
                            access_token = access_token,
                             token_type="bearer"
                             )