import unittest

import pymupdf
from fastapi import HTTPException

from services.pdf_compressor import compress_pdf_bytes
from utils.pdf_validation import open_validated_pdf


def make_pdf(page_count: int = 1) -> bytes:
    document = pymupdf.open()
    for _ in range(page_count):
        document.new_page()
    result = document.tobytes()
    document.close()
    return result


class PdfValidationTests(unittest.TestCase):
    def test_open_valid_pdf(self):
        data = make_pdf()
        document = open_validated_pdf(data)
        try:
            self.assertEqual(document.page_count, 1)
        finally:
            document.close()

    def test_reject_empty_pdf(self):
        with self.assertRaises(HTTPException) as context:
            open_validated_pdf(b"")
        self.assertEqual(context.exception.status_code, 400)

    def test_reject_invalid_pdf(self):
        with self.assertRaises(HTTPException) as context:
            open_validated_pdf(b"not a PDF")
        self.assertEqual(context.exception.status_code, 400)

    def test_compressor_still_accepts_valid_pdf(self):
        result = compress_pdf_bytes(make_pdf(), "medium")
        self.assertTrue(result.startswith(b"%PDF-"))


if __name__ == "__main__":
    unittest.main()
