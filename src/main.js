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
  //HeadingPitchRange,
  VerticalOrigin,
  HorizontalOrigin,
  HeightReference,
  Color,
  defined,
  Ellipsoid,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./style.css";

// Step 3: Initialize the Cesium Viewer in the HTML element with the
// `cesiumContainer` ID and visualize terrain
const viewer = new Viewer("cesiumContainer", {
  terrain: Terrain.fromWorldTerrain(),
});

// Step 4: Add aerial imagery later with labels
viewer.imageryLayers.add(
  ImageryLayer.fromWorldImagery({
    style: IonWorldImageryStyle.AERIAL_WITH_LABELS,
  }),
);

// Step 5: Add Cesium OSM Buildings, a global 3D buildings layer.
createOsmBuildingsAsync().then((buildingTileset) => {
  viewer.scene.primitives.add(buildingTileset);
});

// Step 6: Enable lighting the globe, set time of day, and turn on animation sped up 60x
viewer.scene.globe.enableLighting = true;
const customTime = JulianDate.fromDate(
  new Date(Date.UTC(2025, 5, 10, 3, 0, 0)),
);
viewer.clock.currentTime = customTime;
viewer.clock.shouldAnimate = true;
viewer.clock.multiplier = 60;

// Step 7: Fly the camera to San Francisco at the given longitude, latitude, and height
// and orient the camera at the given heading and pitch
viewer.camera.flyTo({
  destination: Cartesian3.fromDegrees(-122.4075, 37.655, 400),
  orientation: {
    heading: CesiumMath.toRadians(310.0),
    pitch: CesiumMath.toRadians(-10.0),
  },
});

const position = Cartesian3.fromDegrees(-122.4875, 37.705, 300);

// add glTF model to the scene
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

function addGeoJson() {
  // Geojson url for South San Francisco Parks in public data portal https://data-southcity.opendata.arcgis.com/datasets/5851bfc2d1d445e3ac032b0a5f615313_0/explore
  const geojsonUrl =
    "https://services5.arcgis.com/inY93B27l4TSbT7h/arcgis/rest/services/SSF_Parks/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson";
  //const geojsonUrl = "./src/SSF_Parks.geojson"

  GeoJsonDataSource.load(geojsonUrl, {
    clampToGround: true,
  }).then((dataSource) => {
    console.log(dataSource);
    viewer.dataSources.add(dataSource);
    const entities = dataSource.entities.values;
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];

      if (defined(entity.polygon)) {
        // Style the polygon
        const color = Color.fromRandom({
          alpha: 1.0,
        });
        entity.polygon.material = color;

        // Display the label for each polygon
        const center = getPolygonCenter(entity);

        viewer.entities.add({
          position: center,
          point: {
            color: Color.CORNFLOWERBLUE,
            pixelSize: 18,
            outlineColor: Color.DARKSLATEGREY,
            outlineWidth: 3,
            heightReference: HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: entity.properties.FACID,
            font: "14pt sans-serif",
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

function getPolygonCenter(entity) {
  const hierarchy = entity.polygon.hierarchy.getValue(JulianDate.now());
  const positions = hierarchy.positions;

  if (!positions || positions.length === 0) {
    return null;
  }

  // Convert Cartesian3 to Cartographic (lon/lat)
  let lonSum = 0;
  let latSum = 0;

  const cartographicPoints = positions.map((p) =>
    Ellipsoid.WGS84.cartesianToCartographic(p),
  );

  cartographicPoints.forEach((point) => {
    lonSum += CesiumMath.toDegrees(point.longitude);
    latSum += CesiumMath.toDegrees(point.latitude);
  });

  const lon = lonSum / cartographicPoints.length;
  const lat = latSum / cartographicPoints.length;

  return Cartesian3.fromDegrees(lon, lat);
}

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

// function rotateCamera() {
//   viewer.clock.onTick.addEventListener(function (clock) {
//     viewer.scene.camera.rotateRight(0.0000001);
//     viewer.scene.camera.rotateDown(0.0000005);
//   });
// }

// function orbitPoint(position) {
//   const pitch = CesiumMath.toRadians(-15);
//   const range = 1000.0; // Distance from the point
//   viewer.scene.preRender.addEventListener(function(scene, time) {
//     const delta = JulianDate.secondsDifference(time, viewer.clock.startTime);
//     const newHeading = CesiumMath.toRadians(delta/5); // degrees/sec

//     viewer.camera.lookAt(position, new HeadingPitchRange(newHeading, pitch, range));
//   });
// }

addModel(position);
addGeoJson();
addEntity();
//rotateCamera()
//orbitPoint(position)
