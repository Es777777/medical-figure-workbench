from __future__ import annotations

import tempfile
import unittest
import importlib.util
from pathlib import Path
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "python" / "image_normalize.py"
SPEC = importlib.util.spec_from_file_location("image_normalize", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Could not load module from {MODULE_PATH}")

MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

NormalizationError = MODULE.NormalizationError
detect_format_from_magic = MODULE.detect_format_from_magic
inspect_image = MODULE.inspect_image
normalize_to_png = MODULE.normalize_to_png


ASSET_TIFF = ROOT / "Graphical Abstract Image.tif"
ASSET_FALSE_PNG = ROOT / "Graphical Abstract Image - 副本.png"


class DetectFormatTests(unittest.TestCase):
    def test_detects_real_tiff(self) -> None:
        self.assertEqual(detect_format_from_magic(ASSET_TIFF), "TIFF")

    def test_detects_false_png_as_tiff(self) -> None:
        self.assertEqual(detect_format_from_magic(ASSET_FALSE_PNG), "TIFF")


class InspectImageTests(unittest.TestCase):
    def test_inspect_flags_false_extension(self) -> None:
        meta = inspect_image(ASSET_FALSE_PNG)
        self.assertEqual(meta["detected_format"], "TIFF")
        self.assertTrue(meta["is_false_extension"])


class NormalizeTests(unittest.TestCase):
    def test_normalizes_synthetic_tiff_and_preserves_dimensions(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            synthetic_tiff = Path(tmpdir) / "synthetic.tif"
            Image.new("RGB", (64, 32), color=(255, 255, 255)).save(synthetic_tiff, format="TIFF")

            result = normalize_to_png(synthetic_tiff, tmpdir, output_name="from_tiff")
            output_path = Path(result.output_path)

            self.assertTrue(output_path.exists())
            self.assertEqual(result.detected_format, "TIFF")
            self.assertEqual((result.width, result.height), (64, 32))

            with Image.open(output_path) as normalized:
                self.assertEqual(normalized.format, "PNG")
                self.assertEqual(normalized.size, (64, 32))

    def test_real_false_png_fails_fast_with_actionable_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            with self.assertRaises(NormalizationError) as ctx:
                normalize_to_png(
                    ASSET_FALSE_PNG,
                    tmpdir,
                    output_name="from_false_png",
                    decode_timeout_seconds=1.0,
                )

            self.assertIn("fallback decoder", str(ctx.exception))

    def test_unsupported_signature_raises_clear_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            bogus = Path(tmpdir) / "bogus.bin"
            bogus.write_bytes(b"not-an-image")

            with self.assertRaises(NormalizationError):
                normalize_to_png(bogus, tmpdir)


if __name__ == "__main__":
    unittest.main()
