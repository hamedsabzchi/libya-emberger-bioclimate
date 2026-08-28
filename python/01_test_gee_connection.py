#!/usr/bin/env python3
"""
Minimal Google Earth Engine connection test for the Libya Emberger project.

This script verifies that Python can:
1. Authenticate and initialize Earth Engine.
2. Read the Libya boundary from FAO GAUL.
3. Access the TerraClimate ImageCollection.
4. Request small metadata results from Earth Engine servers.

It intentionally does not perform the full Bioclimate analysis yet.
"""

from __future__ import annotations

import argparse

import ee


LIBYA_BOUNDARY_DATASET = "FAO/GAUL/2015/level0"
TERRACLIMATE_DATASET = "IDAHO_EPSCOR/TERRACLIMATE"
DEFAULT_START_DATE = "1991-01-01"
DEFAULT_END_DATE = "2021-01-01"  # End date is exclusive: covers 1991-2020.


def initialize_earth_engine(project: str) -> None:
    """Initialize Earth Engine, authenticating interactively if needed."""
    try:
        ee.Initialize(project=project)
    except Exception:
        print("No valid Earth Engine session found. Starting Google authentication...")
        ee.Authenticate()
        ee.Initialize(project=project)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Test Python access to Google Earth Engine for the Libya Bioclimate project."
    )
    parser.add_argument(
        "--project",
        required=True,
        help="Google Cloud project ID registered for Earth Engine.",
    )
    args = parser.parse_args()

    print("1/4 Initializing Google Earth Engine...")
    initialize_earth_engine(args.project)

    print("2/4 Loading Libya boundary from FAO GAUL...")
    countries = ee.FeatureCollection(LIBYA_BOUNDARY_DATASET)
    libya_fc = countries.filter(ee.Filter.eq("ADM0_NAME", "Libya"))
    libya = libya_fc.geometry()

    country_name = libya_fc.first().get("ADM0_NAME").getInfo()
    if country_name != "Libya":
        raise RuntimeError("Libya boundary could not be verified.")

    print("3/4 Opening TerraClimate for 1991-2020...")
    terraclimate = (
        ee.ImageCollection(TERRACLIMATE_DATASET)
        .filterDate(DEFAULT_START_DATE, DEFAULT_END_DATE)
        .filterBounds(libya)
    )

    image_count = terraclimate.size().getInfo()
    if not image_count:
        raise RuntimeError("TerraClimate returned no images for Libya.")

    first_image = ee.Image(terraclimate.first())
    first_date = ee.Date(first_image.get("system:time_start")).format("YYYY-MM-dd").getInfo()
    bands = first_image.bandNames().getInfo()

    print("4/4 Earth Engine returned server-side metadata successfully.")
    print()
    print("SUCCESS: Python is connected to Google Earth Engine.")
    print(f"Boundary: {country_name}")
    print(f"TerraClimate collection: {TERRACLIMATE_DATASET}")
    print(f"Period tested: {DEFAULT_START_DATE} to 2020-12-31")
    print(f"Number of monthly images: {image_count}")
    print(f"First image date: {first_date}")
    print(f"Available bands ({len(bands)}): {', '.join(bands)}")
    print()
    print("Next step: reproduce the TerraClimate climate inputs and Emberger Q2 calculation in Python.")


if __name__ == "__main__":
    main()
