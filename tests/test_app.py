import importlib.util
from pathlib import Path
import struct
import tempfile
import unittest
import zlib

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("bridge", ROOT / "app" / "bridge.py")
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


class AppIntegrationTests(unittest.TestCase):
    def test_text_cleanup_preserves_bengali_and_emoji(self):
        original = "Hello\u200b world\u00a0বাংলা ❤️‍🔥"
        result = bridge.handle({"action": "text", "text": original})
        self.assertTrue(result["ok"])
        self.assertEqual(result["text"], "Hello world বাংলা ❤️‍🔥")

    def test_file_original_and_existing_export_preserved(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "draft.txt"
            source.write_text("Hello\u200b world")
            first = bridge.handle({"action": "clean", "path": str(source), "outputDirectory": temp})
            second = bridge.handle({"action": "clean", "path": str(source), "outputDirectory": temp})
            self.assertNotEqual(first["output"], second["output"])
            self.assertEqual(source.read_text(), "Hello\u200b world")
            self.assertEqual(Path(first["output"]).read_text(), "Hello world")
            self.assertEqual(Path(second["output"]).read_text(), "Hello world")

    def test_png_metadata_removed_without_changing_image_data(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "image.png"
            pixels = chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00"))
            image = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
                     + chunk(b"tEXt", b"Software\x00OpenAI DALL-E") + pixels + chunk(b"IEND", b""))
            source.write_bytes(image)
            inspected = bridge.handle({"action": "inspect", "path": str(source)})
            self.assertEqual(inspected["summary"], "Marks found")
            cleaned = bridge.handle({"action": "clean", "path": str(source), "outputDirectory": temp})
            data = Path(cleaned["output"]).read_bytes()
            self.assertNotIn(b"OpenAI", data)
            self.assertIn(pixels, data)
            self.assertEqual(source.read_bytes(), image)
            after = bridge.handle({"action": "inspect", "path": cleaned["output"]})
            self.assertEqual(after["summary"], "No marks detected")

    def test_unknown_binary_refused_without_export(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "data.bin"
            source.write_bytes(b"\x00\x01\x02\x03unknown")
            result = bridge.handle({"action": "inspect", "path": str(source)})
            self.assertFalse(result["ok"])
            with self.assertRaises(RuntimeError):
                bridge.handle({"action": "clean", "path": str(source), "outputDirectory": temp})
            self.assertEqual(len(list(Path(temp).iterdir())), 1)

    def test_office_document_round_trip(self):
        with tempfile.TemporaryDirectory() as temp:
            source = ROOT / "upstream/tests/fixtures/sample_ai.xlsx"
            result = bridge.handle({"action": "clean", "path": str(source), "outputDirectory": temp})
            self.assertTrue(result["ok"])
            import zipfile
            with zipfile.ZipFile(result["output"]) as archive:
                self.assertIsNone(archive.testzip())
                self.assertIn("xl/workbook.xml", archive.namelist())


if __name__ == "__main__":
    unittest.main()
