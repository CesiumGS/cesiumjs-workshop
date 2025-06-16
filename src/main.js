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
  Cartographic,
  ScreenSpaceEventType,
  ScreenSpaceEventHandler,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./style.css";

// Step 3: Initialize the Cesium Viewer in the HTML element with the
// `cesiumContainer` ID and visualize terrain
const viewer = new Viewer("cesiumContainer", {
  terrain: Terrain.fromWorldTerrain(),
  infoBox: false,
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

  const center = new Cartesian3(0, 0, 0);

  for (let i = 0; i < positions.length; i++) {
    Cartesian3.add(center, positions[i], center);
  }

  return Cartesian3.divideByScalar(center, positions.length, new Cartesian3());
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

function addCustomPicking() {
  const entity = viewer.entities.add({
    label: {
      show: false,
      showBackground: true,
      font: "14px monospace",
      verticalOrigin: VerticalOrigin.BOTTOM,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  // Mouse over the globe to see the cartographic position
  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(function (movement) {
    const cartesian = viewer.scene.pickPosition(movement.endPosition);
    if (cartesian) {
      const cartographic = Cartographic.fromCartesian(cartesian);
      const longitudeString = CesiumMath.toDegrees(
        cartographic.longitude,
      ).toFixed(2);
      const latitudeString = CesiumMath.toDegrees(
        cartographic.latitude,
      ).toFixed(2);
      const heightString = cartographic.height.toFixed(2);

      entity.position = cartesian;
      entity.label.show = true;
      entity.label.text =
        `Lon: ${`   ${longitudeString}`.slice(-7)}\u00B0` +
        `\nLat: ${`   ${latitudeString}`.slice(-7)}\u00B0` +
        `\nAlt: ${`   ${heightString}`.slice(-7)}m`;
    } else {
      entity.label.show = false;
    }
  }, ScreenSpaceEventType.MOUSE_MOVE);

  // let lastSelectedEntity;
  // let lastEntityColor;

  // const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  // handler.setInputAction(function (movement) {
  //   const pickedObject = viewer.scene.pick(movement.position);
  //   console.log(pickedObject.id)
  //   if (defined(pickedObject)) {

  //     if (pickedObject.id.id !== lastSelectedEntity) {
  //       //lastSelectedEntity

  //     }

  //     pickedObject.id.polygon.material = Color.BLACK
  //   }

  //   entity.billboard.scale = 2.0;
  //   entity.billboard.color = Cesium.Color.YELLOW;
  // } else {
  //   entity.billboard.scale = 1.0;
  //   entity.billboard.color = Cesium.Color.WHITE;
  // }
  // }, ScreenSpaceEventType.LEFT_CLICK);
}

addModel(position);
addGeoJson();
addEntity();
//rotateCamera()
//orbitPoint(position)
addCustomPicking();
