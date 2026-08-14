# from passlib.context import CryptContext
from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()

# pwd_context = CryptContext(schemes=['bcrypt'], deprecated = 'auto')

def hash(password : str):
    return password_hash.hash(password)

def verify(plain_password , hashed_password):
    return password_hash.verify(plain_password , hashed_password)
