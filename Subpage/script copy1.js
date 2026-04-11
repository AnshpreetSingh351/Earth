// ── Read ?location= from URL ──────────────────────────────────
const params  = new URLSearchParams(window.location.search);
const locKey  = params.get('location') || 'punjab';

const LOCATION_CONFIGS = {

  punjab: {
    center: [78, 20],
    zoom: 4,
    modelCoords: [76.7106423, 30.5811009],
    modelFile: 'model.glb',    // ← add this
    projects: [
      { name: "London Square", coords: [76.7106423, 30.5811009] },
      { name: "CM Infinia",    coords: [75.745526,  30.9334374] }
    ]
  },

  canada: {
    center: [-122.4935, 52.9799],
    zoom: 15,
    modelCoords: [-122.4935506, 52.9799497],
    modelFile: 'house.glb',    // ← add this
    projects: [
      { name: "442 Kinchant St", coords: [-122.4935506, 52.9799497] }
    ]
  }

};



const locConf  = LOCATION_CONFIGS[locKey] || LOCATION_CONFIGS.punjab;
const projects = locConf.projects;

let map;
let scene, camera, renderer, model;

// ── Init ──────────────────────────────────────────────────────
window.onload = () => {

  map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        satellite: {
          type: 'raster',
          tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256
        }
      },
      layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }]
    },
    center:  locConf.center,
    zoom:    locConf.zoom,
    pitch: 0,
    bearing: 0,
    maxZoom: 18,
    minZoom: 3
  });

  map.addControl(new maplibregl.NavigationControl({
    visualizePitch: true,
    showZoom: true,
    showCompass: true
  }));

  map.dragPan.enable();
  map.scrollZoom.enable();
  map.dragRotate.enable();
  map.touchZoomRotate.enable();
  map.getCanvas().addEventListener('contextmenu', e => e.preventDefault());

  setTimeout(() => map.resize(), 100);
  setTimeout(() => map.resize(), 500);

  setupProjects();
  setupThreeLayer();
  buildPanel();
};

// ── Panel buttons ─────────────────────────────────────────────
function buildPanel() {
  const container = document.getElementById('project-buttons');
  container.innerHTML = '';
  projects.forEach((project, index) => {
    const btn = document.createElement('button');
    btn.textContent = project.name;
    btn.onclick = () => focusProject(index);
    container.appendChild(btn);
  });
}

// ── Markers ───────────────────────────────────────────────────
function setupProjects() {
  projects.forEach((project, index) => {
    const el = document.createElement('div');
    el.className = 'marker';

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(project.coords)
      .addTo(map);

    marker.getElement().addEventListener('mousedown', e => e.stopPropagation());
    marker.getElement().addEventListener('click', e => {
      e.stopPropagation();
      focusProject(index);
    });
  });
}

// ── Camera fly-to ─────────────────────────────────────────────
function focusProject(index) {
  map.flyTo({
    center: projects[index].coords,
    zoom: 17,
    pitch: 70,
    bearing: -30,
    speed: 1.2,
    curve: 1.5
  });
}

// ── Three.js layer ────────────────────────────────────────────
function setupThreeLayer() {

  map.on('load', () => {

    const modelCoords = locConf.modelCoords;
    const mercator = maplibregl.MercatorCoordinate.fromLngLat(modelCoords, 50);
    const scale    = mercator.meterInMercatorCoordinateUnits();

    const customLayer = {
      id: '3d-model',
      type: 'custom',
      renderingMode: '3d',

      onAdd(map, gl) {
        camera = new THREE.Camera();
        scene  = new THREE.Scene();

        scene.add(new THREE.AmbientLight(0xffffff, 1.5));

        const dir = new THREE.DirectionalLight(0xffffff, 1);
        dir.position.set(100, 200, 100);
        scene.add(dir);

        const loader = new THREE.GLTFLoader();
        loader.load('model.glb', gltf => {
          model = gltf.scene;

          model.traverse(child => {
            if (child.isMesh && child.material) {
              child.material.transparent = false;
              child.material.depthWrite  = true;
              child.material.depthTest   = true;
              child.material.side        = THREE.FrontSide;
            }
          });

          model.rotation.set(Math.PI / 2, 0, 1);
          model.scale.set(0, 0, 0);
          model.position.set(0, -15, -50);
          model.visible = true;
          scene.add(model);

          console.log('Model loaded ✅');
        });

        renderer = new THREE.WebGLRenderer({
          canvas: map.getCanvas(),
          context: gl,
          antialias: true
        });
        renderer.autoClear           = false;
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputEncoding          = THREE.sRGBEncoding;
        renderer.physicallyCorrectLights = true;
      },

      render(gl, matrix) {
        if (!model) return;

        const m = new THREE.Matrix4().fromArray(matrix);

        const transform = new THREE.Matrix4()
          .makeTranslation(mercator.x, mercator.y, mercator.z)
          .scale(new THREE.Vector3(scale, -scale, scale));

        camera.projectionMatrix = m.multiply(transform);
        renderer.resetState();
        renderer.render(scene, camera);
        map.triggerRepaint();
      }
    };

    map.addLayer(customLayer);
  });

  // ── Show/hide model on zoom & proximity ───────────────────
  map.on('move', () => {
    if (!model) return;
    const zoom     = map.getZoom();
    const center   = map.getCenter();
    const distance = Math.sqrt(
      Math.pow(center.lng - locConf.modelCoords[0], 2) +
      Math.pow(center.lat - locConf.modelCoords[1], 2)
    );
    model.visible = (zoom > 15 && distance < 0.05);
  });
}