PDF_TOOL_CATALOG = [
    {
        "id": "merge",
        "name": "Merge PDF",
        "description": "Gabungkan beberapa dokumen PDF menjadi satu file.",
        "available": False,
    },
    {
        "id": "split",
        "name": "Split & Extract PDF",
        "description": "Pisahkan dokumen atau ambil halaman tertentu.",
        "available": False,
    },
    {
        "id": "rotate",
        "name": "Rotate PDF",
        "description": "Putar halaman PDF sesuai orientasi yang dibutuhkan.",
        "available": False,
    },
    {
        "id": "organize",
        "name": "Organize PDF",
        "description": "Atur urutan halaman dan hapus halaman yang tidak diperlukan.",
        "available": False,
    },
    {
        "id": "compress",
        "name": "Compress PDF",
        "description": "Kurangi ukuran file PDF.",
        "available": True,
        "href": "/compress-pdf",
    },
]


def get_pdf_tool_catalog() -> list[dict[str, str | bool]]:
    """Return the PDF tools currently available in the workspace."""
    return PDF_TOOL_CATALOG
