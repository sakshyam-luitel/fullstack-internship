import strawberry
import datetime
from typing import Optional

#Posts Schema
@strawberry.type
class Posts:
    id : int
    title : str
    content : str
    published : bool
    created_at : datetime.datetime
    user_id : int

@strawberry.type    
class Users:
    id : int
    email : str
    created_at : datetime.datetime

@strawberry.type
class Token:
    access_token : str
    token_type : str
    
@strawberry.type
class TokenData:
    id : Optional[int] = None