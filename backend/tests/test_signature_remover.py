import io
import unittest

from fastapi import HTTPException
from PIL import Image, ImageDraw

from services.signature_remover import remove_light_background


def make_signature_image() -> bytes:
    image = Image.new("RGB", (160, 100), (250, 250, 250))
    draw = ImageDraw.Draw(image)
    draw.line([(18, 58), (35, 34), (52, 62), (76, 25), (95, 65), (135, 40)], fill=(18, 18, 18), width=5)
    # Simulate faint JPEG/background variation close to the paper color.
    draw.point((4, 4), fill=(240, 240, 240))
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


class SignatureRemoverTests(unittest.TestCase):
    def setUp(self):
        self.source = make_signature_image()

    def test_removes_light_background_and_keeps_dark_ink(self):
        result = remove_light_background(self.source)
        with Image.open(io.BytesIO(result)) as converted:
            self.assertEqual(converted.mode, "RGBA")
            self.assertEqual(converted.size, (160, 100))
            self.assertEqual(converted.getpixel((0, 0))[3], 0)
            self.assertGreater(converted.getpixel((4, 4))[3], 0)
            self.assertGreater(converted.getpixel((35, 34))[3], 220)

    def test_higher_sensitivity_removes_faint_background_noise(self):
        noisy = Image.new("RGB", (80, 60), (250, 250, 250))
        pixels = noisy.load()
        pixels[8, 8] = (230, 230, 230)
        pixels[40, 30] = (0, 0, 0)
        stream = io.BytesIO()
        noisy.save(stream, format="PNG")

        low = remove_light_background(stream.getvalue(), sensitivity=0)
        high = remove_light_background(stream.getvalue(), sensitivity=100)

        with Image.open(io.BytesIO(low)) as low_result, Image.open(io.BytesIO(high)) as high_result:
            self.assertGreater(low_result.getpixel((8, 8))[3], 0)
            self.assertEqual(high_result.getpixel((8, 8))[3], 0)
            self.assertEqual(high_result.getpixel((40, 30))[3], 255)

    def test_rejects_dark_background(self):
        image = Image.new("RGB", (40, 40), (20, 20, 20))
        stream = io.BytesIO()
        image.save(stream, format="PNG")

        with self.assertRaises(HTTPException) as context:
            remove_light_background(stream.getvalue())
        self.assertEqual(context.exception.status_code, 400)

    def test_rejects_invalid_sensitivity(self):
        with self.assertRaises(HTTPException) as context:
            remove_light_background(self.source, sensitivity=101)
        self.assertEqual(context.exception.status_code, 400)

    def test_preserves_colored_ink(self):
        image = Image.new("RGB", (80, 60), (250, 250, 250))
        ImageDraw.Draw(image).line(
            [(10, 30), (70, 30)],
            fill=(20, 60, 180),
            width=5,
        )
        stream = io.BytesIO()
        image.save(stream, format="PNG")

        result = remove_light_background(stream.getvalue())
        with Image.open(io.BytesIO(result)) as converted:
            red, green, blue, alpha = converted.getpixel((40, 30))
            self.assertGreater(alpha, 220)
            self.assertLess(red, 40)
            self.assertLess(green, 90)
            self.assertGreater(blue, 150)


if __name__ == "__main__":
    unittest.main()
