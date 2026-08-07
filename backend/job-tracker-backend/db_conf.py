import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session , sessionmaker
from sqlalchemy.ext.declarative import declarative_base

load_dotenv('.env')

SQL_ALCHEMY_DATABASE_URL = os.environ['DATABASE_URL']

engine = create_engine(
    SQL_ALCHEMY_DATABASE_URL,
)

db_session = scoped_session(sessionmaker(autocommit=False , autoflush = False , bind = engine))
Base = declarative_base()