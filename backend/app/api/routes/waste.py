from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/waste/{item_name}")
def get_waste(item_name: str) -> dict:
    raise HTTPException(
        status_code=501,
        detail=f"Waste lookup is not connected yet: {item_name}",
    )
