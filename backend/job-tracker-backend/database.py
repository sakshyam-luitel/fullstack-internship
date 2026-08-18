from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from sqlalchemy.orm import Session
from fastapi import Depends

import os
from dotenv import load_dotenv

load_dotenv()

SQL_ALCHEMY_DATABASE = os.getenv("DATABASE_URL")

engine = create_engine(SQL_ALCHEMY_DATABASE)

SessionLocal = sessionmaker(autoflush = False , autocommit = False , bind = engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_context(db : Session = Depends(get_db)):
    return {"db":db}
