import strawberry
from sqlalchemy import Uuid

@strawberry.input
class UserMutation:
    id : Uuid
    
    