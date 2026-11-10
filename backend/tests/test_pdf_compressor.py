import unittest

import pymupdf
from fastapi import HTTPException

from services.pdf_compressor import compress_pdf_bytes


def make_pdf() -> bytes:
    document = pymupdf.open()
    page = document.new_page()
    page.insert_text((72, 72), "PDF compression smoke test")
    result = document.tobytes()
    document.close()
    return result


class PdfCompressorTests(unittest.TestCase):
    def test_compress_pdf_returns_valid_pdf(self):
        original = make_pdf()
        result = compress_pdf_bytes(original, "medium")
        self.assertTrue(result.startswith(b"%PDF-"))

        with pymupdf.open(stream=result, filetype="pdf") as document:
            self.assertEqual(document.page_count, 1)
            self.assertIn("PDF compression smoke test", document[0].get_text())

    def test_reject_invalid_pdf(self):
        with self.assertRaises(HTTPException) as context:
            compress_pdf_bytes(b"not a PDF", "medium")
        self.assertEqual(context.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
