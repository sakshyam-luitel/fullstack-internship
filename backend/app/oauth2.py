import jwt
from datetime import datetime , timezone , timedelta
from jwt.exceptions import InvalidTokenError
from schemas.token_schema import TokenData


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

oauth2_scheme = OAuth2PasswordBearer(tokenUrl = '/graphql')

def create_access_token(data : dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes = ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode , SECRET_KEY , algorithm = ALGORITHM)
    return encoded_jwt

def verify_access_token(token : str = Depends(oauth2_scheme) , db : Session = Depends(database.get_db)):
    try:
        payload = jwt.decode(token , SECRET_KEY , ALGORITHM)
        user_id = payload.get("user_id")
        if not user_id:
            raise Exception("Couldn't validate Credentials")
        data = TokenData(id = user_id)
    except InvalidTokenError:
        raise Exception("Couldn't validate Credentials")
    return data
        
        