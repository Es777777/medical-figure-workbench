from __future__ import annotations

import hashlib
import http.cookiejar
import io
import json
import mimetypes
import re
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from functools import lru_cache
from html import unescape
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

from PIL import Image


USER_AGENT = "MedicalFigureWorkbench/0.1 (+https://localhost)"
GITHUB_ACCEPT_HEADER = "application/vnd.github+json"
SERVIER_LICENSE = "CC BY 4.0"
SERVIER_ATTRIBUTION = "Servier Medical Art"
CDC_PHIL_LICENSE = "Use per CDC PHIL terms"
CDC_PHIL_ATTRIBUTION = "CDC PHIL"


def _make_request(url: str, accept: str | None = None, data: bytes | None = None) -> urllib.request.Request:
    headers = {"User-Agent": USER_AGENT}
    if accept:
        headers["Accept"] = accept
    return urllib.request.Request(url, headers=headers, data=data)


def _fetch_text(url: str, accept: str | None = None, data: bytes | None = None, opener: Any | None = None) -> str:
    open_fn = opener.open if opener else urllib.request.urlopen
    with open_fn(_make_request(url, accept=accept, data=data), timeout=30) as response:
        return response.read().decode("utf-8", "ignore")


def _fetch_bytes(url: str, accept: str | None = None, data: bytes | None = None, opener: Any | None = None) -> tuple[bytes, str | None]:
    open_fn = opener.open if opener else urllib.request.urlopen
    with open_fn(_make_request(url, accept=accept, data=data), timeout=45) as response:
        content_type = response.headers.get("content-type")
        return response.read(), content_type


def _fetch_json(url: str, accept: str | None = None) -> dict[str, Any]:
    return json.loads(_fetch_text(url, accept=accept))


def _strip_tags(value: str | None) -> str:
    if not value:
        return ""

    no_tags = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", unescape(no_tags)).strip()


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return normalized.encode("ascii", "ignore").decode("ascii")


def _slugify(value: str) -> str:
    normalized = _normalize_text(value).lower()
    slug = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    return slug or "resource"


def _title_from_slug(value: str) -> str:
    title = re.sub(r"[_\-]+", " ", value).strip()
    return title.title() if title else "Resource"


def _guess_mime_type(url: str, fallback: str | None = None) -> str:
    guessed, _ = mimetypes.guess_type(url)
    return guessed or fallback or "application/octet-stream"


def _guess_extension(url: str, mime_type: str | None = None) -> str:
    suffix = Path(urllib.parse.urlparse(url).path).suffix.lower()
    if suffix:
        return suffix

    if mime_type:
        guessed = mimetypes.guess_extension(mime_type.split(";")[0].strip())
        if guessed:
            return guessed

    return ".bin"


def _score_query(query: str, *fields: str) -> int:
    query_tokens = [token for token in re.split(r"\s+", query.lower()) if token]
    haystack = " ".join(field.lower() for field in fields if field)
    score = 0

    for token in query_tokens:
        if token in haystack:
            score += 4
    if haystack.startswith(query.lower()):
        score += 3
    return score


def _dedupe_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []

    for item in items:
        key = item.get("sourcePageUrl") or item.get("assetUrl") or item["id"]
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)

    return unique


def _sanitize_servier_result_html(html: str) -> list[str]:
    return re.findall(r"<article class=\"result-thumbnail.*?</article>", html, flags=re.IGNORECASE | re.DOTALL)


def _extract_first(pattern: str, text: str) -> str | None:
    match = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
    return match.group(1).strip() if match else None


def _extract_hidden_inputs(html: str) -> dict[str, str]:
    hidden_inputs: dict[str, str] = {}
    for name, value in re.findall(
        r'<input[^>]+type="hidden"[^>]+name="([^"]+)"[^>]+value="([^"]*)"',
        html,
        flags=re.IGNORECASE,
    ):
        hidden_inputs[name] = unescape(value)
    return hidden_inputs


def _build_cookie_opener() -> Any:
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def _truncate_text(value: str, limit: int) -> str:
    cleaned = re.sub(r"\s+", " ", value).strip()
    if len(cleaned) <= limit:
        return cleaned

    clipped = cleaned[: max(limit - 3, 1)].rsplit(" ", 1)[0].strip()
    return f"{clipped or cleaned[: max(limit - 3, 1)]}..."


def _build_cdc_phil_title(pid: str, caption: str) -> str:
    cleaned = _strip_tags(caption)
    for prefix in (
        "This historic image shows ",
        "This image shows ",
        "This historic illustration depicts ",
        "This illustration depicts ",
        "This photograph depicts ",
        "This image depicts ",
    ):
        if cleaned.lower().startswith(prefix.lower()):
            cleaned = cleaned[len(prefix) :].strip()
            break

    sentence = re.split(r"(?<=[.!?])\s+", cleaned, maxsplit=1)[0].strip().rstrip(".")
    return _truncate_text(sentence or f"CDC PHIL {pid}", 88)


def _fetch_cdc_phil_detail_summary(detail_url: str, opener: Any | None = None) -> dict[str, str]:
    html = _fetch_text(detail_url, opener=opener)
    preview_url = _extract_first(r'id="imgURL2"[^>]+src="([^"]+)"', html) or _extract_first(r'id="imgURL1"[^>]+src="([^"]+)"', html) or ""
    description = _strip_tags(_extract_first(r'<span id="lblDesc">.*?<br ?/>(.*?)</span>', html))
    provider = _strip_tags(_extract_first(r'<span id="lblContprov">(.*?)</span>', html))
    photo_credit = _strip_tags(_extract_first(r'<span id="lblPhotoCredit">(.*?)</span>', html))
    return {
        "previewUrl": urllib.parse.urljoin(detail_url, preview_url),
        "description": description,
        "provider": provider,
        "photoCredit": photo_credit,
    }


def _resolve_cdc_phil_download_url(detail_url: str) -> tuple[str, str | None]:
    opener = _build_cookie_opener()
    html = _fetch_text(detail_url, opener=opener)
    fallback_preview = _extract_first(r'id="imgURL2"[^>]+src="([^"]+)"', html) or _extract_first(r'id="imgURL1"[^>]+src="([^"]+)"', html)

    if 'id="hlHighResDownload"' not in html:
        preview_url = urllib.parse.urljoin(detail_url, fallback_preview or "")
        return preview_url, _guess_mime_type(preview_url, "image/jpeg")

    fields = _extract_hidden_inputs(html)
    fields["__EVENTTARGET"] = "ctl00$contentArea2$ucDetails$hlHighResDownload"
    fields["__EVENTARGUMENT"] = ""
    fields["__LASTFOCUS"] = ""
    payload = urllib.parse.urlencode(fields).encode("utf-8")

    with opener.open(_make_request(detail_url, data=payload), timeout=45) as response:
        resolved_url = response.geturl()
        content_type = response.headers.get("content-type")

    if resolved_url.lower().endswith(".aspx") or (content_type and "text/html" in content_type.lower()):
        preview_url = urllib.parse.urljoin(detail_url, fallback_preview or "")
        return preview_url, _guess_mime_type(preview_url, "image/jpeg")

    return resolved_url, content_type


def _should_transcode_to_png(asset_url: str, mime_type: str) -> bool:
    suffix = Path(urllib.parse.urlparse(asset_url).path).suffix.lower()
    normalized_mime = mime_type.lower()
    return normalized_mime in {"image/tiff", "image/tif", "image/x-tiff"} or suffix in {".tif", ".tiff"}


def _transcode_payload_to_png(payload: bytes) -> bytes:
    with Image.open(io.BytesIO(payload)) as image:
        converted = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        output = io.BytesIO()
        converted.save(output, format="PNG")
        return output.getvalue()


def search_servier_resources(query: str, limit: int) -> list[dict[str, Any]]:
    search_url = f"https://smart.servier.com/?s={urllib.parse.quote(query)}&post_type=smart_image"
    html = _fetch_text(search_url)
    items: list[dict[str, Any]] = []

    for block in _sanitize_servier_result_html(html):
        source_page_url = _extract_first(r"<a class=\"result-thumbnail-image\" href=\"([^\"]+)\"", block)
        preview_url = _extract_first(r"<img[^>]+src=\"([^\"]+)\"", block)
        title = _strip_tags(_extract_first(r"<h3>\s*<a[^>]+>(.*?)</a>", block))
        category = _strip_tags(_extract_first(r"<p>\s*<a[^>]+title=\"[^\"]*\">(.*?)</a>", block))
        asset_url = _extract_first(r"<a download href=\"([^\"]+\.(?:png|svg|jpg|jpeg|webp))\"", block)
        if not source_page_url or not preview_url or not title or not asset_url:
            continue

        score = _score_query(query, title, category)
        if score <= 0:
            continue

        items.append(
            {
                "id": f"servier:{hashlib.sha1(source_page_url.encode('utf-8')).hexdigest()[:12]}",
                "providerId": "servier",
                "providerLabel": "Servier Medical Art",
                "title": title,
                "description": category,
                "previewUrl": preview_url,
                "sourcePageUrl": source_page_url,
                "assetUrl": asset_url,
                "mimeType": _guess_mime_type(asset_url, "image/png"),
                "license": SERVIER_LICENSE,
                "attribution": SERVIER_ATTRIBUTION,
                "tags": [tag for tag in [category] if tag],
                "_score": score,
            }
        )

    items.sort(key=lambda item: (-int(item["_score"]), item["title"]))
    return _dedupe_items(items)[:limit]


@lru_cache(maxsize=1)
def load_bioicons_index() -> list[dict[str, str]]:
    response = _fetch_json(
        "https://api.github.com/repos/duerrsimon/bioicons/git/trees/main?recursive=1",
        accept=GITHUB_ACCEPT_HEADER,
    )
    entries: list[dict[str, str]] = []

    for item in response.get("tree", []):
        path = item.get("path", "")
        if not path.startswith("static/icons/") or not path.lower().endswith(".svg"):
            continue

        parts = path.split("/")
        if len(parts) < 6:
            continue

        license_name = parts[2]
        category = parts[3]
        author = parts[4]
        filename = Path(parts[-1]).stem
        entries.append(
            {
                "path": path,
                "license": license_name.replace("-", " ").upper(),
                "category": category.replace("_", " "),
                "author": author.replace("-", " "),
                "title": _title_from_slug(filename),
                "assetUrl": f"https://raw.githubusercontent.com/duerrsimon/bioicons/main/{path}",
                "sourcePageUrl": f"https://github.com/duerrsimon/bioicons/blob/main/{path}",
            }
        )

    return entries


def search_bioicons_resources(query: str, limit: int) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    normalized_query = query.strip().lower()
    if not normalized_query:
        return items

    for entry in load_bioicons_index():
        score = _score_query(normalized_query, entry["title"], entry["category"], entry["author"], entry["path"])
        if score <= 0:
            continue

        items.append(
            {
                "id": f"bioicons:{hashlib.sha1(entry['path'].encode('utf-8')).hexdigest()[:12]}",
                "providerId": "bioicons",
                "providerLabel": "Bioicons",
                "title": entry["title"],
                "description": f"{entry['category']} / {entry['author']}",
                "previewUrl": entry["assetUrl"],
                "sourcePageUrl": entry["sourcePageUrl"],
                "assetUrl": entry["assetUrl"],
                "mimeType": "image/svg+xml",
                "license": entry["license"],
                "attribution": entry["author"],
                "tags": [entry["category"], entry["author"]],
                "_score": score,
            }
        )

    items.sort(key=lambda item: (-int(item["_score"]), item["title"]))
    return items[:limit]


def search_cdc_phil_resources(query: str, limit: int) -> list[dict[str, Any]]:
    opener = _build_cookie_opener()
    search_url = "https://wwwn.cdc.gov/phil/QuickSearch.aspx"
    initial_html = _fetch_text(search_url, opener=opener)
    fields = _extract_hidden_inputs(initial_html)
    fields["__EVENTTARGET"] = ""
    fields["__EVENTARGUMENT"] = ""
    fields["__LASTFOCUS"] = ""
    fields["ctl00$contentArea2$ucQuickSearch$txtQuickKeywords"] = query
    fields["ctl00$contentArea2$ucQuickSearch$bntSearch"] = "Search"
    fields["ctl00$contentArea2$ucQuickSearch$chkTypes$chkTypes_0"] = "Photo"
    fields["ctl00$contentArea2$ucQuickSearch$chkTypes$chkTypes_1"] = "Illustrations"

    search_html = _fetch_text(search_url, data=urllib.parse.urlencode(fields).encode("utf-8"), opener=opener)
    results: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for detail_href, pid, thumb_url in re.findall(
        r'href="(Details\.aspx\?pid=(\d+))".*?<img[^>]+src=[\'"]([^\'"]+)[\'"]',
        search_html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        if pid in seen_ids:
            continue
        seen_ids.add(pid)

        detail_url = urllib.parse.urljoin(search_url, detail_href)
        try:
            detail_summary = _fetch_cdc_phil_detail_summary(detail_url, opener=opener)
        except Exception:
            detail_summary = {
                "previewUrl": urllib.parse.urljoin(search_url, thumb_url),
                "description": f"CDC PHIL image {pid}",
                "provider": "CDC PHIL",
                "photoCredit": "",
            }

        description = detail_summary["description"] or f"CDC PHIL image {pid}"
        title = _build_cdc_phil_title(pid, description)
        preview_url = detail_summary["previewUrl"] or urllib.parse.urljoin(search_url, thumb_url)
        score = _score_query(query, title, description, detail_summary["provider"], detail_summary["photoCredit"])
        if score <= 0:
            score = 1

        results.append(
            {
                "id": f"cdc-phil:{pid}",
                "providerId": "cdc-phil",
                "providerLabel": "CDC PHIL",
                "title": title,
                "description": _truncate_text(description, 220),
                "previewUrl": preview_url,
                "sourcePageUrl": detail_url,
                "assetUrl": detail_url,
                "mimeType": "image/tiff",
                "license": CDC_PHIL_LICENSE,
                "attribution": detail_summary["photoCredit"] or detail_summary["provider"] or CDC_PHIL_ATTRIBUTION,
                "tags": [tag for tag in [detail_summary["provider"], f"PHIL {pid}"] if tag],
                "_score": score,
            }
        )

        if len(results) >= limit:
            break

    results.sort(key=lambda item: (-int(item["_score"]), item["title"]))
    return results[:limit]


def _wikimedia_api_url(query: str, limit: int) -> str:
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": query,
        "gsrnamespace": "6",
        "gsrlimit": str(limit),
        "prop": "imageinfo|info",
        "iiprop": "url|extmetadata",
        "iiurlwidth": "420",
        "inprop": "url",
        "format": "json",
        "origin": "*",
    }
    return f"https://commons.wikimedia.org/w/api.php?{urllib.parse.urlencode(params)}"


def search_wikimedia_resources(query: str, limit: int) -> list[dict[str, Any]]:
    data = _fetch_json(_wikimedia_api_url(query, limit))
    pages = data.get("query", {}).get("pages", {})
    items: list[dict[str, Any]] = []

    for page in pages.values():
        imageinfo = (page.get("imageinfo") or [{}])[0]
        metadata = imageinfo.get("extmetadata", {})
        title = _strip_tags(metadata.get("ObjectName", {}).get("value")) or _strip_tags(page.get("title"))
        description = _strip_tags(metadata.get("ImageDescription", {}).get("value"))
        asset_url = imageinfo.get("url")
        preview_url = imageinfo.get("thumburl") or asset_url
        source_page_url = page.get("fullurl") or imageinfo.get("descriptionurl")
        if not title or not asset_url or not preview_url or not source_page_url:
            continue

        license_name = _strip_tags(metadata.get("LicenseShortName", {}).get("value")) or "Varies"
        attribution = _strip_tags(metadata.get("Artist", {}).get("value")) or "Wikimedia Commons"
        score = _score_query(query, title, description)
        if asset_url.lower().endswith(".svg"):
            score += 2

        items.append(
            {
                "id": f"wikimedia:{page.get('pageid')}",
                "providerId": "wikimedia",
                "providerLabel": "Wikimedia Commons",
                "title": title.replace("File:", "").strip(),
                "description": description,
                "previewUrl": preview_url,
                "sourcePageUrl": source_page_url,
                "assetUrl": asset_url,
                "mimeType": _guess_mime_type(asset_url, "image/png"),
                "license": license_name,
                "attribution": attribution,
                "tags": [],
                "_score": score,
            }
        )

    items.sort(key=lambda item: (-int(item["_score"]), item["title"]))
    return items[:limit]


def search_external_resources(query: str, limit: int = 12) -> tuple[list[dict[str, Any]], list[str]]:
    cleaned_query = query.strip()
    if not cleaned_query:
        return [], []

    provider_limit = max(3, limit // 4 + 1)
    items: list[dict[str, Any]] = []
    warnings: list[str] = []

    for provider_name, provider_search in (
        ("Servier Medical Art", search_servier_resources),
        ("Bioicons", search_bioicons_resources),
        ("CDC PHIL", search_cdc_phil_resources),
        ("Wikimedia Commons", search_wikimedia_resources),
    ):
        try:
            items.extend(provider_search(cleaned_query, provider_limit))
        except Exception as exc:
            warnings.append(f"{provider_name} search failed: {exc}")

    deduped = _dedupe_items(items)
    deduped.sort(key=lambda item: (-int(item.get("_score", 0)), item["providerLabel"], item["title"]))

    final_items: list[dict[str, Any]] = []
    for item in deduped[:limit]:
        sanitized = dict(item)
        sanitized.pop("_score", None)
        final_items.append(sanitized)

    return final_items, warnings


def _parse_svg_dimension(value: str | None) -> float | None:
    if not value:
        return None

    match = re.match(r"([0-9]+(?:\.[0-9]+)?)", value)
    if not match:
        return None
    return float(match.group(1))


def _resolve_svg_dimensions(path: Path) -> tuple[int, int]:
    root = ElementTree.fromstring(path.read_text(encoding="utf-8"))
    width = _parse_svg_dimension(root.attrib.get("width"))
    height = _parse_svg_dimension(root.attrib.get("height"))
    if width and height:
        return max(round(width), 1), max(round(height), 1)

    view_box = root.attrib.get("viewBox")
    if view_box:
        parts = [part for part in re.split(r"[,\s]+", view_box) if part]
        if len(parts) == 4:
            try:
                return max(round(float(parts[2])), 1), max(round(float(parts[3])), 1)
            except ValueError:
                pass

    return 320, 220


def _resolve_image_dimensions(path: Path, mime_type: str) -> tuple[int, int]:
    if mime_type == "image/svg+xml" or path.suffix.lower() == ".svg":
        return _resolve_svg_dimensions(path)

    with Image.open(path) as image:
        width, height = image.size
        return max(width, 1), max(height, 1)


def import_external_resource(item: dict[str, Any], assets_root: Path) -> dict[str, Any]:
    original_asset_url = item.get("assetUrl")
    if not isinstance(original_asset_url, str) or not original_asset_url:
        raise ValueError("assetUrl is required for import")

    provider_id = str(item.get("providerId") or "external")
    title = str(item.get("title") or "Resource")
    asset_url = original_asset_url

    if provider_id == "cdc-phil":
        detail_url = str(item.get("sourcePageUrl") or original_asset_url)
        resolved_url, resolved_content_type = _resolve_cdc_phil_download_url(detail_url)
        asset_url = resolved_url
        mime_type = _guess_mime_type(asset_url, (resolved_content_type or "image/tiff").split(";")[0].strip())
    else:
        mime_type = _guess_mime_type(asset_url, str(item.get("mimeType") or "image/png"))

    extension = ".png" if _should_transcode_to_png(asset_url, mime_type) else _guess_extension(asset_url, mime_type)
    digest = hashlib.sha1(asset_url.encode("utf-8")).hexdigest()[:12]

    target_dir = assets_root / "external"
    target_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{_slugify(provider_id)}_{_slugify(title)}_{digest}{extension}"
    target_path = target_dir / file_name
    metadata_path = target_dir / f"{Path(file_name).stem}.meta.json"

    if not target_path.exists():
        payload, response_content_type = _fetch_bytes(asset_url)
        if response_content_type:
            mime_type = _guess_mime_type(asset_url, response_content_type.split(";")[0].strip())
        if _should_transcode_to_png(asset_url, mime_type):
            payload = _transcode_payload_to_png(payload)
            mime_type = "image/png"
        target_path.write_bytes(payload)

    if target_path.suffix.lower() == ".png" and mime_type != "image/svg+xml":
        mime_type = "image/png"

    width, height = _resolve_image_dimensions(target_path, mime_type)

    metadata = {
        "providerId": provider_id,
        "providerLabel": item.get("providerLabel"),
        "title": title,
        "sourcePageUrl": item.get("sourcePageUrl"),
        "assetUrl": asset_url,
        "license": item.get("license"),
        "attribution": item.get("attribution"),
        "importedAt": datetime.now(timezone.utc).isoformat(),
        "mimeType": mime_type,
        "width": width,
        "height": height,
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "providerId": provider_id,
        "providerLabel": item.get("providerLabel") or provider_id,
        "title": title,
        "assetUri": f"/assets/external/{file_name}",
        "previewUri": f"/assets/external/{file_name}",
        "mimeType": mime_type,
        "width": width,
        "height": height,
        "sourcePageUrl": item.get("sourcePageUrl"),
        "license": item.get("license"),
        "attribution": item.get("attribution"),
    }
