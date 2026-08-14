from fastapi import APIRouter , Depends , status , HTTPException , Response
from sqlalchemy.orm import Session
from fastapi.security.oauth2 import OAuth2PasswordRequestForm
from .. import schemas , database ,models , utils
from . import oauth2
from typing import Annotated

router = APIRouter(
    prefix = "/login",
    tags = ['Authentication']
)

@router.post('/')
def login(user_credentials : schemas.UserCreate , db : Session = Depends(database.get_db)):
    user = db.query(models.Users).filter(models.Users.email == user_credentials.email).first()

    if not user:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail = f"Invalid Credentials"
        )
        
    if not utils.verify(user_credentials.password , user.password):
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail = f"Invalid Credentials"
        )
        
    access_token = oauth2.create_access_token(data = {"user_id": user.id})
        
    return { "access_token" : access_token , "token_type" : "bearer"}