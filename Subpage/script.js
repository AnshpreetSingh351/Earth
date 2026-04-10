let map;

// ===============================
// INIT AFTER FULL LOAD
// ===============================

window.onload = () => {

  map = new maplibregl.Map({
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
  map.addControl(new maplibregl.NavigationControl({
    visualizePitch: true,
    showZoom: true,
    showCompass: true
  }));

  // Interactions
  map.dragPan.enable();
  map.scrollZoom.enable();
  map.dragRotate.enable();
  map.touchZoomRotate.enable();

  // Allow right-click rotate
  map.getCanvas().addEventListener('contextmenu', (e) => e.preventDefault());

  // Resize fix
  setTimeout(() => map.resize(), 100);
  setTimeout(() => map.resize(), 500);

  setupProjects();
  setupThreeLayer();
};


// ===============================
// DATA
// ===============================

const projects = [
  { name: "London Square", coords: [76.7106423, 30.5811009] },
  { name: "CM Infinia", coords: [75.745526, 30.9334374] }
];


// ===============================
// MARKERS
// ===============================

function setupProjects() {

  projects.forEach((project, index) => {

    const el = document.createElement('div');
    el.className = 'marker';

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(project.coords)
      .addTo(map);

    marker.getElement().addEventListener('mousedown', (e) => e.stopPropagation());

    marker.getElement().addEventListener('click', (e) => {
      e.stopPropagation();
      focusProject(index);
    });

  });
}


// ===============================
// CAMERA
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
// THREE + MODEL
// ===============================

let scene, camera, renderer, model;
let mercator, scale;

function setupThreeLayer() {

  map.on('load', () => {

    const modelCoords = projects[0].coords;

    mercator = maplibregl.MercatorCoordinate.fromLngLat(modelCoords, 0);
    scale = mercator.meterInMercatorCoordinateUnits();

    const customLayer = {
      id: '3d-model',
      type: 'custom',
      renderingMode: '3d',

      onAdd: function (map, gl) {

        camera = new THREE.Camera();
        scene = new THREE.Scene();

        // Lighting
        scene.add(new THREE.AmbientLight(0xffffff, 1.2));
        scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));

        const dir = new THREE.DirectionalLight(0xffffff, 1);
        dir.position.set(100, 200, 100);
        scene.add(dir);

        // Load model
        const loader = new THREE.GLTFLoader();

        loader.load('model.glb', (gltf) => {

          model = gltf.scene;

          model.traverse((child) => {
            if (child.isMesh && child.material) {
              child.material.transparent = false;
              child.material.depthWrite = true;
              child.material.depthTest = true;
              child.material.side = THREE.FrontSide;
            }
          });

          model.rotation.set(Math.PI / 2, 0, 0);
          model.visible = false;

          scene.add(model);
        });

        renderer = new THREE.WebGLRenderer({
          canvas: map.getCanvas(),
          context: gl,
          antialias: true
        });

        renderer.autoClear = false;
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.physicallyCorrectLights = true;
      },

      render: function (gl, matrix) {

        if (!model) return;

        const m = new THREE.Matrix4().fromArray(matrix);

        const transform = new THREE.Matrix4()
          .makeTranslation(mercator.x, mercator.y, mercator.z)
          .scale(new THREE.Vector3(scale * 10, -scale * 10, scale * 10));

        camera.projectionMatrix = m.multiply(transform);

        renderer.resetState();
        renderer.render(scene, camera);

        map.triggerRepaint();
      }
    };

    // 🔥 IMPORTANT: Add BELOW base layer so markers stay visible
    map.addLayer(customLayer, 'satellite');
  });

  // Show / hide model
  map.on('move', () => {

    if (!model) return;

    const zoom = map.getZoom();
    const center = map.getCenter();
    const target = projects[0].coords;

    const distance = Math.sqrt(
      Math.pow(center.lng - target[0], 2) +
      Math.pow(center.lat - target[1], 2)
    );

    model.visible = (zoom > 16 && distance < 0.01);
  });
}