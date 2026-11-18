import io
import unittest
import zipfile

import pymupdf
from fastapi import HTTPException

from services.pdf_compressor import compress_pdf_bytes
from services.pdf_tools import (
    extract_pdf_pages,
    merge_pdf_bytes,
    parse_page_ranges,
    split_pdf_pages,
    rotate_pdf_pages,
    preview_pdf_pages,
    organize_pdf_pages,
    add_pdf_page_numbers,
)
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

    def test_parse_page_ranges_supports_ranges_and_order(self):
        self.assertEqual(parse_page_ranges("3,1-2", 4), [2, 0, 1])

    def test_parse_page_ranges_rejects_out_of_range(self):
        with self.assertRaises(HTTPException):
            parse_page_ranges("1-5", 4)

    def test_parse_page_ranges_rejects_duplicates(self):
        with self.assertRaises(HTTPException):
            parse_page_ranges("1-2,2", 4)

    def test_extract_selected_pages(self):
        result = extract_pdf_pages(make_pdf(4), "2,4")
        document = pymupdf.open(stream=result, filetype="pdf")
        try:
            self.assertEqual(document.page_count, 2)
            self.assertIn("page-2", document[0].get_text())
            self.assertIn("page-4", document[1].get_text())
        finally:
            document.close()

    def test_rotate_all_pages_by_90_degrees(self):
        result = rotate_pdf_pages(make_pdf(2), 90)
        document = pymupdf.open(stream=result, filetype="pdf")
        try:
            self.assertEqual([page.rotation for page in document], [90, 90])
        finally:
            document.close()

    def test_rotate_only_selected_pages(self):
        result = rotate_pdf_pages(make_pdf(3), 180, "2")
        document = pymupdf.open(stream=result, filetype="pdf")
        try:
            self.assertEqual([page.rotation for page in document], [0, 180, 0])
        finally:
            document.close()

    def test_rotate_rejects_invalid_angle(self):
        with self.assertRaises(HTTPException):
            rotate_pdf_pages(make_pdf(), 45)

    def test_rotate_rejects_invalid_page_expression(self):
        with self.assertRaises(HTTPException):
            rotate_pdf_pages(make_pdf(2), 90, "3")

    def test_organize_reorders_and_deletes_pages(self):
        result = organize_pdf_pages(make_pdf(4), [3, 1, 4])
        document = pymupdf.open(stream=result, filetype="pdf")
        try:
            self.assertEqual(document.page_count, 3)
            self.assertIn("page-3", document[0].get_text())
            self.assertIn("page-1", document[1].get_text())
            self.assertIn("page-4", document[2].get_text())
        finally:
            document.close()

    def test_organize_rejects_empty_order(self):
        with self.assertRaises(HTTPException):
            organize_pdf_pages(make_pdf(2), [])

    def test_organize_rejects_duplicate_page(self):
        with self.assertRaises(HTTPException):
            organize_pdf_pages(make_pdf(2), [1, 1])

    def test_organize_rejects_out_of_range_page(self):
        with self.assertRaises(HTTPException):
            organize_pdf_pages(make_pdf(2), [1, 3])

    def test_preview_returns_thumbnail_for_each_page(self):
        previews = preview_pdf_pages(make_pdf(3))
        self.assertEqual(len(previews), 3)
        self.assertTrue(previews[0]["thumbnail"].startswith("data:image/jpeg;base64,"))

    def test_add_page_numbers_to_all_pages(self):
        result = add_pdf_page_numbers(make_pdf(3), position="bottom-center")
        document = pymupdf.open(stream=result, filetype="pdf")
        try:
            self.assertIn("1", document[0].get_text())
            self.assertIn("2", document[1].get_text())
            self.assertIn("3", document[2].get_text())
        finally:
            document.close()

    def test_page_numbering_can_start_later_and_custom_number(self):
        result = add_pdf_page_numbers(make_pdf(4), start_number=5, start_page=3)
        document = pymupdf.open(stream=result, filetype="pdf")
        try:
            self.assertNotIn("5", document[0].get_text())
            self.assertIn("5", document[2].get_text())
            self.assertIn("6", document[3].get_text())
        finally:
            document.close()

    def test_page_numbering_rejects_invalid_position(self):
        with self.assertRaises(HTTPException):
            add_pdf_page_numbers(make_pdf(), position="center")

    def test_page_numbering_rejects_start_page_out_of_range(self):
        with self.assertRaises(HTTPException):
            add_pdf_page_numbers(make_pdf(2), start_page=3)

    def test_split_creates_one_pdf_per_page(self):
        result = split_pdf_pages(make_pdf(3))
        with zipfile.ZipFile(io.BytesIO(result)) as archive:
            self.assertEqual(archive.namelist(), ["page-001.pdf", "page-002.pdf", "page-003.pdf"])
            for name in archive.namelist():
                document = pymupdf.open(stream=archive.read(name), filetype="pdf")
                try:
                    self.assertEqual(document.page_count, 1)
                finally:
                    document.close()


if __name__ == "__main__":
    unittest.main()
