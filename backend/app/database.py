from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

import os
from pathlib import Path
from dotenv import load_dotenv

# Always backend/.env, whatever folder the server was started from. A bare load_dotenv()
# searches from the working directory in some start-up modes (e.g. the reload worker on
# Windows) and silently finds nothing. Real environment variables (Docker) still win.
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_FILE)

SQL_ALCHEMY_DATABASE = os.getenv('DATABASE_URL')
if not SQL_ALCHEMY_DATABASE:
    raise RuntimeError(f"DATABASE_URL is not set. Add it to {ENV_FILE} or set it as an environment variable.")

engine = create_engine(SQL_ALCHEMY_DATABASE)

SessionLocal = sessionmaker(autoflush=False , autocommit = False ,bind = engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()