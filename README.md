# Libya Emberger Bioclimatic Zoning

A reproducible geospatial workflow for historical and recent bioclimatic zoning in Libya using the Emberger pluviothermic quotient (Q2), implemented in both Google Earth Engine JavaScript and Python.

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22151541.svg)](https://doi.org/10.5281/zenodo.22151541)

## Project status

The repository now contains:

- the complete reference Google Earth Engine JavaScript application;
- a complete Earth Engine Python analysis engine covering all five scenarios;
- a Google Colab notebook with interactive controls, maps, area statistics, and GeoTIFF exports;
- a minimal Earth Engine connection test;
- static repository tests that do not require Earth Engine credentials.

The Python workflow uses the Google Earth Engine Python API, so large geospatial computations are executed on Earth Engine infrastructure rather than downloaded and processed locally.

## Purpose

The workflow generates historical and recent bioclimatic zones for Libya and supports comparison across multiple climate datasets. It is intended for national and broad regional interpretation, sensitivity analysis, and reproducible climate-zoning workflows.

## Climate scenarios

1. **WorldClim historical reference** — fixed WorldClim V1 historical climatology for comparison with legacy bioclimatic maps.
2. **TerraClimate recent baseline** — recommended standard climate-normal period: 1991–2020.
3. **ERA5-Land updated recent zoning** — supports a standard 1991–2020 period and an extended recent period through 2025.
4. **TerraClimate + ERA5-Land comparison** — compares both datasets over one common period without averaging; exact agreement and class-difference layers are produced.
5. **CHIRPS + ERA5-Land agricultural hybrid** — uses CHIRPS precipitation with ERA5-Land temperature inputs.

## Main outputs

- Mean annual precipitation
- Maximum temperature of the hottest climatological month
- Minimum temperature of the coldest climatological month
- Emberger Q2 index
- Bioclimatic moisture zones
- Winter thermal variants
- Cross-dataset exact agreement and absolute class difference
- Q2 difference for Scenario 4
- Approximate class-area statistics
- Interactive maps in Colab
- GeoTIFF export tasks to Google Drive

## Method

The Emberger pluviothermic quotient is implemented as:

`Q2 = 2000 × P / (M² - m²)`

where:

- `P` = annual precipitation in millimetres
- `M` = mean maximum temperature of the hottest month in Kelvin
- `m` = mean minimum temperature of the coldest month in Kelvin

The workflow supports fixed user-defined Q2 thresholds for reproducible comparisons and an exploratory Libya-relative equal-frequency classification. Relative classes must not be interpreted as formal Emberger bioclimatic stages.

The default fixed thresholds are:

`20, 40, 60, 100, 140`

corresponding to six working moisture classes from Saharan/perarid to perhumid. These boundaries are user-defined working thresholds and should be reported explicitly and validated for operational or publication use.

## Important scientific limitation

These outputs are **bioclimatic zones, not complete agro-ecological zones (AEZs) or crop-suitability maps**. Soil, irrigation, land suitability, land capability, land use, water quality, crop requirements, and other agronomic constraints are not included.

Cross-dataset agreement is used as **sensitivity evidence**, not as ground-validation accuracy. Operational or publication use should be supported by independent climate-station or other appropriate validation where available.

## Repository structure

```text
libya-emberger-bioclimate/
├── README.md
├── CITATION.cff
├── .gitignore
├── gee/
│   └── libya_emberger_bioclimatic_zoning.js
├── python/
│   ├── 01_test_gee_connection.py
│   ├── 02_full_bioclimate_colab.ipynb
│   ├── bioclimate_engine.py
│   └── requirements.txt
├── tests/
│   └── test_repository_structure.py
└── .github/
    └── workflows/
        └── static-tests.yml
```

## Recommended use: Google Colab

The easiest way to run the complete Python version is the Colab notebook:

`python/02_full_bioclimate_colab.ipynb`

Open it directly in Colab:

https://colab.research.google.com/github/hamedsabzchi/libya-emberger-bioclimate/blob/main/python/02_full_bioclimate_colab.ipynb

The notebook:

1. authenticates Google Earth Engine;
2. loads the Python analysis engine from this repository;
3. provides interactive controls for scenario, years, classification, thresholds, and output;
4. renders an interactive map;
5. optionally calculates approximate class-area statistics;
6. starts GeoTIFF export tasks to Google Drive.

A Google Cloud project registered for Earth Engine is required. The notebook currently uses the project ID configured for this project and can be edited if a different Earth Engine project is needed.

## Local Python environment

For local use:

```bash
python -m pip install -r python/requirements.txt
```

Then authenticate and initialize Earth Engine with a Google Cloud project registered for Earth Engine.

## Reference implementation

The complete original Google Earth Engine application is retained at:

`gee/libya_emberger_bioclimatic_zoning.js`

The Python implementation is organized around:

`python/bioclimate_engine.py`

The JavaScript application remains the reference implementation for the original Earth Engine UI, while the Python version provides a notebook-oriented analytical workflow.

## Testing

`tests/test_repository_structure.py` performs credential-free static checks, including Python syntax validation, required engine-function checks, and Colab notebook JSON validation.

GitHub Actions runs these static checks automatically on pushes and pull requests. These tests do **not** replace a live Earth Engine end-to-end run because Earth Engine execution requires authorized credentials.

A successful live connection test has verified Python access to the Libya boundary and the TerraClimate collection for 1991–2020. The complete Colab workflow has also been run successfully to map output. Full scenario outputs should be rechecked when changing scientific logic, dataset identifiers, or export behavior.

## How to cite

Citation metadata are provided in `CITATION.cff`. GitHub can use this file to expose a **Cite this repository** action.

Please cite the archived Zenodo release:

> Sabzchi Dehkharghani, H. (2026). *Libya Emberger Bioclimatic Zoning* (Version 1.0.0) [Software]. Zenodo. https://doi.org/10.5281/zenodo.22151541

**DOI:** `10.5281/zenodo.22151541`

## Scientific references used in the implementation

- Emberger, L. (1930) — original pluviothermic formulation.
- Daget, P. (1977) — Mediterranean bioclimate and the Emberger system.
- Funk et al. (2015) — CHIRPS precipitation dataset, *Scientific Data*.
- Abatzoglou et al. (2018) — TerraClimate, *Scientific Data*.
- Muñoz-Sabater et al. (2021) — ERA5-Land, *Earth System Science Data*.
- WMO-No. 1203 — Guidelines on the Calculation of Climate Normals.

## Author

Hamed Sabzchi Dehkharghani

## Independent personal-project notice

This repository is an **independent personal technical portfolio and research-development project by Hamed Sabzchi Dehkharghani**. It is not published on behalf of any employer, organization, or institution. No institutional affiliation, sponsorship, approval, endorsement, or official status is claimed or implied.

Names contained in dataset identifiers or scientific references identify data sources or publications only and do not imply institutional authorship or endorsement of this repository.

## Licensing note

No open-source license is asserted by this repository at this stage. The repository is made publicly viewable for technical portfolio, reproducibility, and citation purposes; no broader reuse permission is granted by an explicit software license here.
