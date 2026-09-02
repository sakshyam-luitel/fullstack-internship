import strawberry
from typing import Optional

@strawberry.type
class TokenSchema:
    access_token : str
    token_type : str
    
@strawberry.type
class TokenData:
    id : Optional[int] = None