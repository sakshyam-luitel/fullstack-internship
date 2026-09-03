import strawberry
from typing import Optional
    
import uuid


@strawberry.type
class TokenSchema:
    access_token : str
    token_type : str
    
@strawberry.type
class TokenData:
    id : Optional[int] = None

@strawberry.type
class UserSchema:
    name : str
    email : str
    department_id : uuid.UUID
    role : str
    
