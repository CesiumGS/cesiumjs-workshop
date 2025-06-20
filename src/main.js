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
  NearFarScalar,
  LabelStyle,
  Color,
  Ion,
  defined,
  ScreenSpaceEventType,
  ScreenSpaceEventHandler,
  Matrix4,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./style.css";

// Step 1.2: Add your Cesium ion access token
// See: https://cesium.com/learn/ion/cesium-ion-access-tokens/
// See: https://cesium.com/platform/cesium-ion/pricing/#frequently-asked-questions
Ion.defaultAccessToken = "your_ion_token_here";

// Step 1.3: Initialize the Cesium Viewer in the HTML element with the
// `cesiumContainer` ID and visualize terrain
const viewer = new Viewer("cesiumContainer", {
  terrain: Terrain.fromWorldTerrain(),
  infoBox: false,
});

// Step 1.4: Add aerial imagery later with labels
const mapLayer = ImageryLayer.fromWorldImagery({
  style: IonWorldImageryStyle.AERIAL_WITH_LABELS,
});
viewer.imageryLayers.add(mapLayer);

// Step 1.5: Add Cesium OSM Buildings, a global 3D buildings layer.
const buildingTileset = await createOsmBuildingsAsync();
viewer.scene.primitives.add(buildingTileset);

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
  viewer.camera.lookAtTransform(Matrix4.IDENTITY);
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(-122.4075, 37.655, 400),
    orientation: {
      heading: CesiumMath.toRadians(310.0),
      pitch: CesiumMath.toRadians(-10.0),
      range: 250.0,
    },
    duration: 0,
  });
}
setCamera();

// Step 2.1: Add a 3D model to the scene
const position = Cartesian3.fromDegrees(-122.4875, 37.705, 300);

function addModel(position) {
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

// Step 2.2 Stream GeoJSON from a feature service
async function addGeoJson() {
  // Geojson url for South San Francisco Parks in public data portal https://data-southcity.opendata.arcgis.com/datasets/5851bfc2d1d445e3ac032b0a5f615313_0/explore
  const geojsonUrl =
    "https://services5.arcgis.com/inY93B27l4TSbT7h/arcgis/rest/services/SSF_Parks/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson";

  const dataSource = await GeoJsonDataSource.load(geojsonUrl, {
    clampToGround: true,
  });

  viewer.dataSources.add(dataSource);
  return dataSource;
}

const geoJsonDataSourceReference = await addGeoJson();

// Step 3.1 Use a color palette
// See https://colorbrewer2.org/#type=qualitative&scheme=Accent&n=6
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

mapLayer.saturation = 2.0;
mapLayer.contrast = 0.7;

// Step 3.2 Style a polygon
const entities = geoJsonDataSourceReference.entities.values;
for (let i = 0; i < entities.length; i++) {
  const entity = entities[i];

  if (defined(entity.polygon)) {
    const category = entity.properties.Category.getValue(JulianDate.now());

    const color = Color.fromCssColorString(getCategoryColor(category));
    entity.polygon.material = color.withAlpha(0.8);
  }
}

// Step 3.3 Add label for a polygon
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

for (let i = 0; i < entities.length; i++) {
  const entity = entities[i];
  if (defined(entity.polygon)) {
    const center = getPolygonCenter(entity);
    const category = entity.properties.Category.getValue(JulianDate.now());
    const color = Color.fromCssColorString(getCategoryColor(category));
    viewer.entities.add({
      position: center,
      point: {
        color: color,
        pixelSize: 18,
        outlineColor: Color.fromCssColorString("#111723"),
        outlineWidth: 3,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: entity.properties.FACID,
        font: "14pt monospace",
        heightReference: HeightReference.CLAMP_TO_GROUND,
        horizontalOrigin: HorizontalOrigin.LEFT,
        verticalOrigin: VerticalOrigin.BASELINE,
        fillColor: Color.GHOSTWHITE,
        outlineColor: Color.fromCssColorString("#111723"),
        outlineWidth: 8,
        style: LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cartesian2(15, 6),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new NearFarScalar(2000, 1.0, 22000, 0.3),
        translucencyByDistance: new NearFarScalar(12000, 1.0, 20000, 0.0),
      },
    });
  }
}

// Step 3.5 Handle Custom Picking
function addCustomPicking() {
  const entity = viewer.entities.add({
    label: {
      show: false,
      showBackground: true,
      font: "14px monospace",
      backgroundColor: Color.fromCssColorString("#111723").withAlpha(0.8),
      backgroundPadding: new Cartesian2(16, 8),
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

// Step 4.1 Orbit a point when user holds down the Q key
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
