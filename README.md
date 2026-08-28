# Libya Emberger Bioclimatic Zoning

A reproducible geospatial workflow for historical and recent bioclimatic zoning in Libya using the Emberger pluviothermic quotient (Q2).

## Project status

This repository is being developed as a documented Google Earth Engine and Python geospatial workflow. The current reference implementation is in Google Earth Engine JavaScript; a Python implementation will be added incrementally while preserving the scientific logic of the reference workflow.

## Purpose

The tool generates historical and recent bioclimatic zones for Libya and supports comparison across multiple climate datasets. It is intended for national and broad regional interpretation, sensitivity analysis, and reproducible climate-zoning workflows.

## Climate scenarios

1. **WorldClim historical reference** — fixed historical climatology for comparison with legacy bioclimatic maps.
2. **TerraClimate recent baseline** — recommended standard climate-normal period: 1991–2020.
3. **ERA5-Land updated recent zoning** — supports a standard 1991–2020 period and an extended recent period through 2025.
4. **TerraClimate + ERA5-Land comparison** — compares both datasets over a common period without averaging them; agreement and class-difference layers are produced.
5. **CHIRPS + ERA5-Land agricultural hybrid** — uses CHIRPS precipitation with ERA5-Land temperature inputs.

## Main outputs

- Mean annual precipitation
- Maximum temperature of the hottest climatological month
- Minimum temperature of the coldest climatological month
- Emberger Q2 index
- Bioclimatic moisture zones
- Winter thermal variants
- Cross-dataset agreement and class difference
- Area statistics
- GeoTIFF export tasks

## Method

The Emberger pluviothermic quotient is implemented as:

`Q2 = 2000 × P / (M² - m²)`

where:

- `P` = annual precipitation in millimetres
- `M` = mean maximum temperature of the hottest month in Kelvin
- `m` = mean minimum temperature of the coldest month in Kelvin

The current workflow supports fixed user-defined Q2 thresholds for reproducible comparisons and an exploratory Libya-relative equal-frequency classification. Relative classes must not be interpreted as formal Emberger bioclimatic stages.

## Important scientific limitation

These outputs are **bioclimatic zones, not complete agro-ecological zones (AEZs) or crop-suitability maps**. Soil, irrigation, land suitability, land capability, land use, water quality, crop requirements, and other agronomic constraints are not included.

Cross-dataset agreement is used as **sensitivity evidence**, not as ground-validation accuracy. Operational or publication use should be supported by independent climate-station or other appropriate validation where available.

## Repository structure

```text
libya-emberger-bioclimate/
├── README.md
├── gee/
│   └── libya_emberger_bioclimatic_zoning.js
├── python/
│   └── README.md
├── docs/
│   ├── methodology.md
│   ├── datasets.md
│   ├── validation.md
│   └── limitations.md
├── tests/
└── figures/
```

## Development roadmap

The project will be developed in two parallel forms:

- **Reference workflow:** Google Earth Engine JavaScript
- **Reproducible local/cloud workflow:** Python

The Python implementation will be introduced incrementally, beginning with the Q2 calculation and fixed-threshold classification, followed by TerraClimate processing, ERA5-Land processing, dataset comparison, raster I/O, and tests.

## Author

Hamed Sabzchi Dehkharghani

## Disclaimer

This repository is a personal technical portfolio and research-development project. It should not be interpreted as an official institutional product or endorsement unless explicitly stated otherwise.
