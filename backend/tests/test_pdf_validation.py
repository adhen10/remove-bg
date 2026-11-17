import unittest

import pymupdf
from fastapi import HTTPException

from services.pdf_compressor import compress_pdf_bytes
from services.pdf_tools import merge_pdf_bytes
from utils.pdf_validation import open_validated_pdf


def make_pdf(page_count: int = 1, label: str = "page") -> bytes:
    document = pymupdf.open()
    for index in range(page_count):
        page = document.new_page()
        page.insert_text((72, 72), f"{label}-{index + 1}")
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

    def test_merge_keeps_input_page_order(self):
        result = merge_pdf_bytes([make_pdf(2, "first"), make_pdf(1, "second")])
        document = pymupdf.open(stream=result, filetype="pdf")
        try:
            self.assertEqual(document.page_count, 3)
            self.assertIn("first-1", document[0].get_text())
            self.assertIn("first-2", document[1].get_text())
            self.assertIn("second-1", document[2].get_text())
        finally:
            document.close()

    def test_merge_requires_two_files(self):
        with self.assertRaises(HTTPException) as context:
            merge_pdf_bytes([make_pdf()])
        self.assertEqual(context.exception.status_code, 400)

    def test_merge_rejects_invalid_input(self):
        with self.assertRaises(HTTPException) as context:
            merge_pdf_bytes([make_pdf(), b"not a PDF"])
        self.assertEqual(context.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
