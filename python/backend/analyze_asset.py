from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps

from .models import DraftNodeModel, RectModel


@dataclass(slots=True)
class DetectedRegion:
    x: float
    y: float
    width: float
    height: float


def _clamp_region(region: DetectedRegion, width: int, height: int) -> DetectedRegion:
    x = max(int(region.x), 0)
    y = max(int(region.y), 0)
    safe_width = max(min(int(region.width), width - x), 1)
    safe_height = max(min(int(region.height), height - y), 1)
    return DetectedRegion(x=x, y=y, width=safe_width, height=safe_height)


def _pixel_darkness(image: Image.Image, x: int, y: int) -> float:
    raw_pixel = image.getpixel((x, y))
    if isinstance(raw_pixel, tuple):
        channels = list(raw_pixel)
    elif raw_pixel is None:
        channels = [0, 0, 0]
    else:
        channels = [int(raw_pixel), int(raw_pixel), int(raw_pixel)]
    red = int(channels[0])
    green = int(channels[1] if len(channels) > 1 else channels[0])
    blue = int(channels[2] if len(channels) > 2 else channels[0])
    luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
    return 1 - luminance


def _axis_profile(image: Image.Image, region: DetectedRegion, axis: str) -> list[float]:
    values: list[float] = []
    step = max(int((region.height if axis == "vertical" else region.width) / 180), 1)
    if axis == "vertical":
        for x in range(int(region.x), int(region.x + region.width)):
            total = 0.0
            count = 0
            for y in range(int(region.y), int(region.y + region.height), step):
                total += _pixel_darkness(image, x, y)
                count += 1
            values.append(total / count if count else 0.0)
        return values

    for y in range(int(region.y), int(region.y + region.height)):
        total = 0.0
        count = 0
        for x in range(int(region.x), int(region.x + region.width), step):
            total += _pixel_darkness(image, x, y)
            count += 1
        values.append(total / count if count else 0.0)
    return values


def _best_whitespace_split(values: list[float], axis_length: float, cross_length: float, axis: str) -> tuple[str, int, int, float] | None:
    if len(values) < 160:
        return None

    mean = sum(values) / max(len(values), 1)
    threshold = max(0.012, min(0.055, mean * 0.42 + 0.008))
    edge_margin = max(round(axis_length * 0.05), 10)
    min_run = max(round(axis_length * 0.018), 8)
    min_panel = max(round(axis_length * 0.18), 96)
    best: tuple[str, int, int, float] | None = None
    run_start = -1

    def commit(run_end: int) -> None:
        nonlocal best, run_start
        if run_start == -1:
            return
        run_length = run_end - run_start
        split_center = round((run_start + run_end) / 2)
        left_size = split_center
        right_size = axis_length - split_center
        if (
            run_length < min_run
            or run_start <= edge_margin
            or run_end >= axis_length - edge_margin
            or left_size < min_panel
            or right_size < min_panel
        ):
            run_start = -1
            return

        average_darkness = sum(values[run_start:run_end]) / max(run_length, 1)
        whiteness = max(0.0, threshold - average_darkness) / threshold
        balance = min(left_size, right_size) / max(left_size, right_size)
        score = run_length * (0.7 + whiteness) * (0.75 + balance) * (1.08 if cross_length > axis_length else 1)
        candidate = (axis, run_start, run_end, score)
        if best is None or candidate[3] > best[3]:
            best = candidate
        run_start = -1

    for index, value in enumerate(values):
        if value <= threshold:
            if run_start == -1:
                run_start = index
        else:
            commit(index)

    commit(len(values))
    return best


def _split_region(region: DetectedRegion, split: tuple[str, int, int, float]) -> tuple[DetectedRegion, DetectedRegion]:
    axis, start, end, _ = split
    if axis == "vertical":
        return (
            DetectedRegion(region.x, region.y, start, region.height),
            DetectedRegion(region.x + end, region.y, region.width - end, region.height),
        )
    return (
        DetectedRegion(region.x, region.y, region.width, start),
        DetectedRegion(region.x, region.y + end, region.width, region.height - end),
    )


def _detect_regions(image: Image.Image, region: DetectedRegion, depth: int = 0) -> list[DetectedRegion]:
    if depth >= 3 or region.width < 192 or region.height < 192:
        return [region]
    vertical = _best_whitespace_split(_axis_profile(image, region, "vertical"), region.width, region.height, "vertical")
    horizontal = _best_whitespace_split(_axis_profile(image, region, "horizontal"), region.height, region.width, "horizontal")
    candidates = [candidate for candidate in (vertical, horizontal) if candidate is not None]
    if not candidates:
        return [region]
    best = sorted(candidates, key=lambda item: item[3], reverse=True)[0]
    if best[3] < 8:
        return [region]
    left, right = _split_region(region, best)
    return [*_detect_regions(image, left, depth + 1), *_detect_regions(image, right, depth + 1)]


def _sort_reading_order(regions: list[DetectedRegion]) -> list[DetectedRegion]:
    def sort_key(region: DetectedRegion) -> tuple[float, float]:
        return (round(region.y / 24), region.x)

    return sorted(regions, key=sort_key)


def _dedupe_regions(regions: list[DetectedRegion]) -> list[DetectedRegion]:
    unique: list[DetectedRegion] = []
    for region in regions:
        if any(
            abs(candidate.x - region.x) <= 4
            and abs(candidate.y - region.y) <= 4
            and abs(candidate.width - region.width) <= 4
            and abs(candidate.height - region.height) <= 4
            for candidate in unique
        ):
            continue
        unique.append(region)
    return unique


def _detect_text_band(image: Image.Image, region: DetectedRegion) -> DetectedRegion | None:
    profile = _axis_profile(image, region, "horizontal")
    if len(profile) < 24:
        return None
    max_value = max(profile) if profile else 0.0
    threshold = max(0.045, max_value * 0.62)
    best_start = -1
    best_end = -1
    run_start = -1
    for index, value in enumerate(profile):
        if value >= threshold:
            if run_start == -1:
                run_start = index
        elif run_start != -1:
            if index - run_start > best_end - best_start:
                best_start, best_end = run_start, index
            run_start = -1
    if run_start != -1 and len(profile) - run_start > best_end - best_start:
        best_start, best_end = run_start, len(profile)
    if best_start == -1 or best_end - best_start < 10:
        return None
    band_height = min(max(best_end - best_start + 8, 18), int(region.height * 0.28))
    return _clamp_region(
        DetectedRegion(region.x + 8, region.y + best_start, max(region.width - 16, 1), band_height),
        image.width,
        image.height,
    )


def _fallback_text_band(region: DetectedRegion, image_width: int, image_height: int) -> DetectedRegion:
    return _clamp_region(
        DetectedRegion(
            region.x + max(region.width * 0.06, 8),
            region.y + max(region.height * 0.05, 8),
            max(region.width * 0.48, 32),
            max(min(region.height * 0.12, 48), 18),
        ),
        image_width,
        image_height,
    )


def _detect_connector_between(source: DetectedRegion, target: DetectedRegion) -> DetectedRegion:
    start_x = source.x + source.width
    end_x = target.x
    center_y = source.y + source.height / 2
    target_center_y = target.y + target.height / 2
    return DetectedRegion(
        x=min(start_x, end_x),
        y=min(center_y, target_center_y),
        width=max(abs(end_x - start_x), 1),
        height=max(abs(target_center_y - center_y), 1),
    )


def _infer_connector_semantics(index: int, total: int) -> str:
    if total <= 1:
        return "associate"
    if index == total - 2:
        return "annotates"
    return "flows_to"


def _infer_image_label(index: int, total: int) -> str:
    if total == 1:
        return "main_figure_region"
    if index == 0:
        return "context_region"
    if index == total - 1:
        return "outcome_region"
    return "process_region"


def _append_text_draft(
    draft_nodes: list[DraftNodeModel],
    image: Image.Image,
    panel: DetectedRegion,
    width: int,
    height: int,
    index: int,
) -> None:
    text_band = _detect_text_band(image, panel)
    confidence = 0.61
    if text_band is None:
        text_band = _fallback_text_band(panel, width, height)
        confidence = 0.4

    draft_nodes.append(
        DraftNodeModel(
            id=f"draft_text_{index + 1:03d}",
            type="text",
            bbox=RectModel(x=text_band.x, y=text_band.y, width=text_band.width, height=text_band.height),
            confidence=confidence,
            text=f"Detected text band {index + 1}",
        )
    )


def analyze_normalized_asset(normalized_path: str | Path, run_ocr: bool, detect_regions: bool, detect_connectors: bool) -> tuple[list[DraftNodeModel], list[str]]:
    path = Path(normalized_path)
    with Image.open(path) as original:
        image = ImageOps.exif_transpose(original).convert("RGB")

    width, height = image.size
    full_region = DetectedRegion(0, 0, width, height)
    panel_regions = [full_region]
    warnings: list[str] = []

    if detect_regions:
        panel_regions = _sort_reading_order(_dedupe_regions(_detect_regions(image, full_region)))[:6]
        warnings.append(f"Heuristic region detection produced {len(panel_regions)} panel candidate(s).")

    draft_nodes: list[DraftNodeModel] = []
    for index, panel in enumerate(panel_regions):
        panel_rect = RectModel(x=panel.x, y=panel.y, width=panel.width, height=panel.height)
        draft_nodes.append(
            DraftNodeModel(
                id=f"draft_panel_{index + 1:03d}",
                type="panel",
                bbox=panel_rect,
                confidence=round(min(0.99, 0.72 + (panel.width * panel.height) / max(width * height, 1) * 0.2), 2),
                text=f"Panel {index + 1}",
            )
        )

        inset = _clamp_region(
            DetectedRegion(panel.x + 12, panel.y + 12, max(panel.width - 24, 1), max(panel.height - 24, 1)),
            width,
            height,
        )
        draft_nodes.append(
            DraftNodeModel(
                id=f"draft_image_{index + 1:03d}",
                type="image",
                bbox=RectModel(x=inset.x, y=inset.y, width=inset.width, height=inset.height),
                confidence=0.84,
                text=_infer_image_label(index, len(panel_regions)),
            )
        )

        if run_ocr:
            _append_text_draft(draft_nodes, image, panel, width, height, index)

    if detect_connectors and len(panel_regions) > 1:
        for index in range(len(panel_regions) - 1):
            connector = _detect_connector_between(panel_regions[index], panel_regions[index + 1])
            draft_nodes.append(
                DraftNodeModel(
                    id=f"draft_arrow_{index + 1:03d}",
                    type="arrow",
                    bbox=RectModel(x=connector.x, y=connector.y, width=max(connector.width, 1), height=max(connector.height, 1)),
                    confidence=0.57,
                    text=_infer_connector_semantics(index, len(panel_regions)),
                )
            )
        warnings.append("Connector detection used reading-order panel centers to draft relation guides.")

    if run_ocr:
        warnings.append("OCR in analyze-asset currently detects text regions heuristically; browser import provides actual OCR text extraction.")

    return draft_nodes, warnings
