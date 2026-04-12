from __future__ import annotations

import unittest

from python.backend.prompt_analysis import analyze_prompt


class PromptAnalysisTests(unittest.TestCase):
    def test_fallback_analysis_extracts_entities_and_relations(self) -> None:
        response = analyze_prompt(
            request_id="req_prompt_test",
            prompt="Sepsis inhibits kidney repair and leads to inflammation",
            preferred_language="en",
        )

        self.assertEqual(response.mode, "fallback")
        self.assertGreaterEqual(len(response.entities), 2)
        self.assertGreaterEqual(len(response.relations), 1)
        self.assertIn(response.relations[0].semantics, {"inhibit", "flows_to", "associate"})

    def test_analysis_matches_library_items(self) -> None:
        response = analyze_prompt(
            request_id="req_prompt_library",
            prompt="Kidney injury triggers mitochondrial stress",
            preferred_language="en",
        )

        matched_ids = {entity.libraryItemId for entity in response.entities if entity.libraryItemId}
        self.assertIn("kidney-clean", matched_ids)
        self.assertIn("mitochondria", matched_ids)


if __name__ == "__main__":
    unittest.main()
