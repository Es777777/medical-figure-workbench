from __future__ import annotations

import argparse
import json
import mimetypes
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import BinaryIO, Literal

from PIL import Image, ImageOps, UnidentifiedImageError


DetectedFormat = Literal["PNG", "JPEG", "TIFF", "GIF", "WEBP", "UNKNOWN"]
OutputMode = Literal["RGB", "RGBA"]


class NormalizationError(RuntimeError):
    pass


@dataclass(slots=True)
class NormalizedImageMeta:
    source_path: str
    source_extension: str
    declared_mime_type: str | None
    detected_format: DetectedFormat
    pillow_format: str | None
    source_mode: str
    width: int
    height: int
    dpi: tuple[float, float] | None
    frame_count: int
    selected_frame: int
    had_alpha: bool
    output_mode: OutputMode
    output_path: str
    warnings: list[str] = field(default_factory=list)


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
JPEG_SIGNATURE = b"\xff\xd8\xff"
GIF87A_SIGNATURE = b"GIF87a"
GIF89A_SIGNATURE = b"GIF89a"
WEBP_RIFF_SIGNATURE = b"RIFF"
WEBP_WEBP_SIGNATURE = b"WEBP"
TIFF_LE_SIGNATURE = b"II*\x00"
TIFF_BE_SIGNATURE = b"MM\x00*"
BIG_TIFF_LE_SIGNATURE = b"II+\x00"
BIG_TIFF_BE_SIGNATURE = b"MM\x00+"


def detect_format_from_magic(path: str | Path) -> DetectedFormat:
    path = Path(path)
    with path.open("rb") as fh:
        return detect_format_from_stream(fh)


def detect_format_from_stream(stream: BinaryIO) -> DetectedFormat:
    header = stream.read(16)

    if header.startswith(PNG_SIGNATURE):
        return "PNG"
    if header.startswith(JPEG_SIGNATURE):
        return "JPEG"
    if header.startswith(GIF87A_SIGNATURE) or header.startswith(GIF89A_SIGNATURE):
        return "GIF"
    if header.startswith(TIFF_LE_SIGNATURE) or header.startswith(TIFF_BE_SIGNATURE):
        return "TIFF"
    if header.startswith(BIG_TIFF_LE_SIGNATURE) or header.startswith(BIG_TIFF_BE_SIGNATURE):
        return "TIFF"
    if header.startswith(WEBP_RIFF_SIGNATURE) and header[8:12] == WEBP_WEBP_SIGNATURE:
        return "WEBP"
    return "UNKNOWN"


def _safe_dpi(info: dict) -> tuple[float, float] | None:
    dpi = info.get("dpi")
    if not dpi:
        return None
    if isinstance(dpi, tuple) and len(dpi) >= 2:
        return float(dpi[0]), float(dpi[1])
    return None


def _has_alpha(img: Image.Image) -> bool:
    return img.mode in ("RGBA", "LA") or (
        img.mode == "P" and "transparency" in img.info
    )


def _normalize_mode(img: Image.Image, prefer_alpha: bool = True) -> tuple[Image.Image, OutputMode]:
    img = ImageOps.exif_transpose(img)

    if prefer_alpha:
        return img.convert("RGBA"), "RGBA"
    return img.convert("RGB"), "RGB"


def inspect_image(path: str | Path) -> dict[str, object]:
    path = Path(path)
    detected_format = detect_format_from_magic(path)
    declared_mime_type, _ = mimetypes.guess_type(path.name)

    try:
        with Image.open(path) as img:
            return {
                "source_path": str(path),
                "source_extension": path.suffix.lower(),
                "declared_mime_type": declared_mime_type,
                "detected_format": detected_format,
                "pillow_format": img.format,
                "source_mode": img.mode,
                "width": img.width,
                "height": img.height,
                "dpi": _safe_dpi(img.info),
                "frame_count": getattr(img, "n_frames", 1),
                "is_false_extension": declared_mime_type is not None
                and not declared_mime_type.lower().endswith(detected_format.lower())
                and detected_format != "UNKNOWN",
            }
    except UnidentifiedImageError as exc:
        raise NormalizationError(f"Unsupported or unreadable image: {path}") from exc


_SUBPROCESS_NORMALIZE_SCRIPT = """
import json
import sys
from PIL import Image, ImageOps

src = sys.argv[1]
output_path = sys.argv[2]
frame_index = int(sys.argv[3])
prefer_alpha = sys.argv[4] == '1'

def has_alpha(img):
    return img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info)

def safe_dpi(info):
    dpi = info.get('dpi')
    if isinstance(dpi, tuple) and len(dpi) >= 2:
        return [float(dpi[0]), float(dpi[1])]
    return None

with Image.open(src) as img:
    frame_count = getattr(img, 'n_frames', 1)
    if frame_index < 0 or frame_index >= frame_count:
        raise RuntimeError(f'frame_index {frame_index} out of range for {src} (frame_count={frame_count})')
    if frame_count > 1:
        img.seek(frame_index)
    had_alpha = has_alpha(img)
    normalized = ImageOps.exif_transpose(img).convert('RGBA' if prefer_alpha else 'RGB')
    output_mode = normalized.mode
    dpi = safe_dpi(img.info)
    if dpi:
        normalized.save(output_path, format='PNG', optimize=True, dpi=tuple(dpi))
    else:
        normalized.save(output_path, format='PNG', optimize=True)
    print(json.dumps({
        'pillow_format': img.format,
        'source_mode': img.mode,
        'width': normalized.width,
        'height': normalized.height,
        'dpi': dpi,
        'frame_count': frame_count,
        'had_alpha': had_alpha,
        'output_mode': output_mode,
    }))
"""


def normalize_to_png(
    src: str | Path,
    out_dir: str | Path,
    output_name: str | None = None,
    frame_index: int = 0,
    prefer_alpha: bool = True,
    decode_timeout_seconds: float = 5.0,
) -> NormalizedImageMeta:
    src = Path(src)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    detected_format = detect_format_from_magic(src)
    declared_mime_type, _ = mimetypes.guess_type(src.name)
    warnings: list[str] = []

    if detected_format == "UNKNOWN":
        raise NormalizationError(f"Unsupported image signature: {src}")

    output_stem = output_name or src.stem
    output_path = out_dir / f"{output_stem}.png"

    if declared_mime_type and detected_format != "UNKNOWN":
        expected_mime_suffix = detected_format.lower()
        if not declared_mime_type.lower().endswith(expected_mime_suffix):
            warnings.append(
                f"Declared mime type {declared_mime_type} does not match detected format {detected_format}."
            )

    try:
        process = subprocess.run(
            [
                sys.executable,
                "-c",
                _SUBPROCESS_NORMALIZE_SCRIPT,
                str(src),
                str(output_path),
                str(frame_index),
                "1" if prefer_alpha else "0",
            ],
            capture_output=True,
            text=True,
            timeout=decode_timeout_seconds,
        )
    except subprocess.TimeoutExpired as exc:
        if output_path.exists():
            output_path.unlink(missing_ok=True)
        raise NormalizationError(
            f"Timed out while decoding {src}. This TIFF may require a fallback decoder such as tifffile/imagecodecs, or a true PNG export."
        ) from exc

    if process.returncode != 0:
        if output_path.exists():
            output_path.unlink(missing_ok=True)
        raise NormalizationError(
            f"Failed to decode {src}. This TIFF may require a fallback decoder such as tifffile/imagecodecs, or a true PNG export. Details: {process.stderr.strip() or process.stdout.strip() or 'no decoder output'}"
        )

    stdout = process.stdout.strip()
    if not stdout:
        if output_path.exists():
            output_path.unlink(missing_ok=True)
        raise NormalizationError(
            f"Failed to decode {src} without decoder output. This TIFF may require a fallback decoder such as tifffile/imagecodecs, or a true PNG export."
        )

    result = json.loads(stdout)

    frame_count = int(result["frame_count"])
    if frame_count > 1:
        warnings.append(f"Multi-frame image detected; selected frame {frame_index} of {frame_count}.")

    return NormalizedImageMeta(
        source_path=str(src),
        source_extension=src.suffix.lower(),
        declared_mime_type=declared_mime_type,
        detected_format=detected_format,
        pillow_format=str(result["pillow_format"]) if result["pillow_format"] is not None else None,
        source_mode=str(result["source_mode"]),
        width=int(result["width"]),
        height=int(result["height"]),
        dpi=result["dpi"],
        frame_count=frame_count,
        selected_frame=frame_index,
        had_alpha=bool(result["had_alpha"]),
        output_mode=result["output_mode"],
        output_path=str(output_path),
        warnings=warnings,
    )


def normalize_image(
    src: str | Path,
    out_dir: str | Path,
    output_name: str | None = None,
    frame_index: int = 0,
    prefer_alpha: bool = True,
) -> dict[str, object]:
    return asdict(
        normalize_to_png(
            src=src,
            out_dir=out_dir,
            output_name=output_name,
            frame_index=frame_index,
            prefer_alpha=prefer_alpha,
        )
    )


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Normalize TIFF/PNG/JPEG-like inputs into PNG.")
    parser.add_argument("--src", required=True, help="Input image path")
    parser.add_argument("--out-dir", required=True, help="Directory for normalized PNG output")
    parser.add_argument("--output-name", default=None, help="Optional output stem without extension")
    parser.add_argument("--frame-index", type=int, default=0, help="Frame index for multi-frame TIFF/GIF")
    parser.add_argument(
        "--rgb-only",
        action="store_true",
        help="Convert to RGB instead of RGBA",
    )
    return parser


def main() -> None:
    parser = _build_arg_parser()
    args = parser.parse_args()

    meta = normalize_image(
        src=args.src,
        out_dir=args.out_dir,
        output_name=args.output_name,
        frame_index=args.frame_index,
        prefer_alpha=not args.rgb_only,
    )
    print(json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
