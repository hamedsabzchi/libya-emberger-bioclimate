

// =============================================================================
// 1. LIBYA BOUNDARY
// =============================================================================

var countries = ee.FeatureCollection('FAO/GAUL/2015/level0');

var libyaFeatureCollection = countries.filter(
  ee.Filter.eq('ADM0_NAME', 'Libya')
);

var libya = libyaFeatureCollection.geometry();

Map.centerObject(libya, 5);
Map.setOptions('HYBRID');


// =============================================================================
// 2. GLOBAL SETTINGS
// =============================================================================

// Common scale for national comparison and area statistics.
// Resampling a coarse dataset does not create additional information.
var COMPARISON_SCALE = 10000;

// Default export scale in metres.
var EXPORT_SCALE = 5000;

// NoData value for exported GeoTIFF files.
var NODATA_VALUE = -9999;

// Dataset temporal limits used for interface validation.
var TERRACLIMATE_FIRST_YEAR = 1958;
var TERRACLIMATE_LAST_YEAR = 2024;

var ERA5_FIRST_YEAR = 1950;
var ERA5_LAST_YEAR = 2025;

// Shared complete-year availability used by Scenario 4.
// TerraClimate is the limiting dataset in the current GEE catalogue.
var SHARED_FIRST_YEAR = 1958;
var SHARED_LAST_YEAR = 2024;

// CHIRPS daily precipitation availability used by the hybrid methodology.
var CHIRPS_FIRST_YEAR = 1981;
var CHIRPS_LAST_YEAR = 2025;

// Approximate native spatial resolutions used in user guidance.
// Exporting at a smaller pixel size does not create finer climate information.
var WORLDCLIM_APPROX_KM = 1;
var TERRACLIMATE_APPROX_KM = 4;
var CHIRPS_APPROX_KM = 5.5;
var ERA5_LAND_APPROX_KM = 9;

// MEMORY-SAFE EXECUTION SETTINGS
// Large daily collections are reduced in year-month chunks, never as one
// multi-decadal daily reduction. Diagnostic charts are optional because each
// chart starts an additional server-side regional reduction.
var DEFAULT_DIAGNOSTICS_ENABLED = false;
var DIAGNOSTIC_SCALE = 20000;
var DIAGNOSTIC_MAX_PIXELS = 2e7;
var AUTO_RUN_ON_STARTUP = false;


// =============================================================================
// 3. COLOUR PALETTES
// =============================================================================

var qPalette = [
  '7f0000',
  'b30000',
  'd7301f',
  'ef6548',
  'fc8d59',
  'fdbb84',
  'fdd49e',
  'fee8c8',
  'ffffcc',
  'd9f0a3',
  'addd8e',
  '78c679',
  '41ab5d',
  '238443',
  '006837'
];

var zonePalette = [
  '8c2d04',  // 1 Saharan / perarid
  'd94801',  // 2 Arid
  'fe9929',  // 3 Semi-arid
  'fed98e',  // 4 Sub-humid
  'a1d99b',  // 5 Humid
  '238b45'   // 6 Perhumid
];

var zoneNames = [
  'Saharan / perarid',
  'Arid',
  'Semi-arid',
  'Sub-humid',
  'Humid',
  'Perhumid'
];


var relativeZoneNames = [
  'Lowest relative Q2',
  'Very low relative Q2',
  'Low relative Q2',
  'Moderate relative Q2',
  'High relative Q2',
  'Highest relative Q2'
];

function isRelativeClassification() {
  return classificationStrategySelect.getValue() ===
    'Exploratory Libya-relative equal-frequency classes';
}

function getActiveZoneNamesClient() {
  return isRelativeClassification() ? relativeZoneNames : zoneNames;
}

function getActiveZoneNamesServer() {
  return ee.List(isRelativeClassification() ? relativeZoneNames : zoneNames);
}

var winterPalette = [
  '54278f',  // Very cold
  '756bb1',  // Cold
  '9e9ac8',  // Cool
  'cbc9e2',  // Temperate
  'fdae6b',  // Warm
  'e6550d'   // Very warm
];

var winterNames = [
  'Very cold winter',
  'Cold winter',
  'Cool winter',
  'Temperate winter',
  'Warm winter',
  'Very warm winter'
];

var agreementPalette = [
  'd73027',
  'fee08b',
  '1a9850'
];

var differencePalette = [
  '1a9850',
  'fee08b',
  'fc8d59',
  'd73027',
  '7f0000'
];


// =============================================================================
// 4. APPLICATION STATE
// =============================================================================

var appState = {
  result: null,
  scenarioNumber: null,
  scenarioName: null,
  startYear: null,
  endYear: null,
  thresholds: null
};


// =============================================================================
// 5. USER INTERFACE
// =============================================================================

var controlPanel = ui.Panel({
  style: {
    width: '440px',
    padding: '10px'
  }
});

var titleLabel = ui.Label({
  value: 'Libya Emberger Bioclimatic Zoning' +
  ' Using TerraClimate and ERA5-Land.',
  style: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#1b5e20',
    margin: '0 0 6px 0'
  }
});

var subtitleLabel = ui.Label({
  value:
       'By: Hamed Sabzchi Dehkharghani',
  style: {
    fontSize: '12px',
    color: '#444444',
    margin: '0 0 8px 0'
  }
});



var limitationLabel = ui.Label({
  value:
    'Important: The outputs are bioclimatic zones, not complete AEZs. ' +
    'They do not include soil, irrigation, land suitability, land use, ' +
    'water quality or crop requirements.',
  style: {
    fontSize: '11px',
    color: '#8b0000',
    backgroundColor: '#fff3e0',
    padding: '8px',
    margin: '0 0 10px 0'
  }
});

controlPanel.add(titleLabel);
controlPanel.add(subtitleLabel);
controlPanel.add(limitationLabel);

var methodologyGuidePanel = ui.Panel({
  style: {
    backgroundColor: '#f3f8fc',
    padding: '8px',
    margin: '0 0 10px 0'
  }
});

methodologyGuidePanel.add(ui.Label({
  value: 'Methodology guide',
  style: {
    fontWeight: 'bold',
    fontSize: '13px',
    color: '#0d47a1'
  }
}));

methodologyGuidePanel.add(ui.Label(
  'Emberger Q2 is a climate index used to describe the moisture conditions of an area. ' +
  'It combines three climate variables: annual precipitation (P), the average maximum ' +
  'temperature of the hottest month (M), and the average minimum temperature of the ' +
  'coldest month (m). The index considers both water availability and temperature ' +
  'stress to characterize climatic dryness or humidity.'
));

methodologyGuidePanel.add(ui.Label(
  'Higher Q2 values indicate wetter climatic conditions, while lower Q2 values indicate ' +
  'drier conditions. In general, areas with low Q2 have greater climatic limitations ' +
  'for rainfed agriculture, while higher Q2 areas have more favorable moisture conditions.'
));

methodologyGuidePanel.add(ui.Label(
  'For agricultural applications, Q2 should be interpreted together with other factors ' +
  'such as Length of Growing Period (LGP), soil properties, terrain, irrigation availability, ' +
  'and crop requirements. Q2 describes the climatic background but does not directly ' +
  'indicate whether a crop can be grown in a specific location.'
));

methodologyGuidePanel.add(ui.Label(
  'In Libya, most areas have low Q2 values due to limited rainfall and high temperatures. ' +
  'Therefore, the index is mainly useful for distinguishing relatively wetter northern ' +
  'regions from extremely dry desert areas rather than identifying suitable agricultural ' +
  'areas by itself.'
));

controlPanel.add(methodologyGuidePanel);

var spatialResolutionGuidePanel = ui.Panel({
  style: {
    backgroundColor: '#eef7ee',
    padding: '8px',
    margin: '0 0 10px 0'
  }
});

spatialResolutionGuidePanel.add(ui.Label({
  value: 'Spatial-resolution guide',
  style: {
    fontWeight: 'bold',
    fontSize: '13px',
    color: '#1b5e20'
  }
}));

spatialResolutionGuidePanel.add(ui.Label(
  'Scenario 1, WorldClim V1: approximately 1 km historical climatology. ' +
  'Fine grid spacing does not remove uncertainty from sparse station coverage.'
));

spatialResolutionGuidePanel.add(ui.Label(
  'Scenario 2, TerraClimate: approximately 4 km grid. Its fine spatial ' +
  'climatology is combined with coarser time-varying parent information, so ' +
  'not all climate variability is independently resolved at 4 km.'
));

spatialResolutionGuidePanel.add(ui.Label(
  'Scenario 3, ERA5-Land: approximately 9 km native model resolution, shown ' +
  'on an approximately 0.1-degree grid. Suitable for national and broad ' +
  'regional interpretation, not field or parcel decisions.'
));

spatialResolutionGuidePanel.add(ui.Label(
  'Scenario 4 compares a roughly 4 km TerraClimate product with a roughly ' +
  '9 km ERA5-Land product. Agreement shows dataset sensitivity, not accuracy.'
));

spatialResolutionGuidePanel.add(ui.Label(
  'Scenario 5 uses CHIRPS precipitation at 0.05 degrees, roughly 5-6 km, and ' +
  'ERA5-Land temperature at roughly 9 km. The effective information content ' +
  'is limited by the coarser temperature input.'
));

spatialResolutionGuidePanel.add(ui.Label(
  'A smaller export pixel size only resamples the output. It does not create ' +
  'new climate information or improve the native resolution.'
));

controlPanel.add(spatialResolutionGuidePanel);

var validationGuidePanel = ui.Panel({
  style: {
    backgroundColor: '#fff3e0',
    padding: '8px',
    margin: '0 0 10px 0'
  }
});

validationGuidePanel.add(ui.Label({
  value: 'Scientific status and required validation',
  style: {
    fontWeight: 'bold',
    fontSize: '13px',
    color: '#8b0000'
  }
}));

validationGuidePanel.add(ui.Label(
  'This app produces candidate bioclimatic zoning and cross-dataset ' +
  'sensitivity results. It does not produce validated accuracy, confidence, ' +
  'AEZ or land-suitability maps.'
));

validationGuidePanel.add(ui.Label(
  'Before publication or operational adoption, compare CHIRPS precipitation, ' +
  'ERA5-Land temperature and gridded Q2 against available Libyan station. '
  
));

validationGuidePanel.add(ui.Label(
  'For multi-period or multi-dataset comparison, always use one fixed set of ' +
  'Q2 boundaries. Do not compare separately calculated relative classes.'
));

controlPanel.add(validationGuidePanel);


// =============================================================================
// 5.1 SCENARIO SELECTION
// =============================================================================

controlPanel.add(ui.Label({
  value: 'Step 1. Select the analysis scenario',
  style: {
    fontWeight: 'bold',
    fontSize: '14px',
    margin: '6px 0 4px 0'
  }
}));

var scenarioItems = [
  '1 - Historical reference: WorldClim',
  '2 - Recent baseline: TerraClimate',
  '3 - Updated recent zoning: ERA5-Land',
  '4 - Cross-dataset sensitivity: TerraClimate + ERA5-Land',
  '5 - Agricultural hybrid: CHIRPS precipitation + ERA5-Land temperature'
];

var scenarioSelect = ui.Select({
  items: scenarioItems,
  value: '4 - Cross-dataset sensitivity: TerraClimate + ERA5-Land',
  style: {
    stretch: 'horizontal'
  }
});

controlPanel.add(scenarioSelect);

var scenarioDescription = ui.Label({
  value: '',
  style: {
    fontSize: '11px',
    color: '#444444',
    backgroundColor: '#f5f5f5',
    padding: '7px',
    margin: '4px 0 8px 0'
  }
});

controlPanel.add(scenarioDescription);

var scenarioActionLabel = ui.Label({
  value: '',
  style: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#1b5e20',
    backgroundColor: '#e8f5e9',
    padding: '7px',
    margin: '0 0 8px 0'
  }
});

controlPanel.add(scenarioActionLabel);


// =============================================================================
// 5.2 PERIOD SELECTION
// =============================================================================

controlPanel.add(ui.Label({
  value: 'Step 2. Select the climate period',
  style: {
    fontWeight: 'bold',
    fontSize: '14px',
    margin: '6px 0 4px 0'
  }
}));

var periodPresetSelect = ui.Select({
  items: [
    '1991-2020 standard climate normal',
    '1991-2024 extended recent period',
    '2001-2024 recent-period assessment',
    'Custom period'
  ],
  value: '1991-2020 standard climate normal',
  style: {
    stretch: 'horizontal'
  }
});

controlPanel.add(periodPresetSelect);

var yearPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {
    stretch: 'horizontal'
  }
});

var startYearBox = ui.Textbox({
  placeholder: 'Start year',
  value: '1991',
  style: {
    width: '105px'
  }
});

var endYearBox = ui.Textbox({
  placeholder: 'End year',
  value: '2020',
  style: {
    width: '105px'
  }
});

yearPanel.add(ui.Label({
  value: 'Start:',
  style: {
    margin: '6px 4px 0 0'
  }
}));

yearPanel.add(startYearBox);

yearPanel.add(ui.Label({
  value: 'End:',
  style: {
    margin: '6px 4px 0 12px'
  }
}));

yearPanel.add(endYearBox);

controlPanel.add(yearPanel);

var periodNoteLabel = ui.Label({
  value: '',
  style: {
    fontSize: '11px',
    color: '#555555',
    margin: '4px 0 8px 0'
  }
});

controlPanel.add(periodNoteLabel);


// =============================================================================
// 5.3 CLASSIFICATION PURPOSE AND THRESHOLD STRATEGY
// =============================================================================

controlPanel.add(ui.Label({
  value: 'Step 3. Select the classification strategy',
  style: {
    fontWeight: 'bold',
    fontSize: '14px',
    margin: '6px 0 4px 0'
  }
}));

var classificationStrategySelect = ui.Select({
  items: [
    'Fixed user-defined Q2 thresholds for reproducible comparison',
    'Exploratory Libya-relative equal-frequency classes'
  ],
  value: 'Fixed user-defined Q2 thresholds for reproducible comparison',
  style: {
    stretch: 'horizontal'
  }
});

controlPanel.add(classificationStrategySelect);

var classificationStrategyNote = ui.Label({
  value: '',
  style: {
    fontSize: '11px',
    color: '#5d4037',
    backgroundColor: '#fff8e1',
    padding: '7px',
    margin: '4px 0 8px 0'
  }
});

controlPanel.add(classificationStrategyNote);

// =============================================================================
// 5.3 EMBERGER THRESHOLDS
// =============================================================================

controlPanel.add(ui.Label({
  value: 'Step 4. Review thresholds or quantile settings',
  style: {
    fontWeight: 'bold',
    fontSize: '14px',
    margin: '6px 0 4px 0'
  }
}));

controlPanel.add(ui.Label({
  value:
    'The five values below are preliminary, user-defined Q2 boundaries. ' +
    'They are not claimed to be universal Emberger thresholds for Libya. ' +
    'Use fixed boundaries for reproducible comparison, report them explicitly, ' +
    'and validate them with stations, published climagrams and national experts.',
  style: {
    fontSize: '11px',
    color: '#555555',
    margin: '0 0 5px 0'
  }
}));

var thresholdPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {
    stretch: 'horizontal'
  }
});

var threshold1Box = ui.Textbox({
  value: '20',
  style: {
    width: '54px'
  }
});

var threshold2Box = ui.Textbox({
  value: '40',
  style: {
    width: '54px'
  }
});

var threshold3Box = ui.Textbox({
  value: '60',
  style: {
    width: '54px'
  }
});

var threshold4Box = ui.Textbox({
  value: '100',
  style: {
    width: '58px'
  }
});

var threshold5Box = ui.Textbox({
  value: '140',
  style: {
    width: '58px'
  }
});

thresholdPanel.add(ui.Label({
  value: 'Q2:',
  style: {
    margin: '5px 4px 0 0'
  }
}));

thresholdPanel.add(threshold1Box);
thresholdPanel.add(threshold2Box);
thresholdPanel.add(threshold3Box);
thresholdPanel.add(threshold4Box);
thresholdPanel.add(threshold5Box);

controlPanel.add(thresholdPanel);

controlPanel.add(ui.Label({
  value:
    '<20 Saharan | 20-40 Arid | 40-60 Semi-arid | ' +
    '60-100 Sub-humid | 100-140 Humid | ≥140 Perhumid',
  style: {
    fontSize: '10px',
    color: '#666666',
    margin: '3px 0 8px 0'
  }
}));


// =============================================================================
// 5.4 OUTPUT SELECTION
// =============================================================================

controlPanel.add(ui.Label({
  value: 'Step 5. Select the output to display',
  style: {
    fontWeight: 'bold',
    fontSize: '14px',
    margin: '6px 0 4px 0'
  }
}));

var outputSelect = ui.Select({
  items: [
    'Bioclimatic zones',
    'Emberger Q2 index',
    'Annual precipitation',
    'Hottest-month maximum temperature',
    'Coldest-month minimum temperature',
    'Winter thermal variants',
    'Cross-dataset exact agreement',
    'Cross-dataset absolute class difference'
  ],
  value: 'Bioclimatic zones',
  style: {
    stretch: 'horizontal'
  }
});

controlPanel.add(outputSelect);

var outputNoteLabel = ui.Label({
  value: '',
  style: {
    fontSize: '11px',
    color: '#3e4a59',
    backgroundColor: '#e3f2fd',
    padding: '6px',
    margin: '4px 0 4px 0'
  }
});

controlPanel.add(outputNoteLabel);


// =============================================================================
// 5.5 RUN BUTTON AND STATUS
// =============================================================================

var runButton = ui.Button({
  label: 'Generate bioclimatic zones',
  style: {
    stretch: 'horizontal',
    color: 'white',
    backgroundColor: '#2e7d32',
    fontWeight: 'bold',
    margin: '10px 0 5px 0'
  }
});

controlPanel.add(runButton);

var statusLabel = ui.Label({
  value: 'Ready.',
  style: {
    fontSize: '11px',
    color: '#333333',
    backgroundColor: '#eeeeee',
    padding: '6px',
    margin: '4px 0 8px 0'
  }
});

controlPanel.add(statusLabel);


// =============================================================================
// 5.6 INFORMATION AND CHART PANELS
// =============================================================================

var informationPanel = ui.Panel({
  style: {
    padding: '7px',
    backgroundColor: '#f5f5f5',
    margin: '5px 0'
  }
});

controlPanel.add(informationPanel);

var chartPanel = ui.Panel({
  style: {
    margin: '5px 0'
  }
});

var diagnosticsCheckbox = ui.Checkbox({
  label: 'Calculate optional Q2 histogram and area charts',
  value: DEFAULT_DIAGNOSTICS_ENABLED,
  style: {
    fontSize: '11px',
    margin: '5px 0 2px 0'
  }
});

var diagnosticsNoteLabel = ui.Label({
  value:
    'Keep diagnostics off for normal map generation. Charts trigger extra ' +
    'country-wide reductions and may exceed Earth Engine user memory, ' +
    'especially for ERA5-Land and CHIRPS-based scenarios.',
  style: {
    fontSize: '10px',
    color: '#8b0000',
    backgroundColor: '#fff3e0',
    padding: '6px',
    margin: '0 0 5px 0'
  }
});

controlPanel.add(diagnosticsCheckbox);
controlPanel.add(diagnosticsNoteLabel);
controlPanel.add(chartPanel);


// =============================================================================
// 5.7 EXPORT BUTTONS
// =============================================================================

controlPanel.add(ui.Label({
  value: 'Step 6. Create export tasks',
  style: {
    fontWeight: 'bold',
    fontSize: '14px',
    margin: '8px 0 4px 0'
  }
}));

var exportZonesButton = ui.Button({
  label: 'Export bioclimatic zones',
  style: {
    stretch: 'horizontal'
  }
});

var exportQ2Button = ui.Button({
  label: 'Export Emberger Q2',
  style: {
    stretch: 'horizontal'
  }
});

var exportClimateInputsButton = ui.Button({
  label: 'Export climate-input layers',
  style: {
    stretch: 'horizontal'
  }
});

var exportComparisonButton = ui.Button({
  label: 'Export comparison layers',
  style: {
    stretch: 'horizontal'
  }
});

controlPanel.add(exportZonesButton);
controlPanel.add(exportQ2Button);
controlPanel.add(exportClimateInputsButton);
controlPanel.add(exportComparisonButton);

controlPanel.add(ui.Label({
  value:
    'The buttons create export tasks. Open the Tasks tab and click RUN ' +
    'to start each export.',
  style: {
    fontSize: '10px',
    color: '#666666',
    margin: '4px 0 8px 0'
  }
}));


// =============================================================================
// 6. LEGEND PANEL
// =============================================================================

var legendPanel = ui.Panel({
  style: {
    position: 'bottom-right',
    padding: '8px 12px',
    backgroundColor: 'ffffff'
  }
});

function addLegendRow(panel, colour, text) {
  var colourBox = ui.Label({
    style: {
      backgroundColor: colour,
      padding: '8px',
      margin: '0 5px 4px 0'
    }
  });

  var description = ui.Label({
    value: text,
    style: {
      margin: '0 0 4px 0'
    }
  });

  panel.add(ui.Panel({
    widgets: [
      colourBox,
      description
    ],
    layout: ui.Panel.Layout.flow('horizontal')
  }));
}


function drawZoneLegend() {
  legendPanel.clear();

  var activeZoneNames = getActiveZoneNamesClient();

  legendPanel.add(ui.Label({
    value: isRelativeClassification()
      ? 'Exploratory relative Q2 classes'
      : 'User-defined Q2 moisture classes',
    style: {
      fontWeight: 'bold',
      fontSize: '13px',
      margin: '0 0 5px 0'
    }
  }));

  for (var i = 0; i < activeZoneNames.length; i++) {
    addLegendRow(
      legendPanel,
      '#' + zonePalette[i],
      (i + 1) + ' - ' + activeZoneNames[i]
    );
  }
}


function drawWinterLegend() {
  legendPanel.clear();

  legendPanel.add(ui.Label({
    value: 'Winter thermal variants',
    style: {
      fontWeight: 'bold',
      fontSize: '13px',
      margin: '0 0 5px 0'
    }
  }));

  for (var i = 0; i < winterNames.length; i++) {
    addLegendRow(
      legendPanel,
      '#' + winterPalette[i],
      (i + 1) + ' - ' + winterNames[i]
    );
  }
}


function drawAgreementLegend() {
  legendPanel.clear();

  legendPanel.add(ui.Label({
    value: 'Cross-dataset exact agreement',
    style: {
      fontWeight: 'bold',
      fontSize: '13px',
      margin: '0 0 5px 0'
    }
  }));

  addLegendRow(
    legendPanel,
    '#d73027',
    '0 - Different classes'
  );

  addLegendRow(
    legendPanel,
    '#1a9850',
    '1 - Same class'
  );
}


function drawDifferenceLegend() {
  legendPanel.clear();

  legendPanel.add(ui.Label({
    value: 'Cross-dataset absolute class difference',
    style: {
      fontWeight: 'bold',
      fontSize: '13px',
      margin: '0 0 5px 0'
    }
  }));

  addLegendRow(
    legendPanel,
    '#1a9850',
    '0 - Exact agreement'
  );

  addLegendRow(
    legendPanel,
    '#fee08b',
    '1 - Adjacent classes'
  );

  addLegendRow(
    legendPanel,
    '#fc8d59',
    '2 - Moderate difference'
  );

  addLegendRow(
    legendPanel,
    '#d73027',
    '3 - Strong difference'
  );

  addLegendRow(
    legendPanel,
    '#7f0000',
    '4 or more - Very strong difference'
  );
}


function drawContinuousLegend(title, minimum, maximum, palette) {
  legendPanel.clear();

  legendPanel.add(ui.Label({
    value: title,
    style: {
      fontWeight: 'bold',
      fontSize: '13px',
      margin: '0 0 5px 0'
    }
  }));

  var longitude = ee.Image.pixelLonLat().select('longitude');

  var gradient = longitude.multiply(
    (maximum - minimum) / 100
  ).add(minimum);

  var thumbnail = ui.Thumbnail({
    image: gradient.visualize({
      min: minimum,
      max: maximum,
      palette: palette
    }),
    params: {
      bbox: '0,0,100,10',
      dimensions: '220x20'
    },
    style: {
      stretch: 'horizontal',
      margin: '0 0 4px 0',
      maxHeight: '24px'
    }
  });

  var labels = ui.Panel({
    widgets: [
      ui.Label(String(minimum)),
      ui.Label({
        value: String(maximum),
        style: {
          textAlign: 'right',
          stretch: 'horizontal'
        }
      })
    ],
    layout: ui.Panel.Layout.flow('horizontal')
  });

  legendPanel.add(thumbnail);
  legendPanel.add(labels);
}



// =============================================================================
// 6A. USER-FRIENDLY UX/UI LAYOUT REBUILD
// =============================================================================

// The scientific engine above is kept intact. The code below only reorganizes
// the existing widgets into a cleaner operational interface for non-expert users.
// Left side = workflow controls. Right side = scenario guidance, results,
// methodology, interpretation and references.

var UX_PRIMARY_GREEN = '#1b5e20';
var UX_LIGHT_GREEN = '#e8f5e9';
var UX_BLUE = '#0d47a1';
var UX_LIGHT_BLUE = '#e3f2fd';
var UX_ORANGE = '#ef6c00';
var UX_LIGHT_ORANGE = '#fff3e0';
var UX_GRAY = '#f5f7fa';
var UX_BORDER = '#d9e2ec';

var userGuidePanel = ui.Panel({
  style: {
    width: '390px',
    padding: '10px',
    backgroundColor: '#ffffff',
    stretch: 'vertical'
  }
});

var workflowStepPanel = ui.Panel();
var periodSectionPanel = ui.Panel();
var advancedSettingsContentPanel = ui.Panel();
var exportSectionPanel = ui.Panel();
var rightTabButtonPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {
    stretch: 'horizontal',
    margin: '0 0 8px 0'
  }
});
var rightTabContentPanel = ui.Panel({
  style: {
    stretch: 'both'
  }
});
var scenarioInfoCardPanel = ui.Panel();
var resultSummaryCardPanel = ui.Panel();
var quickHelpCardPanel = ui.Panel();
var referencesGuidePanel = ui.Panel();
var advancedSettingsOpen = false;
var activeRightTab = 'scenario';

function makeSectionHeader(title, subtitle, colour) {
  var panel = ui.Panel({
    style: {
      backgroundColor: colour,
      padding: '7px',
      margin: '8px 0 5px 0',
      border: '1px solid ' + UX_BORDER
    }
  });

  panel.add(ui.Label({
    value: title,
    style: {
      fontWeight: 'bold',
      fontSize: '13px',
      color: '#1f2933',
      margin: '0 0 2px 0'
    }
  }));

  if (subtitle) {
    panel.add(ui.Label({
      value: subtitle,
      style: {
        fontSize: '10px',
        color: '#52606d',
        margin: '0'
      }
    }));
  }

  return panel;
}

function makeSmallInfo(text, colour, backgroundColour) {
  return ui.Label({
    value: text,
    style: {
      fontSize: '10px',
      color: colour,
      backgroundColor: backgroundColour,
      padding: '6px',
      margin: '4px 0 4px 0'
    }
  });
}

function makeGuideTitle(text, colour) {
  return ui.Label({
    value: text,
    style: {
      fontWeight: 'bold',
      fontSize: '14px',
      color: colour,
      margin: '0 0 6px 0'
    }
  });
}

function addGuideLine(panel, label, value) {
  panel.add(ui.Label({
    value: label + ': ' + value,
    style: {
      fontSize: '11px',
      color: '#243b53',
      margin: '2px 0 2px 0'
    }
  }));
}

function buildUserFriendlyLayout() {
  controlPanel.clear();
  userGuidePanel.clear();

  controlPanel.style().set({
    width: '380px',
    padding: '10px',
    backgroundColor: '#ffffff',
    stretch: 'vertical'
  });

  titleLabel.style().set({
    fontSize: '18px',
    fontWeight: 'bold',
    color: UX_PRIMARY_GREEN,
    margin: '0 0 4px 0'
  });

  subtitleLabel.style().set({
    fontSize: '11px',
    color: '#52606d',
    margin: '0 0 8px 0'
  });

  controlPanel.add(titleLabel);
  controlPanel.add(subtitleLabel);
  controlPanel.add(makeSmallInfo(
    'Operational workflow: choose scenario, period, output, then generate. Detailed guidance is on the right panel.',
    UX_PRIMARY_GREEN,
    UX_LIGHT_GREEN
  ));

  controlPanel.add(makeSectionHeader(
    '1. Scenario',
    'Choose the dataset/workflow. Scenario-specific guidance appears on the right.',
    UX_LIGHT_GREEN
  ));
  controlPanel.add(scenarioSelect);
  controlPanel.add(scenarioDescription);
  controlPanel.add(scenarioActionLabel);

  periodSectionPanel.clear();
  periodSectionPanel.add(makeSectionHeader(
    '2. Climate period',
    'Use 1991-2020 as the standard climate normal unless an updated period is needed.',
    UX_LIGHT_BLUE
  ));
  periodSectionPanel.add(periodPresetSelect);
  periodSectionPanel.add(yearPanel);
  periodSectionPanel.add(periodNoteLabel);
  controlPanel.add(periodSectionPanel);

  controlPanel.add(makeSectionHeader(
    '3. Output',
    'Select the layer to display after running the analysis.',
    '#f0f4f8'
  ));
  controlPanel.add(outputSelect);
  controlPanel.add(outputNoteLabel);

  advancedSettingsContentPanel.clear();
  advancedSettingsContentPanel.add(makeSectionHeader(
    'Classification strategy',
    'Most users should keep the default fixed Q2 thresholds.',
    '#fff8e1'
  ));
  advancedSettingsContentPanel.add(classificationStrategySelect);
  advancedSettingsContentPanel.add(classificationStrategyNote);
  advancedSettingsContentPanel.add(ui.Label({
    value: 'Q2 thresholds',
    style: {
      fontWeight: 'bold',
      fontSize: '11px',
      margin: '6px 0 2px 0'
    }
  }));
  advancedSettingsContentPanel.add(thresholdPanel);
  advancedSettingsContentPanel.add(makeSmallInfo(
    '<20 Saharan | 20-40 Arid | 40-60 Semi-arid | 60-100 Sub-humid | 100-140 Humid | >=140 Perhumid',
    '#5d4037',
    '#fff8e1'
  ));
  advancedSettingsContentPanel.add(makeSectionHeader(
    'Optional diagnostics',
    'may cause server-side reductions.',
    UX_LIGHT_ORANGE
  ));
  advancedSettingsContentPanel.add(diagnosticsCheckbox);
  advancedSettingsContentPanel.add(diagnosticsNoteLabel);
  advancedSettingsContentPanel.style().set('shown', false);

  var advancedToggleButton = ui.Button({
    label: 'Show advanced settings',
    style: {
      stretch: 'horizontal',
      margin: '8px 0 4px 0'
    },
    onClick: function() {
      advancedSettingsOpen = !advancedSettingsOpen;
      advancedSettingsContentPanel.style().set('shown', advancedSettingsOpen);
      advancedToggleButton.setLabel(
        advancedSettingsOpen ? 'Hide advanced settings' : 'Show advanced settings'
      );
    }
  });

  controlPanel.add(advancedToggleButton);
  controlPanel.add(advancedSettingsContentPanel);

  controlPanel.add(makeSectionHeader(
    '4. Generate',
    'Run the selected workflow and display the selected output.',
    UX_LIGHT_GREEN
  ));
  runButton.setLabel('GENERATE MAP');
  runButton.style().set({
    stretch: 'horizontal',
    color: 'white',
    backgroundColor: '#2e7d32',
    fontWeight: 'bold',
    margin: '6px 0 5px 0'
  });
  controlPanel.add(runButton);
  controlPanel.add(statusLabel);

  exportSectionPanel.clear();
  exportSectionPanel.add(makeSectionHeader(
    '5. Export',
    'Create GeoTIFF export tasks after results are generated.',
    '#f0f4f8'
  ));
  exportSectionPanel.add(exportZonesButton);
  exportSectionPanel.add(exportQ2Button);
  exportSectionPanel.add(exportClimateInputsButton);
  exportSectionPanel.add(exportComparisonButton);
  exportSectionPanel.add(makeSmallInfo(
    'Export buttons create tasks only. Open the Tasks tab and click RUN for each export.',
    '#52606d',
    '#f5f7fa'
  ));
  exportSectionPanel.style().set('shown', false);
  controlPanel.add(exportSectionPanel);

  userGuidePanel.add(ui.Label({
    value: 'Guidance and Results',
    style: {
      fontSize: '17px',
      fontWeight: 'bold',
      color: UX_BLUE,
      margin: '0 0 4px 0'
    }
  }));
  userGuidePanel.add(makeSmallInfo(
    'This panel changes with the selected scenario and keeps the map controls simple.',
    '#0d47a1',
    '#e3f2fd'
  ));

  var scenarioTabButton = ui.Button({
    label: 'Scenario',
    style: {stretch: 'horizontal'},
    onClick: function() { renderRightTab('scenario'); }
  });
  var methodTabButton = ui.Button({
    label: 'Method',
    style: {stretch: 'horizontal'},
    onClick: function() { renderRightTab('method'); }
  });
  var interpretationTabButton = ui.Button({
    label: 'Use',
    style: {stretch: 'horizontal'},
    onClick: function() { renderRightTab('interpretation'); }
  });
  var referencesTabButton = ui.Button({
    label: 'Refs',
    style: {stretch: 'horizontal'},
    onClick: function() { renderRightTab('references'); }
  });

  rightTabButtonPanel.clear();
  rightTabButtonPanel.add(scenarioTabButton);
  rightTabButtonPanel.add(methodTabButton);
  rightTabButtonPanel.add(interpretationTabButton);
  rightTabButtonPanel.add(referencesTabButton);

  userGuidePanel.add(rightTabButtonPanel);
  userGuidePanel.add(rightTabContentPanel);
}

function renderScenarioInfoCard(scenarioNumber) {
  scenarioInfoCardPanel.clear();
  scenarioInfoCardPanel.add(makeGuideTitle('Scenario guidance', UX_PRIMARY_GREEN));

  if (scenarioNumber === 1) {
    scenarioInfoCardPanel.add(makeGuideTitle('WorldClim historical reference', '#5d4037'));
    addGuideLine(scenarioInfoCardPanel, 'Dataset', 'WorldClim V1 monthly climatology');
    addGuideLine(scenarioInfoCardPanel, 'Approximate resolution', WORLDCLIM_APPROX_KM + ' km');
    addGuideLine(scenarioInfoCardPanel, 'Period', 'Fixed historical climatology 1961–1990');
    addGuideLine(scenarioInfoCardPanel, 'Best use', 'Reference map and comparison with legacy Libyan bioclimatic maps');
    addGuideLine(scenarioInfoCardPanel, 'User action', 'Select output and generate; period settings are not required');
  }

  if (scenarioNumber === 2) {
    scenarioInfoCardPanel.add(makeGuideTitle('TerraClimate recent baseline', UX_PRIMARY_GREEN));
    addGuideLine(scenarioInfoCardPanel, 'Dataset', 'TerraClimate');
    addGuideLine(scenarioInfoCardPanel, 'Approximate resolution', TERRACLIMATE_APPROX_KM + ' km');
    addGuideLine(scenarioInfoCardPanel, 'Recommended period', '1991-2020 standard climate normal');
    addGuideLine(scenarioInfoCardPanel, 'Best use', 'Main recent climate-normal bioclimatic zoning');
    addGuideLine(scenarioInfoCardPanel, 'User action', 'Use fixed thresholds when comparing periods or datasets');
  }

  if (scenarioNumber === 3) {
    scenarioInfoCardPanel.add(makeGuideTitle('ERA5-Land updated recent zoning', UX_BLUE));
    addGuideLine(scenarioInfoCardPanel, 'Dataset', 'ERA5-Land');
    addGuideLine(scenarioInfoCardPanel, 'Approximate resolution', ERA5_LAND_APPROX_KM + ' km');
    addGuideLine(scenarioInfoCardPanel, 'Standard period', '1991-2020');
    addGuideLine(scenarioInfoCardPanel, 'Extended period', '1991-2025');
    addGuideLine(scenarioInfoCardPanel, 'Best use', 'National and broad regional climate-zoning interpretation');
    scenarioInfoCardPanel.add(makeSmallInfo(
      'Keep diagnostics off unless you specifically need the histogram or area chart.',
      '#8b0000',
      UX_LIGHT_ORANGE
    ));
  }

  if (scenarioNumber === 4) {
    scenarioInfoCardPanel.add(makeGuideTitle('Cross-dataset sensitivity', UX_ORANGE));
    addGuideLine(scenarioInfoCardPanel, 'Datasets', 'TerraClimate + ERA5-Land');
    addGuideLine(scenarioInfoCardPanel, 'Main zoning map', 'TerraClimate');
    addGuideLine(scenarioInfoCardPanel, 'Comparison layer', 'ERA5-Land');
    addGuideLine(scenarioInfoCardPanel, 'Recommended shared period', '1991-2020');
    addGuideLine(scenarioInfoCardPanel, 'Best use', 'Check whether class boundaries are sensitive to dataset choice');
    scenarioInfoCardPanel.add(makeSmallInfo(
      'Important: agreement is sensitivity evidence, not ground validation or accuracy.',
      '#8b0000',
      UX_LIGHT_ORANGE
    ));
  }

  if (scenarioNumber === 5) {
    scenarioInfoCardPanel.add(makeGuideTitle('Agricultural hybrid', '#00695c'));
    addGuideLine(scenarioInfoCardPanel, 'Precipitation', 'CHIRPS daily precipitation');
    addGuideLine(scenarioInfoCardPanel, 'Temperature', 'ERA5-Land temperature');
    addGuideLine(scenarioInfoCardPanel, 'Approximate CHIRPS resolution', CHIRPS_APPROX_KM + ' km');
    addGuideLine(scenarioInfoCardPanel, 'Approximate ERA5-Land resolution', ERA5_LAND_APPROX_KM + ' km');
    addGuideLine(scenarioInfoCardPanel, 'Best use', 'Agricultural climate background where precipitation detail is important');
    scenarioInfoCardPanel.add(makeSmallInfo(
      'Effective spatial detail is limited by the coarser temperature input.',
      '#00695c',
      '#e0f2f1'
    ));
  }
}

function renderResultSummaryCard() {
  resultSummaryCardPanel.clear();
  resultSummaryCardPanel.add(makeGuideTitle('Result summary', UX_BLUE));

  if (appState.result === null) {
    resultSummaryCardPanel.add(makeSmallInfo(
      'No result yet. Select scenario, period and output, then click GENERATE MAP.',
      '#52606d',
      '#f5f7fa'
    ));
    return;
  }

  addGuideLine(resultSummaryCardPanel, 'Scenario', scenarioSelect.getValue());

  if (appState.scenarioNumber !== 1) {
    addGuideLine(resultSummaryCardPanel, 'Period', appState.startYear + '-' + appState.endYear);
  } else {
    addGuideLine(resultSummaryCardPanel, 'Period', 'Fixed historical climatology');
  }

  addGuideLine(resultSummaryCardPanel, 'Displayed output', outputSelect.getValue());
  addGuideLine(resultSummaryCardPanel, 'Classification', classificationStrategySelect.getValue());
  addGuideLine(resultSummaryCardPanel, 'Export spacing', (getScenarioExportScale() / 1000) + ' km');

  resultSummaryCardPanel.add(makeSmallInfo(
    'Exported maps retain the original spatial resolution.',
    UX_PRIMARY_GREEN,
    UX_LIGHT_GREEN
  ));
}

function buildReferencesGuidePanel() {
  referencesGuidePanel.clear();
  referencesGuidePanel.add(makeGuideTitle('References used by this app', UX_BLUE));
  referencesGuidePanel.add(ui.Label('Emberger, L. (1930). Original pluviothermic formulation.'));
  referencesGuidePanel.add(ui.Label('Daget, P. (1977). Mediterranean bioclimate and the Emberger system.'));
  referencesGuidePanel.add(ui.Label('Funk et al. (2015). CHIRPS precipitation dataset. Scientific Data.'));
  referencesGuidePanel.add(ui.Label('Abatzoglou et al. (2018). TerraClimate. Scientific Data.'));
  referencesGuidePanel.add(ui.Label('Munoz-Sabater et al. (2021). ERA5-Land. Earth System Science Data.'));
  referencesGuidePanel.add(ui.Label('WMO-No. 1203. Guidelines on the Calculation of Climate Normals.'));
  referencesGuidePanel.add(makeSmallInfo(
    'Dataset agreement is sensitivity evidence, not ground validation.',
    '#8b0000',
    UX_LIGHT_ORANGE
  ));
}

function renderRightTab(tabName) {
  activeRightTab = tabName;
  rightTabContentPanel.clear();

  if (tabName === 'scenario') {
    renderScenarioInfoCard(appState.scenarioNumber || getScenarioNumber());
    renderResultSummaryCard();
    rightTabContentPanel.add(scenarioInfoCardPanel);
    rightTabContentPanel.add(resultSummaryCardPanel);
    rightTabContentPanel.add(informationPanel);
    rightTabContentPanel.add(chartPanel);
  }

  if (tabName === 'method') {
    rightTabContentPanel.add(methodologyGuidePanel);
    rightTabContentPanel.add(spatialResolutionGuidePanel);
  }

  if (tabName === 'interpretation') {
    rightTabContentPanel.add(limitationLabel);
    rightTabContentPanel.add(validationGuidePanel);
    rightTabContentPanel.add(makeSmallInfo(
      'For operational AEZ or crop planning, combine this climatic zoning with LGP, soils, terrain, irrigation, land use and crop requirements.',
      '#8b0000',
      UX_LIGHT_ORANGE
    ));
  }

  if (tabName === 'references') {
    buildReferencesGuidePanel();
    rightTabContentPanel.add(referencesGuidePanel);
  }
}

function syncUXVisibility() {
  var scenarioNumber = appState.scenarioNumber || getScenarioNumber();
  periodSectionPanel.style().set('shown', scenarioNumber !== 1);
  exportComparisonButton.setDisabled(scenarioNumber !== 4);
  exportSectionPanel.style().set('shown', appState.result !== null);

  if (scenarioNumber === 1) {
    scenarioActionLabel.setValue('Period is fixed for WorldClim. Select output and generate.');
  }

  if (scenarioNumber === 3) {
    scenarioActionLabel.setValue('Recommended: keep diagnostics off for ERA5-Land, especially for 1991-2025.');
  }

  if (scenarioNumber === 4) {
    scenarioActionLabel.setValue('Use one shared period and fixed thresholds so the comparison is meaningful.');
  }

  renderScenarioInfoCard(scenarioNumber);
  renderResultSummaryCard();

  if (activeRightTab === 'scenario') {
    renderRightTab('scenario');
  }
}

// =============================================================================
// 7. INTERFACE INITIALIZATION
// =============================================================================

// Rebuild the interface into a clearer two-panel layout before it is inserted.
buildUserFriendlyLayout();

// Add the legend to the existing Earth Engine map.
Map.add(legendPanel);

// Set the control-panel dimensions.
controlPanel.style().set({
  width: '440px',
  stretch: 'vertical'
});

// Insert only the control panel into the existing Earth Engine interface.
// The default Map already exists in ui.root and must not be added again.
ui.root.insert(0, controlPanel);
ui.root.insert(1, userGuidePanel);


// =============================================================================
// 8. GENERAL HELPER FUNCTIONS
// =============================================================================

function getScenarioNumber() {
  return parseInt(
    scenarioSelect.getValue().split(' - ')[0],
    10
  );
}


function getScenarioName(scenarioNumber) {
  if (scenarioNumber === 1) {
    return 'WorldClim_Historical';
  }

  if (scenarioNumber === 2) {
    return 'TerraClimate';
  }

  if (scenarioNumber === 3) {
    return 'ERA5_Land';
  }

  if (scenarioNumber === 4) {
    return 'TerraClimate_ERA5_Land_Comparison';
  }

  return 'CHIRPS_ERA5_Land_Hybrid';
}


function getThresholds() {
  return [
    Number(threshold1Box.getValue()),
    Number(threshold2Box.getValue()),
    Number(threshold3Box.getValue()),
    Number(threshold4Box.getValue()),
    Number(threshold5Box.getValue())
  ];
}


function validateThresholds(thresholds) {
  for (var i = 0; i < thresholds.length; i++) {
    if (!isFinite(thresholds[i])) {
      throw new Error(
        'All Q2 thresholds must be valid numbers.'
      );
    }
  }

  for (var j = 1; j < thresholds.length; j++) {
    if (thresholds[j] <= thresholds[j - 1]) {
      throw new Error(
        'Q2 thresholds must increase continuously from left to right.'
      );
    }
  }
}


function validatePeriod(
  scenarioNumber,
  startYear,
  endYear
) {
  if (scenarioNumber === 1) {
    return;
  }

  if (!isFinite(startYear) || !isFinite(endYear)) {
    throw new Error(
      'Start year and end year must be valid complete calendar years.'
    );
  }

  if (startYear > endYear) {
    throw new Error(
      'Start year cannot be later than end year.'
    );
  }

  if (scenarioNumber === 2) {
    if (
      startYear < TERRACLIMATE_FIRST_YEAR ||
      endYear > TERRACLIMATE_LAST_YEAR
    ) {
      throw new Error(
        'TerraClimate requires a complete period between ' +
        TERRACLIMATE_FIRST_YEAR +
        ' and ' +
        TERRACLIMATE_LAST_YEAR +
        '. The recommended standard climate normal is 1991-2020.'
      );
    }
  }

  if (scenarioNumber === 3) {
    if (
      startYear < ERA5_FIRST_YEAR ||
      endYear > ERA5_LAST_YEAR
    ) {
      throw new Error(
        'ERA5-Land requires a complete period between ' +
        ERA5_FIRST_YEAR +
        ' and ' +
        ERA5_LAST_YEAR +
        '. Use 1991-2020 for a standard climate normal or 1991-2025 ' +
        'for an extended recent-period assessment.'
      );
    }
  }

  if (scenarioNumber === 4) {
    if (
      startYear < SHARED_FIRST_YEAR ||
      endYear > SHARED_LAST_YEAR
    ) {
      throw new Error(
        'Scenario 4 requires one identical complete period for both ' +
        'TerraClimate and ERA5-Land. Select years between ' +
        SHARED_FIRST_YEAR +
        ' and ' +
        SHARED_LAST_YEAR +
        '. The recommended comparison period is 1991-2020.'
      );
    }
  }

  if (scenarioNumber === 5) {
    if (
      startYear < CHIRPS_FIRST_YEAR ||
      endYear > CHIRPS_LAST_YEAR
    ) {
      throw new Error(
        'The CHIRPS + ERA5-Land hybrid requires complete years between ' +
        CHIRPS_FIRST_YEAR +
        ' and ' +
        CHIRPS_LAST_YEAR +
        '. Recommended: 1991-2020 for a standard climate normal.'
      );
    }
  }
}


function clearMapLayers() {
  Map.layers().reset([]);
  Map.centerObject(libya, 5);
}


function addLibyaBoundary() {
  var boundaryImage = ee.Image()
    .byte()
    .paint({
      featureCollection: libyaFeatureCollection,
      color: 1,
      width: 2
    });

  Map.addLayer(
    boundaryImage,
    {
      palette: ['000000']
    },
    'Libya boundary',
    true
  );
}


// =============================================================================
// 9. SCENARIO-DEPENDENT INTERFACE
// =============================================================================

function showScenarioInstructions(scenarioNumber) {
  informationPanel.clear();

  informationPanel.add(ui.Label({
    value: 'Selected scenario',
    style: {
      fontWeight: 'bold',
      fontSize: '13px',
      color: '#1b5e20',
      margin: '0 0 5px 0'
    }
  }));

  if (scenarioNumber === 1) {
    informationPanel.add(ui.Label('Dataset: WorldClim V1'));
    informationPanel.add(ui.Label('Period: Fixed historical climatology 1961–1990'));
    informationPanel.add(ui.Label(
      'Use: Historical reference and comparison with legacy Libyan maps.'
    ));
  }

  if (scenarioNumber === 2) {
    informationPanel.add(ui.Label('Dataset: TerraClimate'));
    informationPanel.add(ui.Label('Allowed complete period: 1958-2024'));
    informationPanel.add(ui.Label('Recommended baseline: 1991-2020'));
  }

  if (scenarioNumber === 3) {
    informationPanel.add(ui.Label('Dataset: ERA5-Land'));
    informationPanel.add(ui.Label('Allowed period in this tool: 1950-2025'));
    informationPanel.add(ui.Label(
      'Standard normal: 1991-2020 | Optional recent update: 1991-2025'
    ));
  }

  if (scenarioNumber === 4) {
    informationPanel.add(ui.Label(
      'Datasets: TerraClimate and ERA5-Land'
    ));
    informationPanel.add(ui.Label(
      'Allowed shared complete period: 1958-2024'
    ));
    informationPanel.add(ui.Label(
      'Recommended shared period: 1991-2020'
    ));
    informationPanel.add(ui.Label(
      'Main map: TerraClimate | Secondary comparison: ERA5-Land'
    ));
    informationPanel.add(ui.Label(
      'Combination method: No averaging'
    ));
  }

  if (scenarioNumber === 5) {
    informationPanel.add(ui.Label(
      'Inputs: CHIRPS precipitation + ERA5-Land temperature'
    ));
    informationPanel.add(ui.Label(
      'Allowed complete period: 1981-2025'
    ));
    informationPanel.add(ui.Label(
      'Approximate native resolution: CHIRPS 5.5 km; ERA5-Land 9 km'
    ));
    informationPanel.add(ui.Label(
      'Effective hybrid detail is limited by the coarser ERA5-Land input.'
    ));
    informationPanel.add(ui.Label(
      'Recommended agricultural climate baseline: 1991-2020'
    ));
  }

  informationPanel.add(ui.Label({
    value:
      'Changing the period changes the climate climatology and may move ' +
      'zone boundaries. Dataset agreement is interpretable only when both ' +
      'datasets use exactly the same period, equation and thresholds.',
    style: {
      color: '#8b0000',
      backgroundColor: '#fff3e0',
      padding: '6px',
      margin: '6px 0 0 0'
    }
  }));
}


function updateScenarioInterface() {
  var scenarioNumber = getScenarioNumber();

  // Clear the previous result because a changed scenario requires rerunning.
  appState.result = null;
  chartPanel.clear();
  outputSelect.setValue('Bioclimatic zones', false);

  // Relative classes are allowed for exploratory single-scenario mapping.
  // Scenario 4 requires one fixed classification so map agreement is based
  // on identical Q2 boundaries rather than separately fitted percentiles.
  classificationStrategySelect.setDisabled(false);

  statusLabel.setValue(
    'Scenario changed. Review the description and period, then click ' +
    '“Generate bioclimatic zones”.'
  );

  if (scenarioNumber === 1) {
    scenarioDescription.setValue(
      'Historical reference using the fixed WorldClim V1 monthly ' +
      'climatology. Use this scenario to compare reconstructed historical ' +
      'bioclimatic patterns with legacy Libyan maps.'
    );

    scenarioActionLabel.setValue(
      'What happens: The tool creates one historical WorldClim Q2 map, ' +
      'bioclimatic-zone map and winter-variant map.'
    );

    periodPresetSelect.setDisabled(true);
    startYearBox.setDisabled(true);
    endYearBox.setDisabled(true);

    startYearBox.setValue('Fixed', false);
    endYearBox.setValue('Fixed', false);

    periodNoteLabel.setValue(
      'Period controls are disabled because WorldClim V1 is a fixed ' +
      'historical climatology. Changing years cannot change this result.'
    );

    exportComparisonButton.setDisabled(true);
  }

  if (scenarioNumber === 2) {
    scenarioDescription.setValue(
      'TerraClimate-only bioclimatic zoning. This is the preferred ' +
      'single-dataset scenario when relatively detailed recent spatial ' +
      'patterns are required.'
    );

    scenarioActionLabel.setValue(
      'What happens: The selected years are converted to 12 monthly ' +
      'climatologies, then used to calculate P, M, m, Q2 and final zones.'
    );

    periodPresetSelect.setDisabled(false);
    startYearBox.setDisabled(false);
    endYearBox.setDisabled(false);

    periodPresetSelect.setValue(
      '1991-2020 standard climate normal',
      false
    );

    startYearBox.setValue('1991', false);
    endYearBox.setValue('2020', false);

    periodNoteLabel.setValue(
      'Choose complete years from 1958 to 2024. Recommended: 1991-2020, ' +
      'the standard 30-year climate normal. Other periods answer different ' +
      'questions and may shift zone boundaries.'
    );

    exportComparisonButton.setDisabled(true);
  }

  if (scenarioNumber === 3) {
    scenarioDescription.setValue(
      'ERA5-Land-only zoning for a standard or updated recent national-scale ' +
      'assessment. It is appropriate for broad zones, not parcel decisions.'
    );

    scenarioActionLabel.setValue(
      'What happens: The tool creates an ERA5-Land Q2 and bioclimatic map ' +
      'for the selected period.'
    );

    periodPresetSelect.setDisabled(false);
    startYearBox.setDisabled(false);
    endYearBox.setDisabled(false);

    periodPresetSelect.setValue('Custom period', false);
    startYearBox.setValue('1991', false);
    endYearBox.setValue('2025', false);

    periodNoteLabel.setValue(
      'Choose complete years from 1950 to 2025. The default 1991-2025 ' +
      'includes recent conditions but is not a standard climate normal. ' +
      'Use 1991-2020 when a standard climate normal is required. Daily ' +
      'temperature data are reduced in memory-safe year-month chunks.'
    );

    exportComparisonButton.setDisabled(true);
  }

  if (scenarioNumber === 4) {
    classificationStrategySelect.setValue(
      'Fixed user-defined Q2 thresholds for reproducible comparison',
      false
    );
    classificationStrategySelect.setDisabled(true);
    updateClassificationStrategyGuidance();

    scenarioDescription.setValue(
      'Cross-dataset sensitivity assessment. TerraClimate and ERA5-Land ' +
      'are processed independently over exactly the same selected period. ' +
      'TerraClimate is the main map and ERA5-Land is the secondary comparison.'
    );

    scenarioActionLabel.setValue(
      'What happens: Two separate classifications are generated. They are ' +
      'not averaged. The tool calculates exact agreement and absolute class ' +
      'difference between them.'
    );

    periodPresetSelect.setDisabled(false);
    startYearBox.setDisabled(false);
    endYearBox.setDisabled(false);

    periodPresetSelect.setValue(
      '1991-2020 standard climate normal',
      false
    );

    startYearBox.setValue('1991', false);
    endYearBox.setValue('2020', false);

    periodNoteLabel.setValue(
      'Recommended: 1991-2020. Scenario 4 is not limited to this period. ' +
      'You may select another shared complete period from 1958 to 2024. ' +
      'The same years and fixed Q2 boundaries automatically apply to both ' +
      'datasets. ERA5-Land daily temperature is processed in year-month chunks.'
    );

    exportComparisonButton.setDisabled(false);
  }

  if (scenarioNumber === 5) {
    scenarioDescription.setValue(
      'Agricultural hybrid methodology: CHIRPS supplies precipitation (P), ' +
      'while ERA5-Land supplies hottest-month maximum temperature (M) and ' +
      'coldest-month minimum temperature (m).'
    );

    scenarioActionLabel.setValue(
      'What happens: Annual CHIRPS rainfall totals are averaged across the ' +
      'selected years. ERA5-Land monthly temperature climatologies are used ' +
      'for M and m. Q2 is then calculated from these combined inputs.'
    );

    periodPresetSelect.setDisabled(false);
    startYearBox.setDisabled(false);
    endYearBox.setDisabled(false);
    periodPresetSelect.setValue(
      '1991-2020 standard climate normal',
      false
    );
    startYearBox.setValue('1991', false);
    endYearBox.setValue('2020', false);

    periodNoteLabel.setValue(
      'Choose complete years from 1981 to 2025. Recommended: 1991-2020. ' +
      'CHIRPS is approximately 5.5 km and ERA5-Land approximately 9 km. ' +
      'The hybrid result is therefore not a field- or parcel-scale product. ' +
      'CHIRPS and ERA5-Land daily inputs are processed in year-month chunks ' +
      'to stay within Earth Engine memory limits.'
    );

    exportComparisonButton.setDisabled(true);
  }

  updateOutputNote();
  showScenarioInstructions(scenarioNumber);
}

scenarioSelect.onChange(function() {
  updateScenarioInterface();
});


// =============================================================================
// 10. PERIOD PRESETS
// =============================================================================

periodPresetSelect.onChange(function(value) {
  var scenarioNumber = getScenarioNumber();

  if (scenarioNumber === 1) {
    return;
  }

  if (value === '1991-2020 standard climate normal') {
    startYearBox.setValue('1991', false);
    endYearBox.setValue('2020', false);

    statusLabel.setValue(
      '1991-2020 selected: recommended standard 30-year climate normal.'
    );
  }

  if (value === '1991-2024 extended recent period') {
    startYearBox.setValue('1991', false);
    endYearBox.setValue('2024', false);

    statusLabel.setValue(
      '1991-2024 selected: extended recent period, not a standard ' +
      '30-year climate normal.'
    );
  }

  if (value === '2001-2024 recent-period assessment') {
    startYearBox.setValue('2001', false);
    endYearBox.setValue('2024', false);

    statusLabel.setValue(
      '2001-2024 selected: recent 24-year assessment, not a standard ' +
      'climate normal.'
    );
  }

  if (value === 'Custom period') {
    statusLabel.setValue(
      scenarioNumber === 4
        ? 'Enter one shared period from 1958 to 2024. The same years will ' +
          'be used automatically for TerraClimate and ERA5-Land.'
        : 'Enter a custom period within the selected dataset availability.'
    );
  }
});


startYearBox.onChange(function() {
  var scenarioNumber = getScenarioNumber();

  if (scenarioNumber === 1) {
    return;
  }

  periodPresetSelect.setValue('Custom period', false);

  statusLabel.setValue(
    scenarioNumber === 4
      ? 'Start year changed. This same start year will be applied to both ' +
        'TerraClimate and ERA5-Land.'
      : 'Start year changed. The analysis now uses a custom period.'
  );
});


endYearBox.onChange(function() {
  var scenarioNumber = getScenarioNumber();

  if (scenarioNumber === 1) {
    return;
  }

  periodPresetSelect.setValue('Custom period', false);

  statusLabel.setValue(
    scenarioNumber === 4
      ? 'End year changed. This same end year will be applied to both ' +
        'TerraClimate and ERA5-Land.'
      : 'End year changed. The analysis now uses a custom period.'
  );
});

function updateClassificationStrategyGuidance() {
  var strategy = classificationStrategySelect.getValue();
  var useQuantiles = strategy === 'Exploratory Libya-relative equal-frequency classes';

  threshold1Box.setDisabled(useQuantiles);
  threshold2Box.setDisabled(useQuantiles);
  threshold3Box.setDisabled(useQuantiles);
  threshold4Box.setDisabled(useQuantiles);
  threshold5Box.setDisabled(useQuantiles);

  if (useQuantiles) {
    classificationStrategyNote.setValue(
      'Exploratory Libya-relative mode. The code derives approximately equal-' +
      'frequency class boundaries at 16.67, 33.33, 50, 66.67 and 83.33 ' +
      'percentiles. Classes are labelled only as relative Q2 ranks. They are ' +
      'not formal Saharan, arid, humid or other Emberger stages, and they must ' +
      'not be used for cross-period or cross-dataset change claims.'
    );
  } else {
    classificationStrategyNote.setValue(
      'Use this mode for reproducible maps and comparisons because the same ' +
      'boundaries are applied everywhere. The default boundaries are only ' +
      'preliminary working values, not universally validated Libya thresholds. ' +
      'Inspect continuous Q2 and validate the final boundaries using stations, ' +
      'published Mediterranean climagrams and national expert knowledge.'
    );
  }

  appState.result = null;
  statusLabel.setValue(
    'Classification strategy changed. Click Generate to recalculate zones.'
  );
}

classificationStrategySelect.onChange(
  updateClassificationStrategyGuidance
);


function getClassificationThresholds(q2, manualThresholds) {
  if (
    classificationStrategySelect.getValue() ===
    'Fixed user-defined Q2 thresholds for reproducible comparison'
  ) {
    return ee.List(manualThresholds);
  }

  var percentileResult = q2.reduceRegion({
    reducer: ee.Reducer.percentile(
      [16.67, 33.33, 50, 66.67, 83.33],
      ['q16_67', 'q33_33', 'q50', 'q66_67', 'q83_33']
    ),
    geometry: libya,
    scale: DIAGNOSTIC_SCALE,
    maxPixels: DIAGNOSTIC_MAX_PIXELS,
    tileScale: 8,
    bestEffort: true,
    bestEffort: true
  });

  return ee.List([
    percentileResult.get('Q2_q16_67'),
    percentileResult.get('Q2_q33_33'),
    percentileResult.get('Q2_q50'),
    percentileResult.get('Q2_q66_67'),
    percentileResult.get('Q2_q83_33')
  ]);
}



function createMonthlyClimatologyFromDailyExtremes(
  dailyCollection,
  startYear,
  endYear,
  selectedBands
) {
  var years = ee.List.sequence(startYear, endYear);
  var months = ee.List.sequence(1, 12);

  var monthlyImages = months.map(function(month) {
    month = ee.Number(month);

    var oneMonthPerYear = years.map(function(year) {
      year = ee.Number(year);

      var monthStart = ee.Date.fromYMD(year, month, 1);
      var monthEnd = monthStart.advance(1, 'month');

      return dailyCollection
        .filterDate(monthStart, monthEnd)
        .select(selectedBands)
        .mean()
        .set({
          year: year,
          month: month
        });
    });

    return ee.ImageCollection.fromImages(oneMonthPerYear)
      .mean()
      .set({
        month: month,
        'system:index': month.format('%02d')
      });
  });

  return ee.ImageCollection.fromImages(monthlyImages);
}


function createMeanAnnualTotalFromDailyCollection(
  dailyCollection,
  startYear,
  endYear,
  bandName,
  outputBandName
) {
  var years = ee.List.sequence(startYear, endYear);
  var months = ee.List.sequence(1, 12);

  var annualImages = years.map(function(year) {
    year = ee.Number(year);

    var monthlyTotals = months.map(function(month) {
      month = ee.Number(month);

      var monthStart = ee.Date.fromYMD(year, month, 1);
      var monthEnd = monthStart.advance(1, 'month');

      return dailyCollection
        .filterDate(monthStart, monthEnd)
        .select(bandName)
        .sum()
        .max(0)
        .rename(outputBandName)
        .set({
          year: year,
          month: month
        });
    });

    return ee.ImageCollection.fromImages(monthlyTotals)
      .sum()
      .rename(outputBandName)
      .set('year', year);
  });

  return ee.ImageCollection.fromImages(annualImages)
    .mean()
    .rename(outputBandName)
    .clip(libya);
}


// =============================================================================
// 11. MONTHLY CLIMATOLOGY FUNCTION
// =============================================================================

function createMonthlyClimatology(
  imageCollection,
  selectedBands
) {
  var months = ee.List.sequence(1, 12);

  var monthlyImages = months.map(function(month) {
    month = ee.Number(month);

    var monthlyMean = imageCollection
      .filter(
        ee.Filter.calendarRange(
          month,
          month,
          'month'
        )
      )
      .select(selectedBands)
      .mean();

    return monthlyMean.set({
      month: month,
      'system:index': month.format('%02d')
    });
  });

  return ee.ImageCollection.fromImages(monthlyImages);
}




function calculateQ2(
  annualPrecipitation,
  hottestMaxC,
  coldestMinC
) {
  var hottestMaxK = hottestMaxC.add(273.15);
  var coldestMinK = coldestMinC.add(273.15);

  var denominator = hottestMaxK
    .pow(2)
    .subtract(
      coldestMinK.pow(2)
    );

  var validMask = denominator.gt(0)
    .and(annualPrecipitation.gte(0));

  return annualPrecipitation
    .multiply(2000)
    .divide(denominator)
    .rename('Q2')
    .updateMask(validMask)
    .clip(libya);
}


// =============================================================================
// 13. Q2 CLASSIFICATION
// =============================================================================

function classifyQ2(q2, thresholds) {
  var appliedThresholds = getClassificationThresholds(q2, thresholds);
  var threshold1 = ee.Number(appliedThresholds.get(0));
  var threshold2 = ee.Number(appliedThresholds.get(1));
  var threshold3 = ee.Number(appliedThresholds.get(2));
  var threshold4 = ee.Number(appliedThresholds.get(3));
  var threshold5 = ee.Number(appliedThresholds.get(4));

  return ee.Image(1)
    .where(q2.gte(threshold1), 2)
    .where(q2.gte(threshold2), 3)
    .where(q2.gte(threshold3), 4)
    .where(q2.gte(threshold4), 5)
    .where(q2.gte(threshold5), 6)
    .rename('bioclimatic_zone')
    .updateMask(q2.mask())
    .toByte()
    .clip(libya);
}


/

function classifyWinter(coldestMinC) {
  return ee.Image(1)
    .where(coldestMinC.gte(-3), 2)
    .where(coldestMinC.gte(0), 3)
    .where(coldestMinC.gte(3), 4)
    .where(coldestMinC.gte(7), 5)
    .where(coldestMinC.gte(10), 6)
    .rename('winter_variant')
    .updateMask(coldestMinC.mask())
    .toByte()
    .clip(libya);
}


// =============================================================================
// 15. METADATA FUNCTION
// =============================================================================

function addMetadata(
  image,
  datasetName,
  periodLabel,
  startYear,
  endYear
) {
  return image.set({
    country: 'Libya',
    dataset: datasetName,
    climate_period: periodLabel,
    start_year: startYear,
    end_year: endYear,
    method: 'Emberger Q2',
    formula: 'Q2 = 2000P / (M^2 - m^2)'
  });
}


// =============================================================================
// 16. WORLDCLIM PROCESSING
// =============================================================================

function buildWorldClimProduct(thresholds) {
  var collection = ee.ImageCollection(
    'WORLDCLIM/V1/MONTHLY'
  );

  // Monthly WorldClim precipitation is expressed in millimetres.
  var annualPrecipitation = collection
    .select('prec')
    .sum()
    .rename('annual_precipitation_mm')
    .clip(libya);

  // WorldClim V1 temperature bands have a scale factor of 0.1.
  var hottestMaxC = collection
    .select('tmax')
    .max()
    .multiply(0.1)
    .rename('hottest_month_tmax_c')
    .clip(libya);

  var coldestMinC = collection
    .select('tmin')
    .min()
    .multiply(0.1)
    .rename('coldest_month_tmin_c')
    .clip(libya);

  var q2 = calculateQ2(
    annualPrecipitation,
    hottestMaxC,
    coldestMinC
  );

  var zones = classifyQ2(
    q2,
    thresholds
  );

  var winter = classifyWinter(
    coldestMinC
  );

  var periodLabel = 'Fixed WorldClim V1 historical climatology';

  return {
    name: 'WorldClim',
    label: 'WorldClim historical reference',
    period: periodLabel,

    precipitation: addMetadata(
      annualPrecipitation,
      'WorldClim V1',
      periodLabel,
      null,
      null
    ),

    hottestMax: addMetadata(
      hottestMaxC,
      'WorldClim V1',
      periodLabel,
      null,
      null
    ),

    coldestMin: addMetadata(
      coldestMinC,
      'WorldClim V1',
      periodLabel,
      null,
      null
    ),

    q2: addMetadata(
      q2,
      'WorldClim V1',
      periodLabel,
      null,
      null
    ),

    zones: addMetadata(
      zones,
      'WorldClim V1',
      periodLabel,
      null,
      null
    ),

    winter: addMetadata(
      winter,
      'WorldClim V1',
      periodLabel,
      null,
      null
    )
  };
}


// =============================================================================
// 17. TERRACLIMATE PROCESSING
// =============================================================================

function buildTerraClimateProduct(
  startYear,
  endYear,
  thresholds
) {
  var startDate = ee.Date.fromYMD(
    startYear,
    1,
    1
  );

  var endDate = ee.Date.fromYMD(
    endYear + 1,
    1,
    1
  );

  var collection = ee.ImageCollection(
    'IDAHO_EPSCOR/TERRACLIMATE'
  )
    .filterDate(startDate, endDate)
    .filterBounds(libya);

  var monthlyClimatology = createMonthlyClimatology(
    collection,
    [
      'pr',
      'tmmx',
      'tmmn'
    ]
  );

  // TerraClimate precipitation is expressed in millimetres.
  var annualPrecipitation = monthlyClimatology
    .select('pr')
    .sum()
    .max(0)
    .rename('annual_precipitation_mm')
    .clip(libya);

  // TerraClimate temperature bands use a scale factor of 0.1.
  var hottestMaxC = monthlyClimatology
    .select('tmmx')
    .max()
    .multiply(0.1)
    .rename('hottest_month_tmax_c')
    .clip(libya);

  var coldestMinC = monthlyClimatology
    .select('tmmn')
    .min()
    .multiply(0.1)
    .rename('coldest_month_tmin_c')
    .clip(libya);

  var q2 = calculateQ2(
    annualPrecipitation,
    hottestMaxC,
    coldestMinC
  );

  var zones = classifyQ2(
    q2,
    thresholds
  );

  var winter = classifyWinter(
    coldestMinC
  );

  var periodLabel = startYear + '-' + endYear;

  return {
    name: 'TerraClimate',
    label: 'TerraClimate ' + periodLabel,
    period: periodLabel,

    precipitation: addMetadata(
      annualPrecipitation,
      'TerraClimate',
      periodLabel,
      startYear,
      endYear
    ),

    hottestMax: addMetadata(
      hottestMaxC,
      'TerraClimate',
      periodLabel,
      startYear,
      endYear
    ),

    coldestMin: addMetadata(
      coldestMinC,
      'TerraClimate',
      periodLabel,
      startYear,
      endYear
    ),

    q2: addMetadata(
      q2,
      'TerraClimate',
      periodLabel,
      startYear,
      endYear
    ),

    zones: addMetadata(
      zones,
      'TerraClimate',
      periodLabel,
      startYear,
      endYear
    ),

    winter: addMetadata(
      winter,
      'TerraClimate',
      periodLabel,
      startYear,
      endYear
    )
  };
}


// =============================================================================
// 18. ERA5-LAND PROCESSING
// =============================================================================

function buildERA5LandProduct(
  startYear,
  endYear,
  thresholds
) {
  var startDate = ee.Date.fromYMD(startYear, 1, 1);
  var endDate = ee.Date.fromYMD(endYear + 1, 1, 1);

  // ERA5-Land monthly aggregated data are used for both precipitation and
  // temperature. This is more memory-safe than reducing decades of daily
  // images at display time, and it still follows the Emberger requirement:
  // P = Annual precipitation, M = mean maximum temperature of the
  // hottest climatological month, and m = mean minimum temperature of the
  // coldest climatological month.
  var monthlyCollection = ee.ImageCollection(
    'ECMWF/ERA5_LAND/MONTHLY_AGGR'
  )
    .filterDate(startDate, endDate)
    .filterBounds(libya);

 
  var monthlyPrecipitationClimatology = createMonthlyClimatology(
    monthlyCollection.select('total_precipitation_sum'),
    ['total_precipitation_sum']
  );

  var annualPrecipitation = monthlyPrecipitationClimatology
    .select('total_precipitation_sum')
    .map(function(image) {
      return image.max(0);
    })
    .sum()
    .multiply(1000)
    .rename('annual_precipitation_mm')
    .clip(libya);


  var monthlyTemperatureClimatology = createMonthlyClimatology(
    monthlyCollection.select([
      'temperature_2m_max',
      'temperature_2m_min'
    ]),
    [
      'temperature_2m_max',
      'temperature_2m_min'
    ]
  );

  var hottestMaxC = monthlyTemperatureClimatology
    .select('temperature_2m_max')
    .max()
    .subtract(273.15)
    .rename('hottest_month_tmax_c')
    .clip(libya);

  var coldestMinC = monthlyTemperatureClimatology
    .select('temperature_2m_min')
    .min()
    .subtract(273.15)
    .rename('coldest_month_tmin_c')
    .clip(libya);

  var q2 = calculateQ2(
    annualPrecipitation,
    hottestMaxC,
    coldestMinC
  );

  var zones = classifyQ2(q2, thresholds);
  var winter = classifyWinter(coldestMinC);
  var periodLabel = startYear + '-' + endYear;

  return {
    name: 'ERA5_Land',
    label: 'ERA5-Land ' + periodLabel,
    period: periodLabel,
    precipitation: addMetadata(
      annualPrecipitation,
      'ERA5-Land',
      periodLabel,
      startYear,
      endYear
    ),
    hottestMax: addMetadata(
      hottestMaxC,
      'ERA5-Land monthly maximum temperature',
      periodLabel,
      startYear,
      endYear
    ),
    coldestMin: addMetadata(
      coldestMinC,
      'ERA5-Land monthly minimum temperature',
      periodLabel,
      startYear,
      endYear
    ),
    q2: addMetadata(
      q2,
      'ERA5-Land',
      periodLabel,
      startYear,
      endYear
    ),
    zones: addMetadata(
      zones,
      'ERA5-Land',
      periodLabel,
      startYear,
      endYear
    ),
    winter: addMetadata(
      winter,
      'ERA5-Land',
      periodLabel,
      startYear,
      endYear
    )
  };
}


// =============================================================================
// 18A. CHIRPS PRECIPITATION + ERA5-LAND TEMPERATURE HYBRID
// =============================================================================

function buildCHIRPSERA5HybridProduct(
  startYear,
  endYear,
  thresholds
) {
  var startDate = ee.Date.fromYMD(startYear, 1, 1);
  var endDate = ee.Date.fromYMD(endYear + 1, 1, 1);

  var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
    .filterDate(startDate, endDate)
    .filterBounds(libya)
    .select('precipitation');


  var annualPrecipitation = createMeanAnnualTotalFromDailyCollection(
    chirps,
    startYear,
    endYear,
    'precipitation',
    'annual_precipitation_mm'
  );


  var era5Monthly = ee.ImageCollection(
    'ECMWF/ERA5_LAND/MONTHLY_AGGR'
  )
    .filterDate(startDate, endDate)
    .filterBounds(libya)
    .select([
      'temperature_2m_max',
      'temperature_2m_min'
    ]);

  var monthlyTemperatureClimatology = createMonthlyClimatology(
    era5Monthly,
    [
      'temperature_2m_max',
      'temperature_2m_min'
    ]
  );

  var hottestMaxC = monthlyTemperatureClimatology
    .select('temperature_2m_max')
    .max()
    .subtract(273.15)
    .rename('hottest_month_tmax_c')
    .clip(libya);

  var coldestMinC = monthlyTemperatureClimatology
    .select('temperature_2m_min')
    .min()
    .subtract(273.15)
    .rename('coldest_month_tmin_c')
    .clip(libya);

  var q2 = calculateQ2(
    annualPrecipitation,
    hottestMaxC,
    coldestMinC
  );

  var zones = classifyQ2(q2, thresholds);
  var winter = classifyWinter(coldestMinC);
  var periodLabel = startYear + '-' + endYear;

  return {
    name: 'CHIRPS_ERA5_Land',
    label: 'CHIRPS precipitation + ERA5-Land temperature ' + periodLabel,
    period: periodLabel,
    precipitation: addMetadata(
      annualPrecipitation,
      'CHIRPS precipitation + ERA5-Land temperature',
      periodLabel,
      startYear,
      endYear
    ),
    hottestMax: addMetadata(
      hottestMaxC,
      'CHIRPS precipitation + ERA5-Land temperature',
      periodLabel,
      startYear,
      endYear
    ),
    coldestMin: addMetadata(
      coldestMinC,
      'CHIRPS precipitation + ERA5-Land temperature',
      periodLabel,
      startYear,
      endYear
    ),
    q2: addMetadata(
      q2,
      'CHIRPS precipitation + ERA5-Land temperature',
      periodLabel,
      startYear,
      endYear
    ),
    zones: addMetadata(
      zones,
      'CHIRPS precipitation + ERA5-Land temperature',
      periodLabel,
      startYear,
      endYear
    ),
    winter: addMetadata(
      winter,
      'CHIRPS precipitation + ERA5-Land temperature',
      periodLabel,
      startYear,
      endYear
    )
  };
}


// =============================================================================
// 19. TERRACLIMATE AND ERA5-LAND COMPARISON
// =============================================================================

function buildComparison(
  terraClimateProduct,
  era5Product
) {
  var terraZones = terraClimateProduct.zones
    .rename('terraclimate_zone');

  var eraZones = era5Product.zones
    .rename('era5_land_zone');

  // Absolute difference between the two zone numbers.
  var absoluteDifference = terraZones
    .subtract(eraZones)
    .abs()
    .rename('absolute_class_difference')
    .toByte()
    .clip(libya);

  // Exact agreement:
  // 1 = same class
  // 0 = different classes
  var exactAgreement = terraZones
    .eq(eraZones)
    .rename('exact_agreement')
    .toByte()
    .clip(libya);

  // Interpretation classes:
  // 1 = exact agreement
  // 2 = adjacent classes
  // 3 = difference of two classes
  // 4 = difference of three or more classes
  var agreementLevel = ee.Image(1)
    .where(absoluteDifference.eq(1), 2)
    .where(absoluteDifference.eq(2), 3)
    .where(absoluteDifference.gte(3), 4)
    .rename('agreement_level')
    .updateMask(absoluteDifference.mask())
    .toByte()
    .clip(libya);

  // Difference between continuous Q2 values.
  var q2Difference = terraClimateProduct.q2
    .subtract(era5Product.q2)
    .rename('terraclimate_minus_era5_q2')
    .clip(libya);

  return {
    exactAgreement: exactAgreement,
    absoluteDifference: absoluteDifference,
    agreementLevel: agreementLevel,
    q2Difference: q2Difference,

    comparisonStack: terraZones
      .addBands(eraZones)
      .addBands(exactAgreement)
      .addBands(absoluteDifference)
      .addBands(agreementLevel)
      .addBands(q2Difference)
  };
}


// =============================================================================
// 20. AREA STATISTICS
// =============================================================================

function calculateZoneArea(zoneImage) {
  var areaImage = ee.Image.pixelArea()
    .divide(1000000)
    .rename('area_km2')
    .addBands(
      zoneImage.rename('zone')
    );

  var groupedResult = areaImage.reduceRegion({
    reducer: ee.Reducer.sum().group({
      groupField: 1,
      groupName: 'zone'
    }),
    geometry: libya,
    scale: DIAGNOSTIC_SCALE,
    maxPixels: DIAGNOSTIC_MAX_PIXELS,
    tileScale: 8,
    bestEffort: true
  });

  var groups = ee.List(
    ee.Algorithms.If(
      groupedResult.contains('groups'),
      groupedResult.get('groups'),
      ee.List([])
    )
  );

  var zoneNameList = getActiveZoneNamesServer();

  return ee.FeatureCollection(
    groups.map(function(item) {
      item = ee.Dictionary(item);

      var zoneNumber = ee.Number(
        item.get('zone')
      ).toInt();

      var zoneName = zoneNameList.get(
        zoneNumber.subtract(1)
      );

      return ee.Feature(null, {
        zone: zoneNumber,
        zone_name: zoneName,
        area_km2: item.get('sum')
      });
    })
  );
}


function buildAreaChart(
  zoneImage,
  chartTitle,
  chartColour
) {
  var areaTable = calculateZoneArea(
    zoneImage
  );

  return ui.Chart.feature.byFeature(
    areaTable,
    'zone_name',
    ['area_km2']
  )
    .setChartType('ColumnChart')
    .setOptions({
      title: chartTitle,
      hAxis: {
        title: isRelativeClassification() ? 'Relative Q2 class' : 'Q2 moisture class',
        slantedText: true,
        slantedTextAngle: 35
      },
      vAxis: {
        title: 'Area (km²)'
      },
      legend: {
        position: 'none'
      },
      colors: [
        chartColour
      ]
    });
}


// =============================================================================
// 21. INFORMATION PANEL
// =============================================================================

function updateInformationPanel() {
  informationPanel.clear();

  var scenarioNumber = appState.scenarioNumber;
  var result = appState.result;

  informationPanel.add(ui.Label({
    value: 'Analysis summary',
    style: {
      fontWeight: 'bold',
      fontSize: '13px',
      margin: '0 0 4px 0'
    }
  }));

  informationPanel.add(ui.Label(
    'Scenario: ' + scenarioSelect.getValue()
  ));

  if (scenarioNumber === 1) {
    informationPanel.add(ui.Label(
      'Dataset: WorldClim V1 monthly historical climatology'
    ));

    informationPanel.add(ui.Label(
      'Purpose: Historical reference and comparison with legacy maps'
    ));
  }

  if (scenarioNumber === 2) {
    informationPanel.add(ui.Label(
      'Dataset: TerraClimate'
    ));

    informationPanel.add(ui.Label(
      'Period: ' +
      appState.startYear +
      '-' +
      appState.endYear
    ));

    informationPanel.add(ui.Label(
      'Purpose: Main recent bioclimatic baseline'
    ));
  }

  if (scenarioNumber === 3) {
    informationPanel.add(ui.Label(
      'Dataset: ERA5-Land'
    ));

    informationPanel.add(ui.Label(
      'Period: ' +
      appState.startYear +
      '-' +
      appState.endYear
    ));

    informationPanel.add(ui.Label(
      'Purpose: Updated recent national bioclimatic zoning'
    ));
  }

  if (scenarioNumber === 4) {
    informationPanel.add(ui.Label(
      'Datasets: TerraClimate and ERA5-Land'
    ));

    informationPanel.add(ui.Label(
      'Common period: ' +
      appState.startYear +
      '-' +
      appState.endYear
    ));

    informationPanel.add(ui.Label({
      value:
        'Main map: TerraClimate bioclimatic zones. ERA5-Land is displayed ' +
        'as an secondary comparison.',
      style: {
        color: '#1b5e20'
      }
    }));

    informationPanel.add(ui.Label({
      value:
        'Combination rule: The two datasets are not averaged. Agreement ' +
        'and absolute class difference are calculated directly.',
      style: {
        color: '#7f4500'
      }
    }));
  }

  informationPanel.add(ui.Label(
    'Formula: Q2 = 2000P / (M² - m²)'
  ));

  informationPanel.add(ui.Label(
    'P: Annual precipitation in millimetres'
  ));

  informationPanel.add(ui.Label(
    'M: mean maximum temperature of the hottest month in Kelvin'
  ));

  informationPanel.add(ui.Label(
    'm: mean minimum temperature of the coldest month in Kelvin'
  ));

  informationPanel.add(ui.Label(
    'Classification strategy: ' + classificationStrategySelect.getValue()
  ));

  informationPanel.add(ui.Label(
    isRelativeClassification()
      ? 'Class meaning: relative Q2 ranks within Libya only; not formal Emberger stages.'
      : 'Class meaning: fixed user-defined Q2 classes. Boundaries must be reported and justified.'
  ));

  informationPanel.add(ui.Label(
    'Temperature method for ERA5-Land scenarios: monthly climatologies of ' +
    'daily maximum and daily minimum 2-m air temperature.'
  ));

  if (scenarioNumber === 1) {
    informationPanel.add(ui.Label(
      'Approximate native resolution: WorldClim about 1 km.'
    ));
  }

  if (scenarioNumber === 2) {
    informationPanel.add(ui.Label(
      'Approximate native resolution: TerraClimate about 4 km.'
    ));
  }

  if (scenarioNumber === 3) {
    informationPanel.add(ui.Label(
      'Approximate native resolution: ERA5-Land about 9 km.'
    ));
  }

  if (scenarioNumber === 4) {
    informationPanel.add(ui.Label(
      'Approximate native resolution: TerraClimate about 4 km; ' +
      'ERA5-Land about 9 km. Compare patterns at national or regional scale.'
    ));
  }

  if (scenarioNumber === 5) {
    informationPanel.add(ui.Label(
      'Inputs: CHIRPS precipitation about 5.5 km and ERA5-Land ' +
      'temperature about 9 km. Effective detail is limited by ERA5-Land.'
    ));
  }

  informationPanel.add(ui.Label(
    'Recommended export spacing for this scenario: ' +
    (getScenarioExportScale() / 1000) +
    ' km. This does not create information finer than the native inputs.'
  ));

  informationPanel.add(ui.Label({
    value:
      'Validation status: candidate gridded classification. Agreement between ' +
      'two datasets is not accuracy. Validate against Libyan stations before ' +
      'publication or operational decision-making.',
    style: {
      color: '#8b0000',
      fontWeight: 'bold'
    }
  }));

  informationPanel.add(ui.Label({
    value:
      'Interpretation: This classification describes climate-based ' +
      'bioclimatic moisture conditions. It must later be integrated with ' +
      'LGP, soil, land suitability, land use and water information for ' +
      'operational crop-calendar or AEZ zoning.',
    style: {
      color: '#8b0000',
      margin: '5px 0 0 0'
    }
  }));
}


// =============================================================================
// 22. CHART PANEL
// =============================================================================

function updateChartPanel() {
  chartPanel.clear();

  chartPanel.add(ui.Label({
    value: 'Optional diagnostics',
    style: {
      fontWeight: 'bold',
      fontSize: '13px',
      margin: '0 0 4px 0'
    }
  }));

  if (!diagnosticsCheckbox.getValue()) {
    chartPanel.add(ui.Label({
      value:
        'Diagnostics were not calculated. This memory-safe default does not ' +
        'affect the map or exported raster. Enable the checkbox and rerun only ' +
        'when a histogram or area chart is required.',
      style: {
        fontSize: '11px',
        color: '#555555'
      }
    }));

    return;
  }

  chartPanel.add(ui.Chart.image.histogram({
    image: appState.result.mainProduct.q2,
    region: libya,
    scale: DIAGNOSTIC_SCALE,
    maxPixels: DIAGNOSTIC_MAX_PIXELS
  }).setOptions({
    title: 'Continuous Q2 distribution: diagnostic sample at 20 km',
    hAxis: {title: 'Emberger Q2'},
    vAxis: {title: 'Pixel frequency'},
    legend: {position: 'none'},
    colors: ['#6a1b9a']
  }));

  // Area charts are intentionally limited to the main product. Creating two
  // simultaneous national reductions for Scenario 4 can exceed user memory.
  chartPanel.add(
    buildAreaChart(
      appState.result.mainProduct.zones,
      appState.result.mainProduct.label +
      ': approximate area by class at 20 km diagnostic scale',
      '#2e7d32'
    )
  );
}


// =============================================================================
// 23. MAP DISPLAY
// =============================================================================

function displayResults() {
  if (appState.result === null) {
    return;
  }

  clearMapLayers();

  var selectedOutput = outputSelect.getValue();
  var scenarioNumber = appState.scenarioNumber;

  var mainProduct = appState.result.mainProduct;
  var secondaryProduct = appState.result.secondaryProduct;
  var comparison = appState.result.comparison;

  if (selectedOutput === 'Bioclimatic zones') {
    drawZoneLegend();

    Map.addLayer(
      mainProduct.zones,
      {
        min: 1,
        max: 6,
        palette: zonePalette
      },
      mainProduct.label + ' bioclimatic zones',
      true
    );

    if (scenarioNumber === 4) {
      Map.addLayer(
        secondaryProduct.zones,
        {
          min: 1,
          max: 6,
          palette: zonePalette
        },
        secondaryProduct.label + ' bioclimatic zones',
        false
      );
    }
  }

  if (selectedOutput === 'Emberger Q2 index') {
    drawContinuousLegend(
      'Emberger Q2',
      0,
      150,
      qPalette
    );

    Map.addLayer(
      mainProduct.q2,
      {
        min: 0,
        max: 150,
        palette: qPalette
      },
      mainProduct.label + ' Q2',
      true
    );

    if (scenarioNumber === 4) {
      Map.addLayer(
        secondaryProduct.q2,
        {
          min: 0,
          max: 150,
          palette: qPalette
        },
        secondaryProduct.label + ' Q2',
        false
      );
    }
  }

  if (selectedOutput === 'Annual precipitation') {
    drawContinuousLegend(
      'Annual precipitation, mm',
      0,
      600,
      [
        'fff7ec',
        'fee8c8',
        'fdd49e',
        'fdbb84',
        'fc8d59',
        'ef6548',
        'd7301f',
        '990000',
        '54278f'
      ]
    );

    Map.addLayer(
      mainProduct.precipitation,
      {
        min: 0,
        max: 600,
        palette: [
          'fff7ec',
          'fee8c8',
          'fdd49e',
          'fdbb84',
          'fc8d59',
          'ef6548',
          'd7301f',
          '990000',
          '54278f'
        ]
      },
      mainProduct.label + ' annual precipitation',
      true
    );

    if (scenarioNumber === 4) {
      Map.addLayer(
        secondaryProduct.precipitation,
        {
          min: 0,
          max: 600,
          palette: [
            'fff7ec',
            'fee8c8',
            'fdd49e',
            'fdbb84',
            'fc8d59',
            'ef6548',
            'd7301f',
            '990000',
            '54278f'
          ]
        },
        secondaryProduct.label + ' annual precipitation',
        false
      );
    }
  }

  if (
    selectedOutput ===
    'Hottest-month maximum temperature'
  ) {
    drawContinuousLegend(
      'Hottest-month maximum temperature, °C',
      20,
      50,
      [
        'ffffcc',
        'ffeda0',
        'fed976',
        'feb24c',
        'fd8d3c',
        'fc4e2a',
        'e31a1c',
        'bd0026',
        '800026'
      ]
    );

    Map.addLayer(
      mainProduct.hottestMax,
      {
        min: 20,
        max: 50,
        palette: [
          'ffffcc',
          'ffeda0',
          'fed976',
          'feb24c',
          'fd8d3c',
          'fc4e2a',
          'e31a1c',
          'bd0026',
          '800026'
        ]
      },
      mainProduct.label + ' hottest-month Tmax',
      true
    );

    if (scenarioNumber === 4) {
      Map.addLayer(
        secondaryProduct.hottestMax,
        {
          min: 20,
          max: 50,
          palette: [
            'ffffcc',
            'ffeda0',
            'fed976',
            'feb24c',
            'fd8d3c',
            'fc4e2a',
            'e31a1c',
            'bd0026',
            '800026'
          ]
        },
        secondaryProduct.label + ' hottest-month Tmax',
        false
      );
    }
  }

  if (
    selectedOutput ===
    'Coldest-month minimum temperature'
  ) {
    drawContinuousLegend(
      'Coldest-month minimum temperature, °C',
      -10,
      20,
      [
        '313695',
        '4575b4',
        '74add1',
        'abd9e9',
        'e0f3f8',
        'ffffbf',
        'fee090',
        'fdae61',
        'f46d43',
        'd73027',
        'a50026'
      ]
    );

    Map.addLayer(
      mainProduct.coldestMin,
      {
        min: -10,
        max: 20,
        palette: [
          '313695',
          '4575b4',
          '74add1',
          'abd9e9',
          'e0f3f8',
          'ffffbf',
          'fee090',
          'fdae61',
          'f46d43',
          'd73027',
          'a50026'
        ]
      },
      mainProduct.label + ' coldest-month Tmin',
      true
    );

    if (scenarioNumber === 4) {
      Map.addLayer(
        secondaryProduct.coldestMin,
        {
          min: -10,
          max: 20,
          palette: [
            '313695',
            '4575b4',
            '74add1',
            'abd9e9',
            'e0f3f8',
            'ffffbf',
            'fee090',
            'fdae61',
            'f46d43',
            'd73027',
            'a50026'
          ]
        },
        secondaryProduct.label + ' coldest-month Tmin',
        false
      );
    }
  }

  if (selectedOutput === 'Winter thermal variants') {
    drawWinterLegend();

    Map.addLayer(
      mainProduct.winter,
      {
        min: 1,
        max: 6,
        palette: winterPalette
      },
      mainProduct.label + ' winter variants',
      true
    );

    if (scenarioNumber === 4) {
      Map.addLayer(
        secondaryProduct.winter,
        {
          min: 1,
          max: 6,
          palette: winterPalette
        },
        secondaryProduct.label + ' winter variants',
        false
      );
    }
  }

  if (selectedOutput === 'Cross-dataset exact agreement') {
    if (scenarioNumber !== 4) {
      drawZoneLegend();

      Map.addLayer(
        mainProduct.zones,
        {
          min: 1,
          max: 6,
          palette: zonePalette
        },
        mainProduct.label + ' bioclimatic zones',
        true
      );

      statusLabel.setValue(
        'Dataset agreement is available only for Scenario 4. ' +
        'The selected single-dataset zone map is displayed instead.'
      );
    } else {
      drawAgreementLegend();

      Map.addLayer(
        comparison.exactAgreement,
        {
          min: 0,
          max: 1,
          palette: [
            'd73027',
            '1a9850'
          ]
        },
        'TerraClimate and ERA5-Land exact agreement',
        true
      );

      Map.addLayer(
        mainProduct.zones,
        {
          min: 1,
          max: 6,
          palette: zonePalette
        },
        mainProduct.label + ' zones',
        false
      );

      Map.addLayer(
        secondaryProduct.zones,
        {
          min: 1,
          max: 6,
          palette: zonePalette
        },
        secondaryProduct.label + ' zones',
        false
      );
    }
  }

  if (selectedOutput === 'Cross-dataset absolute class difference') {
    if (scenarioNumber !== 4) {
      drawZoneLegend();

      Map.addLayer(
        mainProduct.zones,
        {
          min: 1,
          max: 6,
          palette: zonePalette
        },
        mainProduct.label + ' bioclimatic zones',
        true
      );

      statusLabel.setValue(
        'Absolute class difference is available only for Scenario 4. ' +
        'The selected single-dataset zone map is displayed instead.'
      );
    } else {
      drawDifferenceLegend();

      Map.addLayer(
        comparison.absoluteDifference,
        {
          min: 0,
          max: 4,
          palette: differencePalette
        },
        'Absolute bioclimatic class difference',
        true
      );

      Map.addLayer(
        mainProduct.zones,
        {
          min: 1,
          max: 6,
          palette: zonePalette
        },
        mainProduct.label + ' zones',
        false
      );

      Map.addLayer(
        secondaryProduct.zones,
        {
          min: 1,
          max: 6,
          palette: zonePalette
        },
        secondaryProduct.label + ' zones',
        false
      );
    }
  }

  addLibyaBoundary();
}


// =============================================================================
// 24. MAIN ANALYSIS FUNCTION
// =============================================================================

function runAnalysis() {
  try {
    statusLabel.setValue(
      'Validating analysis settings...'
    );

    var scenarioNumber = getScenarioNumber();
    var scenarioName = getScenarioName(
      scenarioNumber
    );

    var thresholds = getThresholds();

    validateThresholds(
      thresholds
    );

    var startYear = null;
    var endYear = null;

    if (scenarioNumber !== 1) {
      startYear = Number(
        startYearBox.getValue()
      );

      endYear = Number(
        endYearBox.getValue()
      );
    }

    validatePeriod(
      scenarioNumber,
      startYear,
      endYear
    );

    statusLabel.setValue(
      'Preparing climate data and calculating the Emberger index...'
    );

    var result = {
      mainProduct: null,
      secondaryProduct: null,
      comparison: null,
      worldClim: null,
      terraClimate: null,
      era5Land: null,
      chirpsEra5Hybrid: null
    };

    if (scenarioNumber === 1) {
      var worldClimProduct = buildWorldClimProduct(
        thresholds
      );

      result.worldClim = worldClimProduct;
      result.mainProduct = worldClimProduct;
    }

    if (scenarioNumber === 2) {
      var terraClimateProduct = buildTerraClimateProduct(
        startYear,
        endYear,
        thresholds
      );

      result.terraClimate = terraClimateProduct;
      result.mainProduct = terraClimateProduct;
    }

    if (scenarioNumber === 3) {
      var era5LandProduct = buildERA5LandProduct(
        startYear,
        endYear,
        thresholds
      );

      result.era5Land = era5LandProduct;
      result.mainProduct = era5LandProduct;
    }

    if (scenarioNumber === 4) {
      var terraComparisonProduct = buildTerraClimateProduct(
        startYear,
        endYear,
        thresholds
      );

      var eraComparisonProduct = buildERA5LandProduct(
        startYear,
        endYear,
        thresholds
      );

      var comparisonResult = buildComparison(
        terraComparisonProduct,
        eraComparisonProduct
      );

      result.terraClimate = terraComparisonProduct;
      result.era5Land = eraComparisonProduct;

      // TerraClimate is the main zoning map.
      result.mainProduct = terraComparisonProduct;

      // ERA5-Land is the secondary comparison map.
      result.secondaryProduct = eraComparisonProduct;

      result.comparison = comparisonResult;
    }

    if (scenarioNumber === 5) {
      var hybridProduct = buildCHIRPSERA5HybridProduct(
        startYear,
        endYear,
        thresholds
      );

      result.chirpsEra5Hybrid = hybridProduct;
      result.mainProduct = hybridProduct;
    }

    appState.result = result;
    appState.scenarioNumber = scenarioNumber;
    appState.scenarioName = scenarioName;
    appState.startYear = startYear;
    appState.endYear = endYear;
    appState.thresholds = thresholds;

    displayResults();
    updateInformationPanel();
    updateChartPanel();

    statusLabel.setValue(
      'Completed. The map is ready. Optional diagnostics were ' +
      (diagnosticsCheckbox.getValue() ? 'requested.' : 'skipped to save memory.')
    );

  } catch (error) {
    statusLabel.setValue(
      'Error: ' + error.message
    );

    print(
      'Application error:',
      error
    );
  }
}


runButton.onClick(
  runAnalysis
);


diagnosticsCheckbox.onChange(function(value) {
  statusLabel.setValue(
    value
      ? 'Diagnostics enabled. Click Generate to calculate coarse diagnostic charts.'
      : 'Diagnostics disabled. Map generation will use the memory-safe default.'
  );
});


function updateOutputNote() {
  var selectedOutput = outputSelect.getValue();
  var outputNotes = {
    'Bioclimatic zones':
      'Displays classified Q2 moisture zones. In Scenario 4, TerraClimate ' +
      'is visible by default and ERA5-Land is available as a separate layer.',
    'Emberger Q2 index':
      'Displays the continuous Emberger Q2 index before classification.',
    'Annual precipitation':
      'Displays average annual precipitation used as P in the Q2 equation.',
    'Hottest-month maximum temperature':
      'Displays M in degrees Celsius. The code converts it to Kelvin for Q2.',
    'Coldest-month minimum temperature':
      'Displays m in degrees Celsius. The code converts it to Kelvin for Q2.',
    'Winter thermal variants':
      'Classifies winter conditions using coldest-month minimum temperature.',
    'Cross-dataset exact agreement':
      'Scenario 4 only. Green means exact class agreement, not proven accuracy.',
    'Cross-dataset absolute class difference':
      'Scenario 4 only. Zero is exact agreement; larger values indicate stronger dataset sensitivity, not validation error.'
  };

  outputNoteLabel.setValue(outputNotes[selectedOutput]);
}


// Redisplay the existing analysis without recalculating it.
outputSelect.onChange(function() {
  updateOutputNote();
  if (appState.result !== null) {
    displayResults();
  }
});


// =============================================================================
// 25. EXPORT NAME FUNCTION
// =============================================================================

// Export near the scientifically meaningful resolution of each scenario.
// The value controls output spacing but never increases source information.
function getScenarioExportScale() {
  if (appState.scenarioNumber === 1) {
    return 1000;
  }

  if (appState.scenarioNumber === 2) {
    return 4000;
  }

  // ERA5-Land, cross-dataset comparison and the CHIRPS-ERA5 hybrid are
  // exported at 10 km to remain close to the coarsest effective input.
  return 10000;
}

function buildExportName(outputName) {
  var periodText;

  if (appState.scenarioNumber === 1) {
    periodText = 'Historical';
  } else {
    periodText =
      appState.startYear +
      '_' +
      appState.endYear;
  }

  return [
    'Libya',
    'Emberger',
    appState.scenarioName,
    periodText,
    outputName
  ].join('_');
}


// =============================================================================
// 26. EXPORT ZONES
// =============================================================================

exportZonesButton.onClick(function() {
  if (appState.result === null) {
    statusLabel.setValue(
      'Generate the analysis before creating an export task.'
    );

    return;
  }

  var exportName = buildExportName(
    'Bioclimatic_Zones'
  );

  var exportImage = appState.result
    .mainProduct
    .zones
    .unmask(NODATA_VALUE)
    .toInt16();

  Export.image.toDrive({
    image: exportImage,
    description: exportName,
    folder: 'Libya_Emberger_Zoning',
    fileNamePrefix: exportName,
    region: libya,
    scale: getScenarioExportScale(),
    maxPixels: 1e13,
    fileFormat: 'GeoTIFF',
    formatOptions: {
      cloudOptimized: true,
      noData: NODATA_VALUE
    }
  });

  statusLabel.setValue(
    'Bioclimatic-zone export task created. ' +
    'Open the Tasks tab and click RUN.'
  );
});


// =============================================================================
// 27. EXPORT Q2
// =============================================================================

exportQ2Button.onClick(function() {
  if (appState.result === null) {
    statusLabel.setValue(
      'Generate the analysis before creating an export task.'
    );

    return;
  }

  var exportName = buildExportName(
    'Emberger_Q2'
  );

  var exportImage = appState.result
    .mainProduct
    .q2
    .unmask(NODATA_VALUE)
    .toFloat();

  Export.image.toDrive({
    image: exportImage,
    description: exportName,
    folder: 'Libya_Emberger_Zoning',
    fileNamePrefix: exportName,
    region: libya,
    scale: getScenarioExportScale(),
    maxPixels: 1e13,
    fileFormat: 'GeoTIFF',
    formatOptions: {
      cloudOptimized: true,
      noData: NODATA_VALUE
    }
  });

  statusLabel.setValue(
    'Emberger-Q2 export task created. ' +
    'Open the Tasks tab and click RUN.'
  );
});


// =============================================================================
// 28. EXPORT CLIMATE INPUT LAYERS
// =============================================================================

exportClimateInputsButton.onClick(function() {
  if (appState.result === null) {
    statusLabel.setValue(
      'Generate the analysis before creating an export task.'
    );

    return;
  }

  var exportName = buildExportName(
    'Climate_Inputs'
  );

  var mainProduct = appState.result.mainProduct;

  var climateInputStack = mainProduct
    .precipitation
    .rename('annual_precipitation_mm')
    .addBands(
      mainProduct.hottestMax.rename(
        'hottest_month_tmax_c'
      )
    )
    .addBands(
      mainProduct.coldestMin.rename(
        'coldest_month_tmin_c'
      )
    )
    .addBands(
      mainProduct.winter.rename(
        'winter_variant'
      )
    )
    .unmask(NODATA_VALUE)
    .toFloat();

  Export.image.toDrive({
    image: climateInputStack,
    description: exportName,
    folder: 'Libya_Emberger_Zoning',
    fileNamePrefix: exportName,
    region: libya,
    scale: getScenarioExportScale(),
    maxPixels: 1e13,
    fileFormat: 'GeoTIFF',
    formatOptions: {
      cloudOptimized: true,
      noData: NODATA_VALUE
    }
  });

  statusLabel.setValue(
    'Climate-input export task created. ' +
    'Open the Tasks tab and click RUN.'
  );
});


// =============================================================================
// 29. EXPORT COMPARISON LAYERS
// =============================================================================

exportComparisonButton.onClick(function() {
  if (appState.result === null) {
    statusLabel.setValue(
      'Generate Scenario 4 before creating a comparison export task.'
    );

    return;
  }

  if (appState.scenarioNumber !== 4) {
    statusLabel.setValue(
      'Comparison export is available only for Scenario 4: ' +
      'TerraClimate + ERA5-Land.'
    );

    return;
  }

  var exportName = buildExportName(
    'Dataset_Comparison'
  );

  var comparisonStack = appState.result
    .comparison
    .comparisonStack
    .unmask(NODATA_VALUE)
    .toFloat();

  Export.image.toDrive({
    image: comparisonStack,
    description: exportName,
    folder: 'Libya_Emberger_Zoning',
    fileNamePrefix: exportName,
    region: libya,
    scale: getScenarioExportScale(),
    maxPixels: 1e13,
    fileFormat: 'GeoTIFF',
    formatOptions: {
      cloudOptimized: true,
      noData: NODATA_VALUE
    }
  });

  statusLabel.setValue(
    'Comparison export task created. ' +
    'Open the Tasks tab and click RUN.'
  );
});


// =============================================================================
// 30. INITIAL INFORMATION
// =============================================================================

function showInitialInstructions() {
  informationPanel.clear();

  informationPanel.add(ui.Label({
    value: 'How to use the tool',
    style: {
      fontWeight: 'bold',
      fontSize: '13px',
      margin: '0 0 5px 0'
    }
  }));

  informationPanel.add(ui.Label(
    '1. Select one of the five analysis scenarios.'
  ));

  informationPanel.add(ui.Label(
    '2. Select the climate period where applicable.'
  ));

  informationPanel.add(ui.Label(
    '3. Choose fixed reproducible boundaries or exploratory Libya-relative classes.'
  ));

  informationPanel.add(ui.Label(
    '4. Review dataset resolution and methodology notes, then click Generate.'
  ));

  informationPanel.add(ui.Label(
    '5. Review zones, Q2, climate inputs and area statistics.'
  ));

  informationPanel.add(ui.Label(
    '6. For Scenario 4, inspect cross-dataset sensitivity; do not interpret it as accuracy.'
  ));

  informationPanel.add(ui.Label(
    '7. Create the required GeoTIFF export tasks.'
  ));
}



// =============================================================================
// 30A. UX SYNCHRONIZATION WRAPPERS
// =============================================================================

// These wrappers preserve the original analytical functions and only add
// interface synchronization after the original functions finish.
var originalUpdateScenarioInterface = updateScenarioInterface;
updateScenarioInterface = function() {
  originalUpdateScenarioInterface();
  syncUXVisibility();
};

var originalUpdateInformationPanel = updateInformationPanel;
updateInformationPanel = function() {
  originalUpdateInformationPanel();
  syncUXVisibility();
};

var originalShowInitialInstructions = showInitialInstructions;
showInitialInstructions = function() {
  originalShowInitialInstructions();
  syncUXVisibility();
};

var originalDisplayResults = displayResults;
displayResults = function() {
  originalDisplayResults();
  syncUXVisibility();
};

// =============================================================================
// 31. START APPLICATION
// =============================================================================

updateScenarioInterface();
updateClassificationStrategyGuidance();
showInitialInstructions();
updateOutputNote();
drawZoneLegend();

// Automatic startup analysis is disabled by default to avoid launching
// multiple national calculations before the user has reviewed the settings.
// The original runAnalysis call is preserved inside this explicit guard.
if (AUTO_RUN_ON_STARTUP) {
  runAnalysis();
} else {
  statusLabel.setValue(
    'Ready. Select a scenario and click Generate. Diagnostics are off by default.'
  );
}


















function addDynamicMapSymbols(mapWidget) {
  if (!mapWidget) {
    throw new Error('A valid ui.Map must be supplied.');
  }

  var TARGET_BAR_PIXELS = 180;
  var MIN_BAR_PIXELS = 100;
  var MAX_BAR_PIXELS = 240;
  var SEGMENT_COUNT = 4;

  var mainPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {
      position: 'bottom-right',
      margin: '10px',
      padding: '8px 10px',
      backgroundColor: '#ffffff',
      border: '1px solid #777777'
    }
  });

  var northArrow = ui.Label({
    value: '▲\nN',
    style: {
      width: '30px',
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#111111',
      textAlign: 'center',
      whiteSpace: 'pre',
      margin: '0 10px 0 0',
      padding: '0'
    }
  });

  var barPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {
      margin: '0',
      padding: '0',
      height: '12px'
    }
  });

  var labelPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {
      margin: '1px 0 0 0',
      padding: '0'
    }
  });

  var scalePanel = ui.Panel({
    widgets: [barPanel, labelPanel],
    layout: ui.Panel.Layout.flow('vertical'),
    style: {
      margin: '0',
      padding: '0'
    }
  });

  var symbolRow = ui.Panel({
    widgets: [northArrow, scalePanel],
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {
      margin: '0',
      padding: '0'
    }
  });

  mainPanel.add(symbolRow);
  mapWidget.add(mainPanel);

  function chooseNiceDistance(rawMetres) {
    if (!isFinite(rawMetres) || rawMetres <= 0) {
      return 1000;
    }

    var power = Math.pow(
      10,
      Math.floor(Math.log(rawMetres) / Math.LN10)
    );

    var normalized = rawMetres / power;
    var multiplier;

    if (normalized <= 1) {
      multiplier = 1;
    } else if (normalized <= 2) {
      multiplier = 2;
    } else if (normalized <= 5) {
      multiplier = 5;
    } else {
      multiplier = 10;
    }

    return multiplier * power;
  }

  function formatDistance(metres) {
    if (metres >= 1000) {
      var kilometres = metres / 1000;

      var roundedKilometres = kilometres >= 10
        ? Math.round(kilometres)
        : Math.round(kilometres * 10) / 10;

      return roundedKilometres + ' km';
    }

    if (metres >= 10) {
      return Math.round(metres) + ' m';
    }

    return (Math.round(metres * 10) / 10) + ' m';
  }

  function makeSegment(widthPixels, dark) {
    return ui.Label({
      value: '',
      style: {
        width: widthPixels + 'px',
        height: '10px',
        margin: '0',
        padding: '0',
        backgroundColor: dark ? '#111111' : '#ffffff',
        border: '1px solid #111111'
      }
    });
  }

  function makeLabel(text, widthPixels, alignment) {
    return ui.Label({
      value: text,
      style: {
        width: widthPixels + 'px',
        fontSize: '9px',
        color: '#111111',
        textAlign: alignment,
        whiteSpace: 'nowrap',
        margin: '0',
        padding: '0'
      }
    });
  }

  function updateScaleBar() {
    try {
      var metresPerPixel = Number(mapWidget.getScale());

      if (!isFinite(metresPerPixel) || metresPerPixel <= 0) {
        return;
      }

      var desiredMetres =
        metresPerPixel * TARGET_BAR_PIXELS;

      var niceMetres =
        chooseNiceDistance(desiredMetres);

      var totalPixels =
        Math.round(niceMetres / metresPerPixel);

      if (totalPixels < MIN_BAR_PIXELS) {
        niceMetres = chooseNiceDistance(
          metresPerPixel *
          TARGET_BAR_PIXELS *
          1.5
        );

        totalPixels =
          Math.round(niceMetres / metresPerPixel);
      }

      if (totalPixels > MAX_BAR_PIXELS) {
        niceMetres = chooseNiceDistance(
          metresPerPixel *
          TARGET_BAR_PIXELS *
          0.6
        );

        totalPixels =
          Math.round(niceMetres / metresPerPixel);
      }

      totalPixels = Math.max(
        MIN_BAR_PIXELS,
        Math.min(MAX_BAR_PIXELS, totalPixels)
      );

      var segmentPixels = Math.max(
        1,
        Math.floor(totalPixels / SEGMENT_COUNT)
      );

      var correctedTotalPixels =
        segmentPixels * SEGMENT_COUNT;

      var metresPerSegment =
        niceMetres / SEGMENT_COUNT;

      barPanel.clear();
      labelPanel.clear();

      for (var i = 0; i < SEGMENT_COUNT; i++) {
        barPanel.add(
          makeSegment(
            segmentPixels,
            i % 2 === 0
          )
        );
      }

      for (var j = 0; j <= SEGMENT_COUNT; j++) {
        var labelWidth =
          (j === 0 || j === SEGMENT_COUNT)
            ? Math.floor(segmentPixels / 2)
            : segmentPixels;

        var alignment = 'center';

        if (j === 0) {
          alignment = 'left';
        } else if (j === SEGMENT_COUNT) {
          alignment = 'right';
        }

        labelPanel.add(
          makeLabel(
            formatDistance(metresPerSegment * j),
            labelWidth,
            alignment
          )
        );
      }

      barPanel.style().set(
        'width',
        correctedTotalPixels + 'px'
      );

      labelPanel.style().set(
        'width',
        correctedTotalPixels + 'px'
      );

    } catch (error) {
      // Retain the last valid scale bar.
      // No Console output is produced.
    }
  }

  var boundsListenerId =
    mapWidget.onChangeBounds(function() {
      updateScaleBar();
    });

  updateScaleBar();

  return {
    panel: mainPanel,

    update: updateScaleBar,

    remove: function() {
      mapWidget.unlisten(boundsListenerId);
      mapWidget.remove(mainPanel);
    }
  };
}

var dynamicMapSymbols = addDynamicMapSymbols(Map);












