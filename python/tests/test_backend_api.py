from __future__ import annotations

import json
import tempfile
import unittest
import importlib
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

BACKEND_MAIN = importlib.import_module("python.backend.main")
BACKEND_STORE = importlib.import_module("python.backend.store")

app = BACKEND_MAIN.app
store = BACKEND_STORE.store


ROOT = Path(__file__).resolve().parents[2]
FALSE_PNG_ASSET = ROOT / "Graphical Abstract Image - 副本.png"
EXAMPLE_COMPOSE_REQUEST = ROOT / "examples" / "minimal-compose-request.json"


class BackendApiTests(unittest.TestCase):
    def setUp(self) -> None:
        store.reset()
        self.client = TestClient(app)

    def test_healthz(self) -> None:
        response = self.client.get("/healthz")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_normalize_asset_success(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "synthetic.tif"
            out_dir = Path(tmpdir) / "normalized"
            Image.new("RGB", (80, 40), color=(255, 255, 255)).save(src, format="TIFF")

            response = self.client.post(
                "/normalize-asset",
                json={
                    "requestId": "req_norm_001",
                    "sourcePath": str(src),
                    "outputDir": str(out_dir),
                    "outputName": "normalized_asset",
                    "frameIndex": 0,
                    "preferAlpha": True,
                },
            )

            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertTrue(payload["documentId"].startswith("doc_"))
            self.assertEqual(payload["source"]["originalDetectedFormat"], "TIFF")
            self.assertEqual(payload["source"]["normalizedMimeType"], "image/png")
            self.assertEqual(payload["source"]["width"], 80)
            self.assertEqual(payload["source"]["height"], 40)

    def test_normalize_asset_false_png_returns_actionable_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            response = self.client.post(
                "/normalize-asset",
                json={
                    "requestId": "req_norm_002",
                    "sourcePath": str(FALSE_PNG_ASSET),
                    "outputDir": str(Path(tmpdir) / "normalized"),
                    "frameIndex": 0,
                    "preferAlpha": True,
                },
            )

            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()["error"]["code"], "contract_violation")
            self.assertIn("fallback decoder", response.json()["error"]["message"])

    def test_analyze_compose_regenerate_and_export_flow(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "synthetic.tif"
            out_dir = Path(tmpdir) / "normalized"
            Image.new("RGB", (120, 60), color=(255, 255, 255)).save(src, format="TIFF")

            normalize_response = self.client.post(
                "/normalize-asset",
                json={
                    "requestId": "req_norm_flow",
                    "sourcePath": str(src),
                    "outputDir": str(out_dir),
                    "outputName": "flow_asset",
                    "frameIndex": 0,
                    "preferAlpha": True,
                },
            )
            self.assertEqual(normalize_response.status_code, 200)
            normalized_payload = normalize_response.json()
            document_id = normalized_payload["documentId"]
            normalized_uri = normalized_payload["source"]["normalizedUri"]

            analyze_response = self.client.post(
                "/analyze-asset",
                json={
                    "requestId": "req_analyze_001",
                    "documentId": document_id,
                    "normalizedUri": normalized_uri,
                    "runOcr": True,
                    "detectRegions": True,
                    "detectConnectors": True,
                },
            )
            self.assertEqual(analyze_response.status_code, 200)
            analyze_payload = analyze_response.json()
            self.assertGreaterEqual(len(analyze_payload["draftNodes"]), 3)

            compose_payload = json.loads(EXAMPLE_COMPOSE_REQUEST.read_text(encoding="utf-8"))
            compose_payload["documentId"] = document_id
            compose_payload["scene"]["source"]["normalizedUri"] = normalized_uri
            compose_payload["scene"]["source"]["width"] = normalized_payload["source"]["width"]
            compose_payload["scene"]["source"]["height"] = normalized_payload["source"]["height"]

            compose_response = self.client.post("/compose-figure", json=compose_payload)
            self.assertEqual(compose_response.status_code, 200)
            self.assertTrue(compose_response.json()["accepted"])

            regenerate_response = self.client.post(
                "/regenerate-node",
                json={
                    "requestId": "req_regen_001",
                    "documentId": document_id,
                    "nodeId": "img_kidney_001",
                    "prompt": "simplify kidney icon",
                    "feedback": "上一版太复杂",
                    "constraints": {"keepPosition": True, "keepSize": True},
                },
            )
            self.assertEqual(regenerate_response.status_code, 200)
            self.assertEqual(len(regenerate_response.json()["variants"]), 4)
            self.assertEqual(regenerate_response.json()["variants"][0]["asset"]["mimeType"], "image/svg+xml")
            self.assertRegex(regenerate_response.json()["variants"][0]["asset"]["uri"], r"^/(generated|library)/.+\.svg$")

            export_response = self.client.post(
                "/export-scene",
                json={
                    "requestId": "req_export_001",
                    "documentId": document_id,
                    "scene": compose_payload["scene"],
                    "formats": ["svg", "json"],
                },
            )
            self.assertEqual(export_response.status_code, 200)
            export_payload = export_response.json()
            self.assertNotIn("pngUri", export_payload)
            self.assertTrue(export_payload["svgUri"].endswith(f"{document_id}.svg"))
            self.assertTrue(export_payload["jsonUri"].endswith(f"{document_id}.json"))

    def test_analyze_prompt_and_reconstruct_routes(self) -> None:
        analyze_response = self.client.post(
            "/analyze-prompt",
            json={
                "requestId": "req_prompt_route",
                "prompt": "Sepsis leads to inflammation and kidney injury",
                "preferredLanguage": "en",
            },
        )
        self.assertEqual(analyze_response.status_code, 200)
        analyze_payload = analyze_response.json()
        self.assertIn(analyze_payload["mode"], {"live", "fallback"})
        self.assertGreaterEqual(len(analyze_payload["entities"]), 2)

        reconstruct_response = self.client.post(
            "/reconstruct-figure",
            json={
                "requestId": "req_reconstruct_route",
                "prompt": "Sepsis inhibits kidney repair",
                "preferredLanguage": "en",
                "problemNotes": "Missing repair outcome.",
                "scene": json.loads(EXAMPLE_COMPOSE_REQUEST.read_text(encoding="utf-8"))["scene"],
            },
        )
        self.assertEqual(reconstruct_response.status_code, 200)
        reconstruct_payload = reconstruct_response.json()
        self.assertIn(reconstruct_payload["mode"], {"live", "fallback"})
        self.assertIn("issues", reconstruct_payload)

    def test_regenerate_rejects_non_image_node(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "synthetic.tif"
            out_dir = Path(tmpdir) / "normalized"
            Image.new("RGB", (120, 60), color=(255, 255, 255)).save(src, format="TIFF")

            normalize_response = self.client.post(
                "/normalize-asset",
                json={
                    "requestId": "req_norm_regen",
                    "sourcePath": str(src),
                    "outputDir": str(out_dir),
                },
            )
            document_id = normalize_response.json()["documentId"]
            normalized_uri = normalize_response.json()["source"]["normalizedUri"]

            compose_payload = json.loads(EXAMPLE_COMPOSE_REQUEST.read_text(encoding="utf-8"))
            compose_payload["documentId"] = document_id
            compose_payload["scene"]["source"]["normalizedUri"] = normalized_uri
            compose_payload["scene"]["source"]["width"] = normalize_response.json()["source"]["width"]
            compose_payload["scene"]["source"]["height"] = normalize_response.json()["source"]["height"]

            compose_response = self.client.post("/compose-figure", json=compose_payload)
            self.assertEqual(compose_response.status_code, 200)

            regenerate_response = self.client.post(
                "/regenerate-node",
                json={
                    "requestId": "req_regen_text",
                    "documentId": document_id,
                    "nodeId": "text_aki_001",
                    "prompt": "change text node somehow",
                },
            )
            self.assertEqual(regenerate_response.status_code, 400)
            self.assertEqual(regenerate_response.json()["error"]["code"], "contract_violation")


if __name__ == "__main__":
    unittest.main()
