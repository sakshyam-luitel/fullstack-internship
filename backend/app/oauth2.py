import jwt
from datetime import datetime , timezone , timedelta
from jwt.exceptions import InvalidTokenError
from . schemas import TokenData
from fastapi import Request, Depends
from sqlalchemy.orm import Session
from . database import get_db , SessionLocal
from . models import User


from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from . import database

from sqlalchemy.orm import Session

import os
from dotenv import load_dotenv
load_dotenv()

SECRET_KEY = os.getenv('SECRET_KEY')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/graphql', auto_error=False)

def create_access_token(data : dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes = ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode , SECRET_KEY , algorithm = ALGORITHM)
    return encoded_jwt

def verify_access_token(token : str = Depends(oauth2_scheme) , db : Session = Depends(database.get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise Exception("Couldn't validate Credentials")
        data = TokenData(id = user_id)
    except InvalidTokenError:
        raise Exception("Couldn't validate Credentials")
    return data
        
async def get_context(
    db: Session = Depends(database.get_db),
    request: Request = None,
    token: str | None = Depends(oauth2_scheme),
):
    current_user = None
    authorization = request.headers.get("Authorization", "") if request else ""
    header_parts = authorization.strip().split(maxsplit=1)
    header_token = (
        header_parts[1]
        if len(header_parts) == 2 and header_parts[0].lower() == "bearer"
        else None
    )
    token = header_token or token

    if token and SECRET_KEY:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get('user_id')
            if user_id:
                current_user = db.query(User).filter(User.id == user_id).first()
        except (InvalidTokenError, ValueError):
            current_user = None

    return {
        "db": db,
        "current_user": current_user,
    }
    