from __future__ import annotations

import unittest

from python.backend.reconstruction import reconstruct_figure


class ReconstructionTests(unittest.TestCase):
    def test_reconstruction_flags_missing_nodes_and_relations(self) -> None:
        scene = {
            "nodes": [
                {"id": "text_1", "type": "text", "name": "Sepsis", "text": "Sepsis"},
                {"id": "arrow_1", "type": "arrow", "semantics": "associate"},
            ]
        }

        response = reconstruct_figure(
            request_id="req_reconstruct_test",
            prompt="Sepsis inhibits kidney repair",
            scene=scene,
            preferred_language="en",
            problem_notes="Missing kidney branch",
        )

        issue_codes = {issue.code for issue in response.issues}
        self.assertIn("missing_node", issue_codes)
        self.assertIn("missing_relation", issue_codes)


if __name__ == "__main__":
    unittest.main()
