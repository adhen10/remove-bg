from fastapi import APIRouter

from services.pdf_tools import get_pdf_tool_catalog

router = APIRouter(prefix="/pdf-tools", tags=["PDF Tools"])


@router.get("/capabilities")
def get_pdf_tools():
    """Expose the PDF tools catalog and their current availability."""
    return {"tools": get_pdf_tool_catalog()}
