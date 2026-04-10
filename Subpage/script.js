// ===============================
// 1. MAP INIT
// ===============================

const map = new maplibregl.Map({
  container: 'map',

  style: {
    version: 8,
    sources: {
      satellite: {
        type: "raster",
        tiles: [
          "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        ],
        tileSize: 256
      }
    },
    layers: [
      { id: "satellite", type: "raster", source: "satellite" }
    ]
  },

  center: [78, 20],
  zoom: 4,
  pitch: 0,
  bearing: 0,

  maxZoom: 18,
  minZoom: 3
});

// Controls
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }));

// Enable full interaction
map.dragPan.enable();
map.scrollZoom.enable();
map.touchZoomRotate.enable();
map.dragRotate.enable();


// ===============================
// 2. DATA
// ===============================

const projects = [
  { name: "London Square", coords: [76.7106423, 30.5811009] },
  { name: "CM Infinia", coords: [75.745526, 30.9334374] }
];


// ===============================
// 3. MARKERS
// ===============================

projects.forEach((project, index) => {

  const el = document.createElement('div');
  el.className = 'marker';

  new maplibregl.Marker(el)
    .setLngLat(project.coords)
    .addTo(map);

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    focusProject(index);
  });

});


// ===============================
// 4. CAMERA
// ===============================

function focusProject(index) {

  const project = projects[index];

  map.flyTo({
    center: project.coords,
    zoom: 17,
    pitch: 75,
    bearing: -30,
    speed: 1.2,
    curve: 1.5
  });
}


// ===============================
// 5. THREE + MODEL
// ===============================

let scene, camera, renderer, model;

map.on('load', () => {

  const london = [76.7106423, 30.5811009];

  const mercator = maplibregl.MercatorCoordinate.fromLngLat(london, 0);
  const scale = mercator.meterInMercatorCoordinateUnits();

  const customLayer = {
    id: '3d-model',
    type: 'custom',
    renderingMode: '3d',

    onAdd: function (map, gl) {

      camera = new THREE.Camera();
      scene = new THREE.Scene();

      // ✅ LIGHTING (CORRECT)
      const ambient = new THREE.AmbientLight(0xffffff, 1.2);
      scene.add(ambient);

      const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
      scene.add(hemi);

      const dir = new THREE.DirectionalLight(0xffffff, 1);
      dir.position.set(100, 200, 100);
      scene.add(dir);

      const loader = new THREE.GLTFLoader();

      loader.load('model.glb', (gltf) => {

        model = gltf.scene;

        // ✅ FIX MATERIAL (NO SEE THROUGH)
        model.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.transparent = false;
            child.material.opacity = 1;
            child.material.depthWrite = true;
            child.material.depthTest = true;
            child.material.side = THREE.FrontSide;
            child.material.needsUpdate = true;
          }
        });

        // ✅ SCALE
        model.scale.set(scale * 10, scale * 10, scale * 10);

        // ✅ ROTATION
        model.rotation.x = Math.PI / 2;

        // ✅ POSITION
        model.position.set(
          mercator.x,
          mercator.y,
          mercator.z
        );

        model.visible = false;

        scene.add(model);
      });

      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true
      });

      renderer.autoClear = false;
      renderer.sortObjects = true;

      // ✅ allow clicking through
      renderer.domElement.style.pointerEvents = "none";

      // ✅ COLOR FIX
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.physicallyCorrectLights = true;
    },

    render: function (gl, matrix) {

      const m = new THREE.Matrix4().fromArray(matrix);
      camera.projectionMatrix = m;

      renderer.resetState();
      renderer.render(scene, camera);

      map.triggerRepaint();
    }
  };

  map.addLayer(customLayer);
});


// ===============================
// 6. SHOW / HIDE MODEL
// ===============================

map.on('move', () => {

  if (!model) return;

  const zoom = map.getZoom();
  const center = map.getCenter();

  const london = projects[0].coords;

  const distance = Math.sqrt(
    Math.pow(center.lng - london[0], 2) +
    Math.pow(center.lat - london[1], 2)
  );

  if (zoom > 16 && distance < 0.01) {
    model.visible = true;
  } else {
    model.visible = false;
  }

});


// ===============================
// 7. ROTATE WITH SHIFT SCROLL
// ===============================

map.on('wheel', (e) => {
  if (e.originalEvent.shiftKey) {
    map.setBearing(map.getBearing() + e.originalEvent.deltaY * 0.1);
  }
});s