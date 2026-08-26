from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from sqlalchemy.orm import Session
from fastapi import Depends

import os
from dotenv import load_dotenv

base_dir = Path(__file__).resolve().parent
project_root = base_dir.parent

for env_path in (base_dir / ".env", project_root / ".env"):
    if env_path.exists():
        load_dotenv(env_path)

SQL_ALCHEMY_DATABASE = os.getenv("DATABASE_URL")

if not SQL_ALCHEMY_DATABASE:
    raise RuntimeError(
        "DATABASE_URL is not set. Add it to backend/.env or export it in the shell."
    )

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
