import io
import unittest

from fastapi import HTTPException
from PIL import Image

from services.image_converter import convert_image_bytes


def make_png() -> bytes:
    image = Image.new("RGBA", (32, 16), (0, 0, 0, 0))
    image.paste(Image.new("RGBA", (16, 16), (20, 40, 60, 255)), (16, 0))
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


class ImageConverterTests(unittest.TestCase):
    def setUp(self):
        self.source = make_png()

    def test_convert_to_png_preserves_transparency(self):
        result, media_type, extension = convert_image_bytes(self.source, "png")
        with Image.open(io.BytesIO(result)) as converted:
            self.assertEqual(converted.format, "PNG")
            self.assertEqual(converted.mode, "RGBA")
            self.assertEqual(converted.getpixel((0, 0))[3], 0)
        self.assertEqual(media_type, "image/png")
        self.assertEqual(extension, "png")

    def test_convert_to_jpg_flattens_transparency_using_selected_color(self):
        result, media_type, extension = convert_image_bytes(
            self.source,
            "jpg",
            quality=95,
            background_color="#ff0000",
        )
        with Image.open(io.BytesIO(result)) as converted:
            self.assertEqual(converted.format, "JPEG")
            self.assertEqual(converted.mode, "RGB")
            red, green, blue = converted.getpixel((0, 0))
            self.assertGreater(red, 200)
            self.assertLess(green, 60)
            self.assertLess(blue, 60)
        self.assertEqual(media_type, "image/jpeg")
        self.assertEqual(extension, "jpg")

    def test_convert_to_webp(self):
        result, media_type, extension = convert_image_bytes(
            self.source, "webp", quality=85
        )
        with Image.open(io.BytesIO(result)) as converted:
            self.assertEqual(converted.format, "WEBP")
        self.assertEqual(media_type, "image/webp")
        self.assertEqual(extension, "webp")

    def test_convert_to_bmp(self):
        result, media_type, extension = convert_image_bytes(self.source, "bmp")
        with Image.open(io.BytesIO(result)) as converted:
            self.assertEqual(converted.format, "BMP")
            self.assertEqual(converted.mode, "RGB")
        self.assertEqual(media_type, "image/bmp")
        self.assertEqual(extension, "bmp")

    def test_convert_to_tiff_preserves_transparency(self):
        result, media_type, extension = convert_image_bytes(self.source, "tiff")
        with Image.open(io.BytesIO(result)) as converted:
            self.assertEqual(converted.format, "TIFF")
            self.assertEqual(converted.mode, "RGBA")
            self.assertEqual(converted.getpixel((0, 0))[3], 0)
        self.assertEqual(media_type, "image/tiff")
        self.assertEqual(extension, "tiff")

    def test_reject_unsupported_output_format(self):
        with self.assertRaises(HTTPException) as context:
            convert_image_bytes(self.source, "gif")
        self.assertEqual(context.exception.status_code, 400)

    def test_reject_quality_outside_range(self):
        with self.assertRaises(HTTPException) as context:
            convert_image_bytes(self.source, "jpg", quality=101)
        self.assertEqual(context.exception.status_code, 400)

    def test_reject_invalid_background_color(self):
        with self.assertRaises(HTTPException) as context:
            convert_image_bytes(self.source, "jpg", background_color="red")
        self.assertEqual(context.exception.status_code, 400)

    def test_reject_corrupted_input(self):
        with self.assertRaises(HTTPException) as context:
            convert_image_bytes(b"not an image", "png")
        self.assertEqual(context.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
