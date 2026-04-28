from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.schemas import IngestionResult
from services.ingestion import parse_csv, parse_excel, ingest_dataframe

router = APIRouter()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


@router.post("/ingestion/upload", response_model=IngestionResult)
async def upload_data(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(400, "No filename provided")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB")

    ext = file.filename.lower().rsplit(".", 1)[-1] if "." in file.filename else ""

    if ext == "csv":
        parser = parse_csv
    elif ext in ("xlsx", "xls"):
        parser = parse_excel
    else:
        raise HTTPException(400, "Unsupported file type. Use .csv or .xlsx")

    try:
        df = parser(content)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        raise HTTPException(422, f"Failed to parse file: {e}")

    try:
        stats = await ingest_dataframe(df, db)
    except Exception as e:
        raise HTTPException(500, f"Ingestion failed: {e}")

    return IngestionResult(**stats)
