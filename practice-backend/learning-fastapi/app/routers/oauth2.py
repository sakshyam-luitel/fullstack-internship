from jose import jwt , JWTError
from datetime import datetime , timedelta
from .. import schemas
from fastapi import Depends , status , HTTPException
from fastapi.security import OAuth2PasswordBearer

#SECRET_KEY
#Algorithm
#Expiration Time

SECRET_KEY = "YUWr9G4VwJ58umgtcqbaoEnGeYcAsrbnNn3SnLBHiAu"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

oauth2_scheme = OAuth2PasswordBearer(tokenUrl = 'login')
def create_access_token(data : dict):
    to_encode = data.copy()
    expire = datetime.now() + timedelta(minutes = ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp" : expire})
    
    encoded_jwt = jwt.encode(to_encode , SECRET_KEY , algorithm=ALGORITHM)
    
    return encoded_jwt

def verify_access_token(token : str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code = status.HTTP_401_UNAUTHORIZED,
        detail= "Invalid Credentials",
        headers ={ "WWW-Authenticate" : "Bearer"}
    )
    
    try:
        payload = jwt.decode(token , SECRET_KEY , algorithms=[ALGORITHM])
           
        id : str = payload.get("user_id")
        if id is None:
            raise credentials_exception
        token_data = schemas.TokenData(id = id)
    except:
       raise credentials_exception
   
    return token_data
   