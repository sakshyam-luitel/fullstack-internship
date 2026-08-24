
from jose import JWTError , jwt
from datetime import datetime, timedelta, timezone
import schemas , database 
from fastapi import Depends , status , HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from fastapi import Request



#SECRET_KEY
#Algorithm
#Expiration Time

SECRET_KEY = "YUWr9G4VwJ58umgtcqbaoEnGeYcAsrbnNn3SnLBHiAu"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/graphql')

def create_access_token(data: dict):
    to_encode = data.copy()
    if "user_id" not in to_encode and "id" in to_encode:
        to_encode["user_id"] = to_encode.pop("id")

    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_access_token(token: str = Depends(oauth2_scheme) , db : Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid Credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        user_id: int = payload.get("user_id")
        if user_id is None:
            raise credentials_exception
        token_data = schemas.TokenData(id=user_id)
    except JWTError:
        raise credentials_exception
    
    # user = db.query(models.User).filter(models.User.id == token_data.id).first()

    # return user
    return token_data

async def get_context(
    db: Session = Depends(database.get_db),
    request: Request = None,
):
    user_id = None
    auth_header = request.headers.get("authorization") if request else None

    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        if token:
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                user_id = payload.get("user_id")
            except JWTError:
                user_id = None

    return {
        "db": db,
        "user_id": user_id
    }
    


