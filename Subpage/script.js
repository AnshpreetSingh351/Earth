// ── URL PARAM ────────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const locKey = params.get('location') || 'punjab';

// ── CONFIG ───────────────────────────────────────────────────
const LOCATION_CONFIGS = {

  punjab: {
    center: [78, 20],
    zoom: 4,
    modelCoords: [76.7106423, 30.5811009],
    modelUrl: 'punjab.glb',

    projects: [
      {
        name: "London Square",
        coords: [76.7106423, 30.5811009],
        modelUrl: "model.glb",

        transform: {
          position: [5, -15, -50],
          rotation: [Math.PI / 2, 0, 0],
          scale: [1, 1, 1]
        }
      },

      {
        name: "CM Infinia",
        coords: [75.745526, 30.9334374],
        modelUrl: "infinia.glb",

        transform: {
          position: [0, -10, -30],
          rotation: [Math.PI / 2, 0.2, 0],
          scale: [2, 2, 2]
        }
      }
    ]
  },

  canada: {
    center: [-122.4935, 52.9799],
    zoom: 4,
    modelCoords: [-122.4935506, 52.9799497],
    modelUrl: 'canada.glb',

    projects: [
      {
        name: "442 Kinchant St",
        coords: [-122.4935506, 52.9799497],
        modelUrl: "house.glb",

        zoom: 18,

        transform: {
          position: [3, -12, -40],
          rotation: [Math.PI / 2, 0, 0],
          scale: [2, 2, 2]
        }
      }
    ]
  }

};

// ── GLOBALS ──────────────────────────────────────────────────
const locConf = LOCATION_CONFIGS[locKey] || LOCATION_CONFIGS.punjab;
const projects = locConf.projects;

let map;
let scene, camera, renderer, model;

// ── INIT ─────────────────────────────────────────────────────
window.onload = () => {

  map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        satellite: {
          type: 'raster',
          tiles: [
            'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256
        }
      },
      layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }]
    },
    center: locConf.center,
    zoom: locConf.zoom,
    pitch: 0,
    bearing: 0
  });

  map.addControl(new maplibregl.NavigationControl());

  setupProjects();
  setupThreeLayer();
  buildPanel();
};

// ── PANEL ────────────────────────────────────────────────────
function buildPanel() {
  const container = document.getElementById('project-buttons');
  container.innerHTML = '';

  projects.forEach((project, i) => {
    const btn = document.createElement('button');
    btn.textContent = project.name;
    btn.onclick = () => focusProject(i);
    container.appendChild(btn);
  });
}

// ── MARKERS ──────────────────────────────────────────────────
function setupProjects() {
  projects.forEach((project, i) => {

    const el = document.createElement('div');
    el.className = 'marker';

    new maplibregl.Marker({ element: el })
      .setLngLat(project.coords)
      .addTo(map)
      .getElement()
      .addEventListener('click', () => focusProject(i));
  });
}

// ── CAMERA MOVE ──────────────────────────────────────────────
function focusProject(index) {

  const project = projects[index];

  map.flyTo({
  center: project.coords,
  zoom: project.zoom || 17,
  pitch: project.pitch || 70,
  bearing: project.bearing || -30
});

  // 🔥 Load project-specific model
  loadModel(project);
}

// ── THREE LAYER ──────────────────────────────────────────────
function setupThreeLayer() {

  map.on('load', () => {

    const mercator = maplibregl.MercatorCoordinate.fromLngLat(locConf.modelCoords, 50);
    const scale = mercator.meterInMercatorCoordinateUnits();

    const customLayer = {

      id: '3d-model',
      type: 'custom',
      renderingMode: '3d',

      onAdd(map, gl) {

        camera = new THREE.Camera();
        scene = new THREE.Scene();

        // lights
        scene.add(new THREE.AmbientLight(0xffffff, 1.5));

        const dir = new THREE.DirectionalLight(0xffffff, 1);
        dir.position.set(100, 200, 100);
        scene.add(dir);

        // renderer
        renderer = new THREE.WebGLRenderer({
          canvas: map.getCanvas(),
          context: gl,
          antialias: true
        });

        renderer.autoClear = false;

        // 🔥 load default location model

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
}

// ── MODEL LOADER (KEY PART 🔥) ───────────────────────────────
function loadModel(project) {

  const loader = new THREE.GLTFLoader();

  // remove old model
  if (model) {
    scene.remove(model);
  }

  loader.load(project.modelUrl, (gltf) => {

    model = gltf.scene;

    // safe default transform
    const t = project.transform || {};

    const pos = t.position || [0, 0, 0];
    const rot = t.rotation || [0, 0, 0];
    const scl = t.scale || [1, 1, 1];

    model.position.set(...pos);
    model.rotation.set(...rot);
    model.scale.set(...scl);

    model.traverse(child => {
      if (child.isMesh && child.material) {
        child.material.depthTest = true;
        child.material.depthWrite = true;
      }
    });

    scene.add(model);

    console.log("Loaded:", project.name);
  });
}