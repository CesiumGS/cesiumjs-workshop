import {
  Cartesian3,
  Cartesian2,
  Math as CesiumMath,
  Terrain,
  Viewer,
  createOsmBuildingsAsync,
  ImageryLayer,
  IonWorldImageryStyle,
  JulianDate,
  HeadingPitchRoll,
  Transforms,
  GeoJsonDataSource,
  HeadingPitchRange,
  VerticalOrigin,
  HorizontalOrigin,
  HeightReference,
  Color,
  Ion,
  defined,
  ScreenSpaceEventType,
  ScreenSpaceEventHandler,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./style.css";

// Step 1.2: Add you default Cesium ion access token
Ion.defaultAccessToken = "your_ion_token_here";

// Step 1.3: Initialize the Cesium Viewer in the HTML element with the
// `cesiumContainer` ID and visualize terrain
const viewer = new Viewer("cesiumContainer", {
  terrain: Terrain.fromWorldTerrain(),
  infoBox: false,
});

// Step 1.4: Add aerial imagery later with labels
viewer.imageryLayers.add(
  ImageryLayer.fromWorldImagery({
    style: IonWorldImageryStyle.AERIAL_WITH_LABELS,
  }),
);

// Step 1.5: Add Cesium OSM Buildings, a global 3D buildings layer.
createOsmBuildingsAsync().then((buildingTileset) => {
  viewer.scene.primitives.add(buildingTileset);
});

// Step 1.6: Enable lighting the globe, set time of day, and turn on animation sped up 60x
viewer.scene.globe.enableLighting = true;
const customTime = JulianDate.fromDate(
  new Date(Date.UTC(2025, 5, 10, 3, 0, 0)),
);
viewer.clock.currentTime = customTime;
viewer.clock.shouldAnimate = true;
viewer.clock.multiplier = 60;

// Step 1.7: Fly the camera to San Francisco at the given longitude, latitude, and height
// and orient the camera at the given heading and pitch
function setCamera() {
  const position = Cartesian3.fromDegrees(-122.4075, 37.655, 400);
  const heading = CesiumMath.toRadians(310.0);
  const pitch = CesiumMath.toRadians(-10.0);
  const range = 250;
  const hpr = new HeadingPitchRange(heading, pitch, range);

  viewer.camera.lookAt(position, hpr);
}
setCamera();

// Step 2.1: Upload 3D model to the scene
const position = Cartesian3.fromDegrees(-122.4875, 37.705, 300);

function addModel(position) {
  viewer.entities.removeAll();

  const heading = CesiumMath.toRadians(135);
  const pitch = 0;
  const roll = 0;
  const hpr = new HeadingPitchRoll(heading, pitch, roll);
  const orientation = Transforms.headingPitchRollQuaternion(position, hpr);

  viewer.entities.add({
    name: "CesiumBalloon",
    position: position,
    orientation: orientation,
    model: {
      uri: "./src/CesiumBalloon.glb",
      minimumPixelSize: 64,
      maximumScale: 20000,
    },
  });
}
addModel(position);

// Step 2.2 Upload a GeoJSON to the scene
let geoJsonDataSourceReference;

function addGeoJson() {
  // Geojson url for South San Francisco Parks in public data portal https://data-southcity.opendata.arcgis.com/datasets/5851bfc2d1d445e3ac032b0a5f615313_0/explore
  const geojsonUrl =
    "https://services5.arcgis.com/inY93B27l4TSbT7h/arcgis/rest/services/SSF_Parks/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson";

  GeoJsonDataSource.load(geojsonUrl, {
    clampToGround: true,
  }).then((dataSource) => {
    geoJsonDataSourceReference = dataSource;

    viewer.dataSources.add(dataSource);
    const entities = dataSource.entities.values;
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];

      if (defined(entity.polygon)) {
        // Step 3.1 Style a polygon
        const category = entity.properties.Category.getValue(JulianDate.now());

        // Step 3.2 Use a color palette
        const color = Color.fromCssColorString(getCategoryColor(category));
        entity.polygon.material = color.withAlpha(0.6);
        const center = getPolygonCenter(entity);

        // Step 3.3 Add label for a polygon
        viewer.entities.add({
          position: center,
          point: {
            color: color,
            pixelSize: 18,
            outlineColor: Color.DARKSLATEGREY,
            outlineWidth: 3,
            heightReference: HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: entity.properties.FACID,
            font: "12pt monospace",
            heightReference: HeightReference.CLAMP_TO_GROUND,
            horizontalOrigin: HorizontalOrigin.LEFT,
            verticalOrigin: VerticalOrigin.BASELINE,
            fillColor: Color.GHOSTWHITE,
            showBackground: true,
            backgroundColor: Color.DARKSLATEGREY.withAlpha(0.8),
            backgroundPadding: new Cartesian2(8, 4),
            pixelOffset: new Cartesian2(15, 6),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
      }
    }
  });
}

function getCategoryColor(category) {
  const colorMap = {
    "Parks – City (developed)": "#a6cee3",
    "Parks – City (undeveloped/open space)": "#1f78b4",
    "Parks – City (trails)": "#b2df8a",
    "Parks (SSFUSD-owned sites)": "#33a02c",
    "Parks (other, privately owned)": "#fb9a99",
    default: "#CCCCCC",
  };

  return colorMap[category] || colorMap["default"];
}

function getPolygonCenter(entity) {
  const hierarchy = entity.polygon.hierarchy.getValue(JulianDate.now());
  const positions = hierarchy.positions;

  if (!positions || positions.length === 0) {
    return null;
  }

  const center = new Cartesian3(0, 0, 0);

  for (let i = 0; i < positions.length; i++) {
    Cartesian3.add(center, positions[i], center);
  }

  return Cartesian3.divideByScalar(center, positions.length, new Cartesian3());
}
addGeoJson();

function addEntity() {
  viewer.entities.add({
    polygon: {
      hierarchy: Cartesian3.fromDegreesArray([
        -122.424, 37.674, -122.424, 37.676, -122.421, 37.676, -122.421, 37.674,
      ]),
      material: "./src/Cesium_Logo_Color.jpg",
    },
  });
}
addEntity();

// Step 3.5 Handle Custom Picking

function addCustomPicking() {
  const entity = viewer.entities.add({
    label: {
      show: false,
      showBackground: true,
      font: "14px monospace",
      heightReference: HeightReference.CLAMP_TO_GROUND,
      pixelOffset: new Cartesian2(0, -50),
    },
  });

  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

  // If the mouse is over a geojson entity from the parks dataset, show a label
  handler.setInputAction(function (movement) {
    const pickedObject = viewer.scene.pick(movement.endPosition);

    if (defined(pickedObject) && defined(pickedObject.id)) {
      if (geoJsonDataSourceReference.entities.contains(pickedObject.id)) {
        const cartesian = getPolygonCenter(pickedObject.id);
        entity.position = cartesian;
        entity.label.show = true;

        const parkType = pickedObject.id.properties.Class.getValue(
          JulianDate.now(),
        );
        const acreage = pickedObject.id.properties.Acres.getValue(
          JulianDate.now(),
        );
        entity.label.text = `Park Type: ${parkType}` + `\nAcres: ${acreage}`;
        return;
      }
    }
    entity.label.show = false;
  }, ScreenSpaceEventType.MOUSE_MOVE);
}
addCustomPicking();

// Step 4.2 Orbit a point when user holds down the Q key
let orbitHandler;

function toggleOrbit(position) {
  if (!defined(orbitHandler)) {
    orbitHandler = function (scene, time) {
      const pitch = CesiumMath.toRadians(-15);
      const range = 1000.0; // Distance from the point
      const delta = JulianDate.secondsDifference(time, viewer.clock.startTime);
      const newHeading = CesiumMath.toRadians(delta / 5); // degrees/sec

      viewer.camera.lookAt(
        position,
        new HeadingPitchRange(newHeading, pitch, range),
      );
    };
    viewer.scene.preRender.addEventListener(orbitHandler);
  } else {
    viewer.scene.preRender.removeEventListener(orbitHandler);
    orbitHandler = undefined;
    setCamera();
  }
}

document.addEventListener(
  "keydown",
  function (e) {
    if (typeof e.code !== "undefined") {
      if (e.code === "KeyQ") {
        toggleOrbit(position);
      }
    }
  },
  false,
);
