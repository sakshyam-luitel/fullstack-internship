import strawberry
from sqlalchemy import Uuid
from mutations_input.mutation_input import UserMutationInput
from schemas.user_schema import UserSchema
import models

@strawberry.input
class UserMutation:
    @strawberry.mutation
    def create_user(self , info : strawberry.Info , admin_input : UserMutationInput ) -> UserSchema:
        db = info.context['db']
        db.query()
        
    
    
    