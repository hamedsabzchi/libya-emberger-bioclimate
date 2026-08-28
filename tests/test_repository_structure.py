from __future__ import annotations

import ast
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "python" / "bioclimate_engine.py"
NOTEBOOK = ROOT / "python" / "02_full_bioclimate_colab.ipynb"
GEE_JS = ROOT / "gee" / "libya_emberger_bioclimatic_zoning.js"
README = ROOT / "README.md"


class RepositoryStructureTests(unittest.TestCase):
    def test_required_files_exist(self) -> None:
        for path in (ENGINE, NOTEBOOK, GEE_JS, README):
            self.assertTrue(path.is_file(), f"Missing required file: {path}")

    def test_python_engine_parses(self) -> None:
        source = ENGINE.read_text(encoding="utf-8")
        ast.parse(source)

    def test_engine_contains_required_functions(self) -> None:
        source = ENGINE.read_text(encoding="utf-8")
        tree = ast.parse(source)
        function_names = {
            node.name for node in tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }
        required = {
            "calculate_q2",
            "classify_q2",
            "classify_winter",
            "build_worldclim_product",
            "build_terraclimate_product",
            "build_era5_land_product",
            "build_chirps_era5_hybrid_product",
            "build_comparison",
            "run_scenario",
            "calculate_zone_area",
            "display_map",
            "export_zones",
            "export_q2",
            "export_climate_inputs",
            "export_comparison",
        }
        missing = sorted(required - function_names)
        self.assertFalse(missing, f"Missing required engine functions: {missing}")

    def test_engine_declares_all_five_scenarios(self) -> None:
        source = ENGINE.read_text(encoding="utf-8")
        for scenario in (1, 2, 3, 4, 5):
            self.assertIn(str(scenario), source)
        for dataset_id in (
            "WORLDCLIM/V1/MONTHLY",
            "IDAHO_EPSCOR/TERRACLIMATE",
            "ECMWF/ERA5_LAND/MONTHLY_AGGR",
            "UCSB-CHG/CHIRPS/DAILY",
        ):
            self.assertIn(dataset_id, source)

    def test_colab_notebook_is_valid_json(self) -> None:
        notebook = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
        self.assertEqual(notebook.get("nbformat"), 4)
        cells = notebook.get("cells", [])
        self.assertGreaterEqual(len(cells), 4)
        combined = "\n".join("".join(cell.get("source", [])) for cell in cells)
        self.assertIn("bio.run_scenario", combined)
        self.assertIn("bio.display_map", combined)
        self.assertIn("bio.export_zones", combined)

    def test_reference_gee_contains_expected_scientific_components(self) -> None:
        source = GEE_JS.read_text(encoding="utf-8")
        for expected in (
            "Emberger",
            "TerraClimate",
            "ERA5-Land",
            "CHIRPS",
            "WorldClim",
            "GeoTIFF",
        ):
            self.assertIn(expected, source)


if __name__ == "__main__":
    unittest.main()
