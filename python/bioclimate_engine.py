"""
Libya Emberger Bioclimatic Zoning - Earth Engine Python engine.

Faithful Python port of the scientific/analytical engine in the original
Google Earth Engine JavaScript application. The original GEE UI is not
ported here; map display is provided with Folium for Colab/notebook use.

Scenarios
---------
1. WorldClim V1 historical reference
2. TerraClimate recent baseline
3. ERA5-Land updated recent zoning
4. TerraClimate + ERA5-Land cross-dataset sensitivity
5. CHIRPS precipitation + ERA5-Land temperature hybrid

Important scientific limitation
-------------------------------
Outputs are bioclimatic zones, not complete agro-ecological zones (AEZ).
They do not include soil, irrigation, land suitability/capability, land use,
water quality, or crop-specific requirements.

Dataset agreement in Scenario 4 is sensitivity evidence, not ground validation.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

import ee

LIBYA_BOUNDARY_DATASET = "FAO/GAUL/2015/level0"
WORLDCLIM_DATASET = "WORLDCLIM/V1/MONTHLY"
TERRACLIMATE_DATASET = "IDAHO_EPSCOR/TERRACLIMATE"
ERA5_LAND_DATASET = "ECMWF/ERA5_LAND/MONTHLY_AGGR"
CHIRPS_DATASET = "UCSB-CHG/CHIRPS/DAILY"

TERRACLIMATE_FIRST_YEAR = 1958
TERRACLIMATE_LAST_YEAR = 2024
ERA5_FIRST_YEAR = 1950
ERA5_LAST_YEAR = 2025
SHARED_FIRST_YEAR = 1958
SHARED_LAST_YEAR = 2024
CHIRPS_FIRST_YEAR = 1981
CHIRPS_LAST_YEAR = 2025

DIAGNOSTIC_SCALE = 20_000
DIAGNOSTIC_MAX_PIXELS = 20_000_000
NODATA_VALUE = -9999

DEFAULT_THRESHOLDS = [20, 40, 60, 100, 140]

ZONE_NAMES = [
    "Saharan / perarid",
    "Arid",
    "Semi-arid",
    "Sub-humid",
    "Humid",
    "Perhumid",
]

RELATIVE_ZONE_NAMES = [
    "Lowest relative Q2",
    "Very low relative Q2",
    "Low relative Q2",
    "Moderate relative Q2",
    "High relative Q2",
    "Highest relative Q2",
]

WINTER_NAMES = [
    "Very cold winter",
    "Cold winter",
    "Cool winter",
    "Temperate winter",
    "Warm winter",
    "Very warm winter",
]

Q_PALETTE = [
    "7f0000", "b30000", "d7301f", "ef6548", "fc8d59",
    "fdbb84", "fdd49e", "fee8c8", "ffffcc", "d9f0a3",
    "addd8e", "78c679", "41ab5d", "238443", "006837",
]
ZONE_PALETTE = ["8c2d04", "d94801", "fe9929", "fed98e", "a1d99b", "238b45"]
WINTER_PALETTE = ["54278f", "756bb1", "9e9ac8", "cbc9e2", "fdae6b", "e6550d"]
DIFFERENCE_PALETTE = ["1a9850", "fee08b", "fc8d59", "d73027", "7f0000"]
PRECIP_PALETTE = [
    "fff7ec", "fee8c8", "fdd49e", "fdbb84", "fc8d59",
    "ef6548", "d7301f", "990000", "54278f",
]
TMAX_PALETTE = [
    "ffffcc", "ffeda0", "fed976", "feb24c", "fd8d3c",
    "fc4e2a", "e31a1c", "bd0026", "800026",
]
TMIN_PALETTE = [
    "313695", "4575b4", "74add1", "abd9e9", "e0f3f8",
    "ffffbf", "fee090", "fdae61", "f46d43", "d73027", "a50026",
]

COUNTRIES = ee.FeatureCollection(LIBYA_BOUNDARY_DATASET)
LIBYA_FC = COUNTRIES.filter(ee.Filter.eq("ADM0_NAME", "Libya"))
LIBYA = LIBYA_FC.geometry()


def validate_thresholds(thresholds: Sequence[float]) -> List[float]:
    values = [float(v) for v in thresholds]
    if len(values) != 5:
        raise ValueError("Exactly five Q2 thresholds are required.")
    if any(values[i] <= values[i - 1] for i in range(1, len(values))):
        raise ValueError("Q2 thresholds must increase continuously from left to right.")
    return values


def validate_period(scenario: int, start_year: Optional[int], end_year: Optional[int]) -> None:
    if scenario == 1:
        return
    if start_year is None or end_year is None:
        raise ValueError("start_year and end_year are required for Scenarios 2-5.")
    start_year = int(start_year)
    end_year = int(end_year)
    if start_year > end_year:
        raise ValueError("start_year cannot be later than end_year.")
    if scenario == 2 and not (
        TERRACLIMATE_FIRST_YEAR <= start_year <= end_year <= TERRACLIMATE_LAST_YEAR
    ):
        raise ValueError(
            f"TerraClimate period must be within {TERRACLIMATE_FIRST_YEAR}-{TERRACLIMATE_LAST_YEAR}."
        )
    if scenario == 3 and not (
        ERA5_FIRST_YEAR <= start_year <= end_year <= ERA5_LAST_YEAR
    ):
        raise ValueError(
            f"ERA5-Land period must be within {ERA5_FIRST_YEAR}-{ERA5_LAST_YEAR}."
        )
    if scenario == 4 and not (
        SHARED_FIRST_YEAR <= start_year <= end_year <= SHARED_LAST_YEAR
    ):
        raise ValueError(
            f"Scenario 4 requires one shared period within {SHARED_FIRST_YEAR}-{SHARED_LAST_YEAR}."
        )
    if scenario == 5 and not (
        CHIRPS_FIRST_YEAR <= start_year <= end_year <= CHIRPS_LAST_YEAR
    ):
        raise ValueError(
            f"Scenario 5 period must be within {CHIRPS_FIRST_YEAR}-{CHIRPS_LAST_YEAR}."
        )


def create_monthly_climatology(
    image_collection: ee.ImageCollection,
    selected_bands: Sequence[str],
) -> ee.ImageCollection:
    months = ee.List.sequence(1, 12)

    def _one_month(month: ee.Number) -> ee.Image:
        month = ee.Number(month)
        monthly_mean = (
            image_collection
            .filter(ee.Filter.calendarRange(month, month, "month"))
            .select(list(selected_bands))
            .mean()
        )
        return monthly_mean.set({
            "month": month,
            "system:index": month.format("%02d"),
        })

    return ee.ImageCollection.fromImages(months.map(_one_month))


def create_mean_annual_total_from_daily_collection(
    daily_collection: ee.ImageCollection,
    start_year: int,
    end_year: int,
    band_name: str,
    output_band_name: str,
) -> ee.Image:
    years = ee.List.sequence(start_year, end_year)
    months = ee.List.sequence(1, 12)

    def _one_year(year: ee.Number) -> ee.Image:
        year = ee.Number(year)

        def _one_month(month: ee.Number) -> ee.Image:
            month = ee.Number(month)
            month_start = ee.Date.fromYMD(year, month, 1)
            month_end = month_start.advance(1, "month")
            return (
                daily_collection
                .filterDate(month_start, month_end)
                .select(band_name)
                .sum()
                .max(0)
                .rename(output_band_name)
                .set({"year": year, "month": month})
            )

        monthly_totals = months.map(_one_month)
        return (
            ee.ImageCollection.fromImages(monthly_totals)
            .sum()
            .rename(output_band_name)
            .set("year", year)
        )

    annual_images = years.map(_one_year)
    return (
        ee.ImageCollection.fromImages(annual_images)
        .mean()
        .rename(output_band_name)
        .clip(LIBYA)
    )


def calculate_q2(
    annual_precipitation: ee.Image,
    hottest_max_c: ee.Image,
    coldest_min_c: ee.Image,
) -> ee.Image:
    hottest_max_k = hottest_max_c.add(273.15)
    coldest_min_k = coldest_min_c.add(273.15)
    denominator = hottest_max_k.pow(2).subtract(coldest_min_k.pow(2))
    valid_mask = denominator.gt(0).And(annual_precipitation.gte(0))
    return (
        annual_precipitation
        .multiply(2000)
        .divide(denominator)
        .rename("Q2")
        .updateMask(valid_mask)
        .clip(LIBYA)
    )


def get_classification_thresholds(
    q2: ee.Image,
    manual_thresholds: Sequence[float],
    classification_mode: str = "fixed",
) -> ee.List:
    classification_mode = classification_mode.lower().strip()
    if classification_mode == "fixed":
        return ee.List(validate_thresholds(manual_thresholds))
    if classification_mode != "relative":
        raise ValueError("classification_mode must be 'fixed' or 'relative'.")
    percentile_result = q2.reduceRegion(
        reducer=ee.Reducer.percentile(
            [16.67, 33.33, 50, 66.67, 83.33],
            ["q16_67", "q33_33", "q50", "q66_67", "q83_33"],
        ),
        geometry=LIBYA,
        scale=DIAGNOSTIC_SCALE,
        maxPixels=DIAGNOSTIC_MAX_PIXELS,
        tileScale=8,
        bestEffort=True,
    )
    return ee.List([
        percentile_result.get("Q2_q16_67"),
        percentile_result.get("Q2_q33_33"),
        percentile_result.get("Q2_q50"),
        percentile_result.get("Q2_q66_67"),
        percentile_result.get("Q2_q83_33"),
    ])


def classify_q2(
    q2: ee.Image,
    thresholds: Sequence[float] = DEFAULT_THRESHOLDS,
    classification_mode: str = "fixed",
) -> ee.Image:
    applied = get_classification_thresholds(q2, thresholds, classification_mode)
    t1 = ee.Number(applied.get(0))
    t2 = ee.Number(applied.get(1))
    t3 = ee.Number(applied.get(2))
    t4 = ee.Number(applied.get(3))
    t5 = ee.Number(applied.get(4))
    return (
        ee.Image(1)
        .where(q2.gte(t1), 2)
        .where(q2.gte(t2), 3)
        .where(q2.gte(t3), 4)
        .where(q2.gte(t4), 5)
        .where(q2.gte(t5), 6)
        .rename("bioclimatic_zone")
        .updateMask(q2.mask())
        .toByte()
        .clip(LIBYA)
    )


def classify_winter(coldest_min_c: ee.Image) -> ee.Image:
    return (
        ee.Image(1)
        .where(coldest_min_c.gte(-3), 2)
        .where(coldest_min_c.gte(0), 3)
        .where(coldest_min_c.gte(3), 4)
        .where(coldest_min_c.gte(7), 5)
        .where(coldest_min_c.gte(10), 6)
        .rename("winter_variant")
        .updateMask(coldest_min_c.mask())
        .toByte()
        .clip(LIBYA)
    )


def add_metadata(
    image: ee.Image,
    dataset_name: str,
    period_label: str,
    start_year: Optional[int],
    end_year: Optional[int],
) -> ee.Image:
    return image.set({
        "country": "Libya",
        "dataset": dataset_name,
        "climate_period": period_label,
        "start_year": start_year,
        "end_year": end_year,
        "method": "Emberger Q2",
        "formula": "Q2 = 2000P / (M^2 - m^2)",
    })


def _package_product(
    name: str,
    label: str,
    period: str,
    dataset_label: str,
    start_year: Optional[int],
    end_year: Optional[int],
    precipitation: ee.Image,
    hottest_max: ee.Image,
    coldest_min: ee.Image,
    q2: ee.Image,
    zones: ee.Image,
    winter: ee.Image,
) -> Dict[str, Any]:
    return {
        "name": name,
        "label": label,
        "period": period,
        "precipitation": add_metadata(
            precipitation, dataset_label, period, start_year, end_year
        ),
        "hottestMax": add_metadata(
            hottest_max, dataset_label, period, start_year, end_year
        ),
        "coldestMin": add_metadata(
            coldest_min, dataset_label, period, start_year, end_year
        ),
        "q2": add_metadata(q2, dataset_label, period, start_year, end_year),
        "zones": add_metadata(zones, dataset_label, period, start_year, end_year),
        "winter": add_metadata(winter, dataset_label, period, start_year, end_year),
    }


def build_worldclim_product(
    thresholds: Sequence[float] = DEFAULT_THRESHOLDS,
    classification_mode: str = "fixed",
) -> Dict[str, Any]:
    collection = ee.ImageCollection(WORLDCLIM_DATASET)
    annual_precipitation = (
        collection.select("prec")
        .sum()
        .rename("annual_precipitation_mm")
        .clip(LIBYA)
    )
    hottest_max_c = (
        collection.select("tmax")
        .max()
        .multiply(0.1)
        .rename("hottest_month_tmax_c")
        .clip(LIBYA)
    )
    coldest_min_c = (
        collection.select("tmin")
        .min()
        .multiply(0.1)
        .rename("coldest_month_tmin_c")
        .clip(LIBYA)
    )
    q2 = calculate_q2(annual_precipitation, hottest_max_c, coldest_min_c)
    zones = classify_q2(q2, thresholds, classification_mode)
    winter = classify_winter(coldest_min_c)
    period = "Fixed WorldClim V1 historical climatology"
    return _package_product(
        "WorldClim",
        "WorldClim historical reference",
        period,
        "WorldClim V1",
        None,
        None,
        annual_precipitation,
        hottest_max_c,
        coldest_min_c,
        q2,
        zones,
        winter,
    )


def build_terraclimate_product(
    start_year: int,
    end_year: int,
    thresholds: Sequence[float] = DEFAULT_THRESHOLDS,
    classification_mode: str = "fixed",
) -> Dict[str, Any]:
    start_date = ee.Date.fromYMD(start_year, 1, 1)
    end_date = ee.Date.fromYMD(end_year + 1, 1, 1)
    collection = (
        ee.ImageCollection(TERRACLIMATE_DATASET)
        .filterDate(start_date, end_date)
        .filterBounds(LIBYA)
    )
    monthly = create_monthly_climatology(collection, ["pr", "tmmx", "tmmn"])
    annual_precipitation = (
        monthly.select("pr")
        .sum()
        .max(0)
        .rename("annual_precipitation_mm")
        .clip(LIBYA)
    )
    hottest_max_c = (
        monthly.select("tmmx")
        .max()
        .multiply(0.1)
        .rename("hottest_month_tmax_c")
        .clip(LIBYA)
    )
    coldest_min_c = (
        monthly.select("tmmn")
        .min()
        .multiply(0.1)
        .rename("coldest_month_tmin_c")
        .clip(LIBYA)
    )
    q2 = calculate_q2(annual_precipitation, hottest_max_c, coldest_min_c)
    zones = classify_q2(q2, thresholds, classification_mode)
    winter = classify_winter(coldest_min_c)
    period = f"{start_year}-{end_year}"
    return _package_product(
        "TerraClimate",
        f"TerraClimate {period}",
        period,
        "TerraClimate",
        start_year,
        end_year,
        annual_precipitation,
        hottest_max_c,
        coldest_min_c,
        q2,
        zones,
        winter,
    )


def build_era5_land_product(
    start_year: int,
    end_year: int,
    thresholds: Sequence[float] = DEFAULT_THRESHOLDS,
    classification_mode: str = "fixed",
) -> Dict[str, Any]:
    start_date = ee.Date.fromYMD(start_year, 1, 1)
    end_date = ee.Date.fromYMD(end_year + 1, 1, 1)
    monthly_collection = (
        ee.ImageCollection(ERA5_LAND_DATASET)
        .filterDate(start_date, end_date)
        .filterBounds(LIBYA)
    )
    monthly_precip = create_monthly_climatology(
        monthly_collection.select("total_precipitation_sum"),
        ["total_precipitation_sum"],
    )
    annual_precipitation = (
        monthly_precip
        .select("total_precipitation_sum")
        .map(lambda image: ee.Image(image).max(0))
        .sum()
        .multiply(1000)
        .rename("annual_precipitation_mm")
        .clip(LIBYA)
    )
    monthly_temp = create_monthly_climatology(
        monthly_collection.select(["temperature_2m_max", "temperature_2m_min"]),
        ["temperature_2m_max", "temperature_2m_min"],
    )
    hottest_max_c = (
        monthly_temp.select("temperature_2m_max")
        .max()
        .subtract(273.15)
        .rename("hottest_month_tmax_c")
        .clip(LIBYA)
    )
    coldest_min_c = (
        monthly_temp.select("temperature_2m_min")
        .min()
        .subtract(273.15)
        .rename("coldest_month_tmin_c")
        .clip(LIBYA)
    )
    q2 = calculate_q2(annual_precipitation, hottest_max_c, coldest_min_c)
    zones = classify_q2(q2, thresholds, classification_mode)
    winter = classify_winter(coldest_min_c)
    period = f"{start_year}-{end_year}"
    return _package_product(
        "ERA5_Land",
        f"ERA5-Land {period}",
        period,
        "ERA5-Land",
        start_year,
        end_year,
        annual_precipitation,
        hottest_max_c,
        coldest_min_c,
        q2,
        zones,
        winter,
    )


def build_chirps_era5_hybrid_product(
    start_year: int,
    end_year: int,
    thresholds: Sequence[float] = DEFAULT_THRESHOLDS,
    classification_mode: str = "fixed",
) -> Dict[str, Any]:
    start_date = ee.Date.fromYMD(start_year, 1, 1)
    end_date = ee.Date.fromYMD(end_year + 1, 1, 1)
    chirps = (
        ee.ImageCollection(CHIRPS_DATASET)
        .filterDate(start_date, end_date)
        .filterBounds(LIBYA)
        .select("precipitation")
    )
    annual_precipitation = create_mean_annual_total_from_daily_collection(
        chirps,
        start_year,
        end_year,
        "precipitation",
        "annual_precipitation_mm",
    )
    era5_monthly = (
        ee.ImageCollection(ERA5_LAND_DATASET)
        .filterDate(start_date, end_date)
        .filterBounds(LIBYA)
        .select(["temperature_2m_max", "temperature_2m_min"])
    )
    monthly_temp = create_monthly_climatology(
        era5_monthly, ["temperature_2m_max", "temperature_2m_min"]
    )
    hottest_max_c = (
        monthly_temp.select("temperature_2m_max")
        .max()
        .subtract(273.15)
        .rename("hottest_month_tmax_c")
        .clip(LIBYA)
    )
    coldest_min_c = (
        monthly_temp.select("temperature_2m_min")
        .min()
        .subtract(273.15)
        .rename("coldest_month_tmin_c")
        .clip(LIBYA)
    )
    q2 = calculate_q2(annual_precipitation, hottest_max_c, coldest_min_c)
    zones = classify_q2(q2, thresholds, classification_mode)
    winter = classify_winter(coldest_min_c)
    period = f"{start_year}-{end_year}"
    return _package_product(
        "CHIRPS_ERA5_Land",
        f"CHIRPS precipitation + ERA5-Land temperature {period}",
        period,
        "CHIRPS precipitation + ERA5-Land temperature",
        start_year,
        end_year,
        annual_precipitation,
        hottest_max_c,
        coldest_min_c,
        q2,
        zones,
        winter,
    )


def build_comparison(
    terraclimate_product: Dict[str, Any],
    era5_product: Dict[str, Any],
) -> Dict[str, ee.Image]:
    terra_zones = terraclimate_product["zones"].rename("terraclimate_zone")
    era_zones = era5_product["zones"].rename("era5_land_zone")
    absolute_difference = (
        terra_zones.subtract(era_zones)
        .abs()
        .rename("absolute_class_difference")
        .toByte()
        .clip(LIBYA)
    )
    exact_agreement = (
        terra_zones.eq(era_zones)
        .rename("exact_agreement")
        .toByte()
        .clip(LIBYA)
    )
    agreement_level = (
        ee.Image(1)
        .where(absolute_difference.eq(1), 2)
        .where(absolute_difference.eq(2), 3)
        .where(absolute_difference.gte(3), 4)
        .rename("agreement_level")
        .updateMask(absolute_difference.mask())
        .toByte()
        .clip(LIBYA)
    )
    q2_difference = (
        terraclimate_product["q2"]
        .subtract(era5_product["q2"])
        .rename("terraclimate_minus_era5_q2")
        .clip(LIBYA)
    )
    comparison_stack = (
        terra_zones
        .addBands(era_zones)
        .addBands(exact_agreement)
        .addBands(absolute_difference)
        .addBands(agreement_level)
        .addBands(q2_difference)
    )
    return {
        "exactAgreement": exact_agreement,
        "absoluteDifference": absolute_difference,
        "agreementLevel": agreement_level,
        "q2Difference": q2_difference,
        "comparisonStack": comparison_stack,
    }


def run_scenario(
    scenario: int,
    start_year: Optional[int] = None,
    end_year: Optional[int] = None,
    thresholds: Sequence[float] = DEFAULT_THRESHOLDS,
    classification_mode: str = "fixed",
) -> Dict[str, Any]:
    scenario = int(scenario)
    if scenario not in (1, 2, 3, 4, 5):
        raise ValueError("scenario must be one of 1, 2, 3, 4, 5.")
    classification_mode = classification_mode.lower().strip()
    if classification_mode not in ("fixed", "relative"):
        raise ValueError("classification_mode must be 'fixed' or 'relative'.")
    thresholds = validate_thresholds(thresholds)
    validate_period(scenario, start_year, end_year)
    result: Dict[str, Any] = {
        "scenario": scenario,
        "startYear": start_year,
        "endYear": end_year,
        "thresholds": thresholds,
        "classificationMode": classification_mode,
        "mainProduct": None,
        "secondaryProduct": None,
        "comparison": None,
        "worldClim": None,
        "terraClimate": None,
        "era5Land": None,
        "chirpsEra5Hybrid": None,
    }
    if scenario == 1:
        product = build_worldclim_product(thresholds, classification_mode)
        result["worldClim"] = product
        result["mainProduct"] = product
    elif scenario == 2:
        product = build_terraclimate_product(
            int(start_year), int(end_year), thresholds, classification_mode
        )
        result["terraClimate"] = product
        result["mainProduct"] = product
    elif scenario == 3:
        product = build_era5_land_product(
            int(start_year), int(end_year), thresholds, classification_mode
        )
        result["era5Land"] = product
        result["mainProduct"] = product
    elif scenario == 4:
        terra = build_terraclimate_product(
            int(start_year), int(end_year), thresholds, classification_mode
        )
        era = build_era5_land_product(
            int(start_year), int(end_year), thresholds, classification_mode
        )
        result["terraClimate"] = terra
        result["era5Land"] = era
        result["mainProduct"] = terra
        result["secondaryProduct"] = era
        result["comparison"] = build_comparison(terra, era)
        if classification_mode == "relative":
            result["warning"] = (
                "Scenario 4 is running in relative mode. Each dataset derives "
                "its own quantile thresholds, so class agreement must not be "
                "interpreted as a reproducible cross-dataset comparison."
            )
    else:
        product = build_chirps_era5_hybrid_product(
            int(start_year), int(end_year), thresholds, classification_mode
        )
        result["chirpsEra5Hybrid"] = product
        result["mainProduct"] = product
    return result


def get_applied_thresholds(
    product: Dict[str, Any],
    thresholds: Sequence[float] = DEFAULT_THRESHOLDS,
    classification_mode: str = "fixed",
) -> List[float]:
    values = get_classification_thresholds(
        product["q2"], thresholds, classification_mode
    ).getInfo()
    return [float(v) for v in values]


def calculate_zone_area(
    zone_image: ee.Image,
    classification_mode: str = "fixed",
) -> ee.FeatureCollection:
    area_image = (
        ee.Image.pixelArea()
        .divide(1_000_000)
        .rename("area_km2")
        .addBands(zone_image.rename("zone"))
    )
    grouped = area_image.reduceRegion(
        reducer=ee.Reducer.sum().group(groupField=1, groupName="zone"),
        geometry=LIBYA,
        scale=DIAGNOSTIC_SCALE,
        maxPixels=DIAGNOSTIC_MAX_PIXELS,
        tileScale=8,
        bestEffort=True,
    )
    groups = ee.List(
        ee.Algorithms.If(grouped.contains("groups"), grouped.get("groups"), ee.List([]))
    )
    names = ee.List(
        RELATIVE_ZONE_NAMES if classification_mode.lower() == "relative" else ZONE_NAMES
    )

    def _to_feature(item: ee.Dictionary) -> ee.Feature:
        item = ee.Dictionary(item)
        zone_number = ee.Number(item.get("zone")).toInt()
        zone_name = names.get(zone_number.subtract(1))
        return ee.Feature(None, {
            "zone": zone_number,
            "zone_name": zone_name,
            "area_km2": item.get("sum"),
        })

    return ee.FeatureCollection(groups.map(_to_feature))


def zone_area_records(
    result: Dict[str, Any],
    which: str = "main",
) -> List[Dict[str, Any]]:
    product = result["mainProduct"] if which == "main" else result.get("secondaryProduct")
    if product is None:
        raise ValueError("Requested product is not available in this scenario.")
    fc = calculate_zone_area(product["zones"], result["classificationMode"])
    info = fc.getInfo()
    return [feature["properties"] for feature in info.get("features", [])]


def _add_ee_layer(
    folium_map: Any,
    image: ee.Image,
    vis_params: Dict[str, Any],
    name: str,
    shown: bool = True,
) -> None:
    import folium
    map_id = ee.Image(image).getMapId(vis_params)
    folium.TileLayer(
        tiles=map_id["tile_fetcher"].url_format,
        attr="Google Earth Engine",
        name=name,
        overlay=True,
        control=True,
        show=shown,
    ).add_to(folium_map)


def _add_zone_legend(folium_map: Any, labels: Sequence[str]) -> None:
    import folium
    items = "".join(
        f'<div><span style="display:inline-block;width:14px;height:14px;'
        f'background:#{color};margin-right:6px;"></span>{i+1} - {label}</div>'
        for i, (color, label) in enumerate(zip(ZONE_PALETTE, labels))
    )
    html = f"""
    <div style="position:fixed;bottom:35px;right:10px;z-index:9999;
    background:white;padding:10px;border:1px solid #777;font-size:12px;line-height:18px;">
    <b>Bioclimatic classes</b><br>{items}</div>
    """
    folium_map.get_root().html.add_child(folium.Element(html))


def display_map(
    result: Dict[str, Any],
    output: str = "zones",
    zoom_start: int = 5,
) -> Any:
    import folium
    output = output.lower().strip()
    main = result["mainProduct"]
    secondary = result.get("secondaryProduct")
    comparison = result.get("comparison")
    m = folium.Map(location=[27.0, 17.0], zoom_start=zoom_start, tiles="CartoDB positron")

    if output == "zones":
        vis = {"min": 1, "max": 6, "palette": ZONE_PALETTE}
        _add_ee_layer(m, main["zones"], vis, f'{main["label"]} zones', True)
        if secondary:
            _add_ee_layer(m, secondary["zones"], vis, f'{secondary["label"]} zones', False)
        labels = RELATIVE_ZONE_NAMES if result["classificationMode"] == "relative" else ZONE_NAMES
        _add_zone_legend(m, labels)
    elif output == "q2":
        vis = {"min": 0, "max": 150, "palette": Q_PALETTE}
        _add_ee_layer(m, main["q2"], vis, f'{main["label"]} Q2', True)
        if secondary:
            _add_ee_layer(m, secondary["q2"], vis, f'{secondary["label"]} Q2', False)
    elif output == "precipitation":
        vis = {"min": 0, "max": 600, "palette": PRECIP_PALETTE}
        _add_ee_layer(m, main["precipitation"], vis, f'{main["label"]} precipitation', True)
        if secondary:
            _add_ee_layer(m, secondary["precipitation"], vis, f'{secondary["label"]} precipitation', False)
    elif output == "tmax":
        vis = {"min": 20, "max": 50, "palette": TMAX_PALETTE}
        _add_ee_layer(m, main["hottestMax"], vis, f'{main["label"]} hottest-month Tmax', True)
        if secondary:
            _add_ee_layer(m, secondary["hottestMax"], vis, f'{secondary["label"]} hottest-month Tmax', False)
    elif output == "tmin":
        vis = {"min": -10, "max": 20, "palette": TMIN_PALETTE}
        _add_ee_layer(m, main["coldestMin"], vis, f'{main["label"]} coldest-month Tmin', True)
        if secondary:
            _add_ee_layer(m, secondary["coldestMin"], vis, f'{secondary["label"]} coldest-month Tmin', False)
    elif output == "winter":
        vis = {"min": 1, "max": 6, "palette": WINTER_PALETTE}
        _add_ee_layer(m, main["winter"], vis, f'{main["label"]} winter variants', True)
        if secondary:
            _add_ee_layer(m, secondary["winter"], vis, f'{secondary["label"]} winter variants', False)
    elif output == "agreement":
        if not comparison:
            raise ValueError("Agreement output is available only for Scenario 4.")
        _add_ee_layer(
            m,
            comparison["exactAgreement"],
            {"min": 0, "max": 1, "palette": ["d73027", "1a9850"]},
            "TerraClimate / ERA5-Land exact agreement",
            True,
        )
        _add_ee_layer(m, main["zones"], {"min": 1, "max": 6, "palette": ZONE_PALETTE}, f'{main["label"]} zones', False)
        _add_ee_layer(m, secondary["zones"], {"min": 1, "max": 6, "palette": ZONE_PALETTE}, f'{secondary["label"]} zones', False)
    elif output == "class_difference":
        if not comparison:
            raise ValueError("Class-difference output is available only for Scenario 4.")
        _add_ee_layer(
            m,
            comparison["absoluteDifference"],
            {"min": 0, "max": 4, "palette": DIFFERENCE_PALETTE},
            "Absolute bioclimatic class difference",
            True,
        )
    elif output == "q2_difference":
        if not comparison:
            raise ValueError("Q2-difference output is available only for Scenario 4.")
        _add_ee_layer(
            m,
            comparison["q2Difference"],
            {"min": -50, "max": 50, "palette": ["313695", "ffffbf", "a50026"]},
            "TerraClimate minus ERA5-Land Q2",
            True,
        )
    else:
        raise ValueError(
            "output must be one of: zones, q2, precipitation, tmax, tmin, winter, "
            "agreement, class_difference, q2_difference"
        )

    boundary = LIBYA_FC.style(color="000000", fillColor="00000000", width=2)
    _add_ee_layer(m, boundary, {}, "Libya boundary", True)
    folium.LayerControl(collapsed=False).add_to(m)
    return m


def get_scenario_export_scale(scenario: int) -> int:
    if int(scenario) == 1:
        return 1000
    if int(scenario) == 2:
        return 4000
    return 10000


def build_export_name(result: Dict[str, Any], output_name: str) -> str:
    scenario = int(result["scenario"])
    scenario_names = {
        1: "WorldClim_Historical",
        2: "TerraClimate",
        3: "ERA5_Land",
        4: "TerraClimate_ERA5_Land_Comparison",
        5: "CHIRPS_ERA5_Land_Hybrid",
    }
    period_text = "Historical" if scenario == 1 else f'{result["startYear"]}_{result["endYear"]}'
    return "_".join([
        "Libya", "Emberger", scenario_names[scenario], period_text, output_name
    ])


def _make_drive_export_task(
    image: ee.Image,
    result: Dict[str, Any],
    output_name: str,
) -> ee.batch.Task:
    export_name = build_export_name(result, output_name)
    return ee.batch.Export.image.toDrive(
        image=image,
        description=export_name,
        folder="Libya_Emberger_Zoning",
        fileNamePrefix=export_name,
        region=LIBYA,
        scale=get_scenario_export_scale(result["scenario"]),
        maxPixels=1e13,
        fileFormat="GeoTIFF",
        formatOptions={"cloudOptimized": True, "noData": NODATA_VALUE},
    )


def export_zones(result: Dict[str, Any], start: bool = False) -> ee.batch.Task:
    image = result["mainProduct"]["zones"].unmask(NODATA_VALUE).toInt16()
    task = _make_drive_export_task(image, result, "Bioclimatic_Zones")
    if start:
        task.start()
    return task


def export_q2(result: Dict[str, Any], start: bool = False) -> ee.batch.Task:
    image = result["mainProduct"]["q2"].unmask(NODATA_VALUE).toFloat()
    task = _make_drive_export_task(image, result, "Emberger_Q2")
    if start:
        task.start()
    return task


def export_climate_inputs(
    result: Dict[str, Any],
    start: bool = False,
) -> ee.batch.Task:
    main = result["mainProduct"]
    stack = (
        main["precipitation"].rename("annual_precipitation_mm")
        .addBands(main["hottestMax"].rename("hottest_month_tmax_c"))
        .addBands(main["coldestMin"].rename("coldest_month_tmin_c"))
        .addBands(main["winter"].rename("winter_variant"))
        .unmask(NODATA_VALUE)
        .toFloat()
    )
    task = _make_drive_export_task(stack, result, "Climate_Inputs")
    if start:
        task.start()
    return task


def export_comparison(
    result: Dict[str, Any],
    start: bool = False,
) -> ee.batch.Task:
    if int(result["scenario"]) != 4 or result.get("comparison") is None:
        raise ValueError("Comparison export is available only for Scenario 4.")
    stack = result["comparison"]["comparisonStack"].unmask(NODATA_VALUE).toFloat()
    task = _make_drive_export_task(stack, result, "Dataset_Comparison")
    if start:
        task.start()
    return task


def task_summary(task: ee.batch.Task) -> Dict[str, Any]:
    return task.status()
