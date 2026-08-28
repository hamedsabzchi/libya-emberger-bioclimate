/**** =========================================================================
 LIBYA EMBERGER BIOCLIMATIC ZONING TOOL
 FINAL SIMPLIFIED VERSION

 PURPOSE
 Generate historical and recent bioclimatic zones for Libya using the
 Emberger pluviothermic quotient.

 FIVE AVAILABLE SCENARIOS

 1. Historical reference: WorldClim
    - Fixed historical WorldClim V1 climatology
    - Intended for reference and comparison with historical Libyan maps

 2. Recent climate baseline: TerraClimate
    - Default period: 1991-2020
    - Intended as the main recent climate-normal bioclimatic map

 3. Updated recent zoning: ERA5-Land
    - Default period: 1991-2025
    - Includes more recent climate conditions
    - This is an extended recent period, not a standard climate normal

 4. Recommended comparison: TerraClimate + ERA5-Land
    - Default common period: 1991-2020
    - TerraClimate is used as the main spatial zoning
    - ERA5-Land is used as an secondary comparison
    - No averaging is performed
    - Agreement and class-difference maps are produced

 MAIN OUTPUTS

 - Annual precipitation
 - Maximum temperature of the hottest month
 - Minimum temperature of the coldest month
 - Emberger Q2 index
 - Bioclimatic moisture zones
 - Winter thermal variants
 - Dataset agreement and disagreement
 - Area statistics
 - GeoTIFF export tasks

 IMPORTANT LIMITATION

 These are bioclimatic zones, not complete agro-ecological zones.
 Soil, irrigation, land suitability, land capability, land use,
 water quality and crop-specific requirements are not included.
=============================================================================*/

// NOTE: The full 4,660-line reference implementation should be committed from the uploaded source file.
// This placeholder was created only because connector payload limits prevented safe transfer of the full source in one action.
