import {
  Cartesian3,
  Math as CesiumMath,
  Viewer,
  ImageryLayer,
  IonImageryProvider,
  JulianDate,
  HeadingPitchRoll,
  Cartographic,
  ClockRange,
  Transforms,
  HeightReference,
  SampledPositionProperty,
  sampleTerrainMostDetailed,
  createWorldTerrainAsync,
  VelocityOrientationProperty,
  TimeIntervalCollection,
  TimeInterval,
  Color,
  LabelStyle,
  VerticalOrigin,
  IonResource,
  Cartesian2,
  createGooglePhotorealistic3DTileset,
  Ion,
  Matrix4,
  IonGeocodeProviderType,
  defined,
  HeadingPitchRange,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./style.css";

// Step 1.2: Add your Cesium ion access token
// See: https://cesium.com/learn/ion/cesium-ion-access-tokens/
// See: https://cesium.com/platform/cesium-ion/pricing/#frequently-asked-questions
Ion.defaultAccessToken = "your token here";

// Step 1.4: Initialize the Cesium Viewer in the HTML element with the
// `cesiumContainer` ID and visualize terrain
const viewer = new Viewer("cesiumContainer", {
  infoBox: true,
  geocoder: IonGeocodeProviderType.GOOGLE,
});

// Step 1.5: Add Google Photorealistic 3D Tiles, a global photorealistic 3D tileset.
async function addGooglePhotorealistic3DTileset() {
  const tileset = await createGooglePhotorealistic3DTileset({
    // Only the Google Geocoder can be used with Google Photorealistic 3D Tiles.  Set the `geocode` property of the viewer constructor options to IonGeocodeProviderType.GOOGLE.
    onlyUsingWithGoogleGeocoder: true,
  });
  viewer.scene.primitives.add(tileset);
  return tileset;
}
const tileset = await addGooglePhotorealistic3DTileset();

// Step 1.6: Drape labels overlay imagery layer on top of the Google Photorealistic 3D Tiles tileset.
async function addLabelsOverlay(tileset) {
  const labelImageryLayer = await ImageryLayer.fromProviderAsync(
    IonImageryProvider.fromAssetId(3891170),
  );
  tileset.imageryLayers.add(labelImageryLayer);
}
await addLabelsOverlay(tileset);

// Step 1.7: Fly the camera to Las Vegas at the given longitude, latitude, and height
// and orient the camera at the given heading and pitch
function setCamera() {
  viewer.camera.lookAtTransform(Matrix4.IDENTITY);
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(
      -115.14948607912102,
      36.107104454390175,
      1172.6851371558546,
    ),
    orientation: {
      heading: CesiumMath.toRadians(298.8682973473617),
      pitch: CesiumMath.toRadians(-12.38970963885237),
      roll: CesiumMath.toRadians(359.99975446786647),
    },
    duration: 3,
  });
}
setCamera();

// Step 2.1: Add a 3D model to the scene
const position = Cartesian3.fromDegrees(-115.161202, 36.109904, 500);
const resource = await IonResource.fromAssetId(4852863);

function addModel() {
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
      uri: resource,
      minimumPixelSize: 64,
      maximumScale: 20000,
      heightReference: HeightReference.RELATIVE_TO_3D_TILE,
    },
  });
}
addModel();

// Step 2.2: Load GeoJSON of race course and add to scene as polyline entity
async function addRaceCoursePath() {
  // Load GeoJSON file
  const response = await fetch("./src/lasvegas-street-circuit.geojson");
  const geojson = await response.json();
  const feature = geojson.features[0];
  const geometry = feature.geometry;
  // Get coordinates array
  const coordinates = geometry.coordinates;

  viewer.entities.add({
    polyline: {
      positions: Cartesian3.fromDegreesArray(coordinates.flat()),
      width: 4,
      clampToGround: true,
      material: Color.CYAN,
    },
  });

  return coordinates;
}
const coordinates = await addRaceCoursePath();

// Step 3.1: Sample terrain heights along the race course to turn 2D coordinates into 3D positions that vehicles can follow
async function getTerrainSampledPositions(coordinates) {
  // Convert coordinates to cartographics
  const cartographics = coordinates.map((coord) =>
    Cartographic.fromDegrees(coord[0], coord[1]),
  );

  const terrainProvider = await createWorldTerrainAsync();

  // Sample terrain
  const sampled = await sampleTerrainMostDetailed(
    terrainProvider,
    cartographics,
  );
  return sampled;
}

// Step 3.2: Build sample position property, an array of position samples with timestamps, that a vehicle can follow
function buildSampledPositionProperty({
  sampled,
  followDelaySeconds,
  speedMetersPerSecond,
  start,
}) {
  const positionProperty = new SampledPositionProperty();
  let elapsedSeconds = 0;
  let previousPosition;

  sampled.forEach((p) => {
    const position = Cartesian3.fromRadians(p.longitude, p.latitude, p.height);

    // Distance-based timing
    if (previousPosition) {
      const distance = Cartesian3.distance(previousPosition, position);
      const segmentTime = distance / speedMetersPerSecond;
      elapsedSeconds += segmentTime;
    }

    // Add follow delay here
    const time = JulianDate.addSeconds(
      start,
      elapsedSeconds + followDelaySeconds,
      new JulianDate(),
    );

    positionProperty.addSample(time, position);

    previousPosition = position;
  });
  return {
    positionProperty,
    elapsedSeconds,
  };
}

// Step 3.3: Create a vehicle following the race course, with a configurable follow delay to simulate a race
async function createMovingVehicle({
  viewer,
  sampled,
  glbUri,
  labelText,
  followDelaySeconds = 0,
  speedMetersPerSecond = 80.0,
}) {
  // Shared simulation start time
  // Store globally on viewer so all vehicles
  // stay synchronized
  if (!viewer.__vehicleStartTime) {
    viewer.__vehicleStartTime = JulianDate.fromDate(
      new Date(Date.UTC(2026, 4, 26, 10, 0, 0)),
    );
  }
  const start = viewer.__vehicleStartTime.clone();

  const { positionProperty, elapsedSeconds } = buildSampledPositionProperty({
    sampled,
    followDelaySeconds,
    speedMetersPerSecond,
    start,
  });

  const stop = JulianDate.addSeconds(
    start,
    elapsedSeconds + followDelaySeconds,
    new JulianDate(),
  );

  // Configure clock once
  if (!viewer.__clockConfigured) {
    viewer.clock.startTime = start.clone();
    viewer.clock.stopTime = stop.clone();
    viewer.clock.currentTime = start.clone();
    viewer.clock.clockRange = ClockRange.LOOP_STOP;
    viewer.clock.shouldAnimate = true;
    viewer.timeline.zoomTo(viewer.clock.startTime, viewer.clock.stopTime);
    viewer.__clockConfigured = true;
  }

  // Create entity
  const vehicle = viewer.entities.add({
    availability: new TimeIntervalCollection([
      new TimeInterval({
        start,
        stop: JulianDate.addSeconds(stop, 60, new JulianDate()),
      }),
    ]),

    position: positionProperty,
    orientation: new VelocityOrientationProperty(positionProperty),

    model: {
      uri: glbUri,
      minimumPixelSize: 32,
      maximumScale: 10,
    },

    label: {
      text: labelText,
      font: "18px sans-serif",
      style: LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      verticalOrigin: VerticalOrigin.BOTTOM,
      pixelOffset: new Cartesian2(0, -50),
      showBackground: true,
      backgroundColor: Color.BLACK.withAlpha(0.7),
      fillColor: Color.WHITE,
    },

    description: `
        "McLaren MP4/5 || Formula 1" (https://skfb.ly/p8s7A) by dark_igorek is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).`,
  });

  return vehicle;
}

// Step 3.4 Add multiple vehicles with different follow delays to the scene
async function addMovingVehicles(coordinates) {
  const sampled = await getTerrainSampledPositions(coordinates);

  // Lead vehicle
  await createMovingVehicle({
    viewer,
    sampled,
    glbUri: "./src/mclaren_mp45__formula_1.glb",
    labelText: "Car 1",
    followDelaySeconds: 0,
  });

  // Second vehicle 3 seconds behind
  await createMovingVehicle({
    viewer,
    sampled,
    glbUri: "./src/mclaren_mp45__formula_1.glb",
    labelText: "Car 2",
    followDelaySeconds: 3,
  });

  // Third vehicle 6 seconds behind
  await createMovingVehicle({
    viewer,
    sampled,
    glbUri: "./src/mclaren_mp45__formula_1.glb",
    labelText: "Car 3",
    followDelaySeconds: 6,
  });
  return;
}
await addMovingVehicles(coordinates);

// Step 4.1 Orbit a point when user holds down the Q key
let orbitHandler;

function toggleOrbit(position) {
  if (!defined(orbitHandler)) {
    orbitHandler = function (scene, time) {
      const pitch = CesiumMath.toRadians(-15);
      const range = 1000.0; // Distance from the point
      const delta = JulianDate.secondsDifference(time, viewer.clock.startTime);
      const newHeading = CesiumMath.toRadians(delta * 5); // degrees/sec

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
