from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

import os
from dotenv import load_dotenv

load_dotenv()

SQL_ALCHEMY_DATABASE = os.getenv('DATABASE_URL')

engine = create_engine(SQL_ALCHEMY_DATABASE)

SessionLocal = sessionmaker(autoflush=False , autocommit = False ,bind = engine)

Base = declarative_base()
Base.metadata.create_all(bind = engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()