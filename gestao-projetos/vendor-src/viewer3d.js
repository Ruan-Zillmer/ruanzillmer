// Visualizador 3D do sistema (three.js). Este arquivo é a FONTE; o que o navegador
// carrega é vendor/viewer3d.js (gerado com "npm run build" nesta pasta).
import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const MODEL_EXTS = ['step', 'stp', 'iges', 'igs', 'brep', 'stl', 'obj', 'ply', 'glb', 'gltf', '3mf'];
const CAD_EXTS = ['step', 'stp', 'iges', 'igs', 'brep'];
const DEFAULT_COLOR = 0x8097ad;
const EDGE_COLOR = 0x0d385b;
const MAX_TRIS_FOR_AUTO_EDGES = 400000;
const MAX_TRIS_FOR_CREASE = 600000;

// Eixos do CAD (Z para cima) -> eixos do three.js (Y para cima)
const AXIS_NORMAL = {
  x: new THREE.Vector3(-1, 0, 0),
  y: new THREE.Vector3(0, 0, -1),
  z: new THREE.Vector3(0, -1, 0),
};
const VIEW_DIRS = {
  iso: new THREE.Vector3(1, 0.8, 1),
  front: new THREE.Vector3(0, 0, 1),
  back: new THREE.Vector3(0, 0, -1),
  right: new THREE.Vector3(1, 0, 0),
  left: new THREE.Vector3(-1, 0, 0),
  top: new THREE.Vector3(0, 1, 0),
  bottom: new THREE.Vector3(0, -1, 0),
};

let occtPromise = null;
function loadOcct(basePath) {
  if (occtPromise) return occtPromise;
  occtPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = basePath + 'occt/occt-import-js.js';
    s.onload = () => {
      window.occtimportjs({ locateFile: (name) => basePath + 'occt/' + name }).then(resolve, reject);
    };
    s.onerror = () => { occtPromise = null; reject(new Error('Não foi possível carregar o leitor de STEP.')); };
    document.head.appendChild(s);
  });
  return occtPromise;
}

function create(container, options) {
  const basePath = (options && options.basePath) || '/vendor/';

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';

  const scene = new THREE.Scene();
  const perspective = new THREE.PerspectiveCamera(40, 1, 0.1, 1e6);
  const orthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, -1e6, 1e6);
  let camera = perspective;
  // Rotação livre em 360° (sem travar no topo/embaixo): esquerdo gira, direito move, roda aproxima.
  function makeControls(cam) {
    const c = new TrackballControls(cam, renderer.domElement);
    c.rotateSpeed = 2.0;
    c.zoomSpeed = 1.1;
    c.panSpeed = 0.9;
    c.dynamicDampingFactor = 0.14;
    c.handleResize();
    return c;
  }
  let controls = makeControls(camera);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x7d8a99, 1.25));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
  const fillLight = new THREE.DirectionalLight(0xdfe9f5, 0.6);
  scene.add(keyLight, fillLight, keyLight.target, fillLight.target);

  // scene -> orient (giro escolhido pelo usuário) -> modelRoot (Z-para-cima do CAD) -> modelo
  const orient = new THREE.Group();
  scene.add(orient);
  const modelRoot = new THREE.Group();
  orient.add(modelRoot);
  let orientSteps = [0, 0, 0];
  let grid = null;
  let edgeLines = [];
  let materials = [];
  let state = { wireframe: false, edges: true, grid: false, ortho: false, clipAxis: null, clipT: 1 };
  let bounds = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
  let rafId = 0;
  let disposed = false;
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e9);

  function resize() {
    const w = Math.max(container.clientWidth, 10);
    const h = Math.max(container.clientHeight, 10);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    perspective.aspect = w / h;
    perspective.updateProjectionMatrix();
    updateOrthoFrustum();
    if (controls && controls.handleResize) controls.handleResize();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  function updateOrthoFrustum() {
    const w = Math.max(container.clientWidth, 10);
    const h = Math.max(container.clientHeight, 10);
    const size = bounds.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y, size.z, 1e-6) * 0.75;
    const aspect = w / h;
    orthographic.left = -span * aspect;
    orthographic.right = span * aspect;
    orthographic.top = span;
    orthographic.bottom = -span;
    orthographic.updateProjectionMatrix();
  }

  function tick() {
    if (disposed) return;
    rafId = requestAnimationFrame(tick);
    controls.update();
    keyLight.position.copy(camera.position).add(new THREE.Vector3(0.5, 1, 0.3).multiplyScalar(bounds.getSize(new THREE.Vector3()).length()));
    keyLight.target.position.copy(controls.target);
    fillLight.position.copy(camera.position).add(new THREE.Vector3(-1, -0.4, 0.5).multiplyScalar(bounds.getSize(new THREE.Vector3()).length()));
    fillLight.target.position.copy(controls.target);
    renderer.render(scene, camera);
  }
  resize();
  tick();

  function clearModel() {
    edgeLines = [];
    materials = [];
    while (modelRoot.children.length) {
      const child = modelRoot.children.pop();
      child.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
    }
    if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); grid = null; }
    modelRoot.rotation.set(0, 0, 0);
    orient.rotation.set(0, 0, 0);
  }

  function makeMaterial(color, vertexColors) {
    const m = new THREE.MeshStandardMaterial({
      color: color == null ? DEFAULT_COLOR : color,
      metalness: 0.25,
      roughness: 0.55,
      side: THREE.DoubleSide,
      vertexColors: !!vertexColors,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    return m;
  }

  function countTriangles(root) {
    let n = 0;
    root.traverse((o) => {
      if (o.isMesh && o.geometry) {
        const g = o.geometry;
        n += (g.index ? g.index.count : g.attributes.position.count) / 3;
      }
    });
    return Math.round(n);
  }

  function finishModel(object, zUp, steps) {
    modelRoot.add(object);
    orient.rotation.set(0, 0, 0);
    orient.updateMatrixWorld(true);
    // medidas no sistema de coordenadas do arquivo (antes de girar)
    const rawBox = new THREE.Box3().setFromObject(modelRoot);
    const rawSize = rawBox.getSize(new THREE.Vector3());
    if (zUp) modelRoot.rotation.x = -Math.PI / 2;
    setOrientSteps(steps);
    modelRoot.updateMatrixWorld(true);

    const triangles = countTriangles(modelRoot);
    modelRoot.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      list.forEach((m) => { m.clippingPlanes = []; m.side = THREE.DoubleSide; materials.push(m); });
    });
    buildEdges(triangles);
    refreshBounds();
    setView('iso');
    return { triangles, size: { x: rawSize.x, y: rawSize.y, z: rawSize.z } };
  }

  function setOrientSteps(steps) {
    orientSteps = (steps && steps.length === 3 ? steps : [0, 0, 0]).map((n) => ((Number(n) || 0) % 4 + 4) % 4);
    orient.rotation.set(orientSteps[0] * Math.PI / 2, orientSteps[1] * Math.PI / 2, orientSteps[2] * Math.PI / 2, 'XYZ');
    orient.updateMatrixWorld(true);
  }

  // recalcula limites, grade e enquadramento depois de carregar ou girar o modelo
  function refreshBounds() {
    bounds = new THREE.Box3().setFromObject(modelRoot);
    const size = bounds.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
    if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); grid = null; }
    const gridSize = Math.pow(10, Math.ceil(Math.log10(maxDim * 2)));
    grid = new THREE.GridHelper(gridSize, 20, 0x9fb0c2, 0xd5dde6);
    grid.position.set((bounds.min.x + bounds.max.x) / 2, bounds.min.y, (bounds.min.z + bounds.max.z) / 2);
    grid.visible = state.grid;
    scene.add(grid);
    applyState();
    updateOrthoFrustum();
  }

  // gira o modelo em passos de 90° (axis: 'x' | 'y' | 'z', amount: passos). Devolve os passos atuais.
  function rotateModel(axis, amount) {
    const i = { x: 0, y: 1, z: 2 }[axis];
    const next = orientSteps.slice();
    next[i] += amount;
    setOrientSteps(next);
    refreshBounds();
    setView('iso');
    return orientSteps.slice();
  }

  function resetOrientation() {
    setOrientSteps([0, 0, 0]);
    refreshBounds();
    setView('iso');
    return orientSteps.slice();
  }

  function buildEdges(triangles) {
    edgeLines = [];
    const enabled = triangles <= MAX_TRIS_FOR_AUTO_EDGES;
    state.edges = enabled;
    if (!enabled) return;
    const meshes = [];
    modelRoot.traverse((o) => { if (o.isMesh) meshes.push(o); });
    meshes.forEach((mesh) => {
      const lines = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry, 28),
        new THREE.LineBasicMaterial({ color: EDGE_COLOR, transparent: true, opacity: 0.55 })
      );
      mesh.add(lines);
      edgeLines.push(lines);
    });
  }

  function applyState() {
    materials.forEach((m) => {
      m.wireframe = state.wireframe;
      if (state.clipAxis) {
        const normal = AXIS_NORMAL[state.clipAxis];
        const axisKey = state.clipAxis === 'x' ? 'x' : state.clipAxis === 'y' ? 'z' : 'y';
        const lo = bounds.min[axisKey];
        const hi = bounds.max[axisKey];
        const pos = lo + (hi - lo) * state.clipT;
        // mantém o lado onde normal·p + constante >= 0
        const sign = normal[axisKey] < 0 ? -1 : 1;
        clipPlane.normal.copy(normal);
        clipPlane.constant = -sign * pos;
        m.clippingPlanes = [clipPlane];
      } else {
        m.clippingPlanes = [];
      }
      m.needsUpdate = true;
    });
    edgeLines.forEach((l) => { l.visible = state.edges && !state.wireframe; l.material.clippingPlanes = state.clipAxis ? [clipPlane] : []; });
    if (grid) grid.visible = state.grid;
  }

  function setView(name) {
    const dir = (VIEW_DIRS[name] || VIEW_DIRS.iso).clone().normalize();
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
    const dist = (maxDim / (2 * Math.tan((perspective.fov * Math.PI) / 360))) * 1.7;
    const up = (name === 'top' || name === 'bottom') ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    [perspective, orthographic].forEach((c) => {
      c.up.copy(up);
      c.position.copy(center).addScaledVector(dir, dist);
      c.near = Math.max(dist / 1000, 1e-4);
      c.far = dist * 1000;
      c.zoom = 1;
      c.updateProjectionMatrix();
    });
    orthographic.near = -dist * 100;
    orthographic.far = dist * 100;
    orthographic.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
  }

  function setOrtho(on) {
    state.ortho = on;
    const pos = camera.position.clone();
    const up = camera.up.clone();
    camera = on ? orthographic : perspective;
    camera.position.copy(pos);
    camera.up.copy(up);
    controls.dispose();
    controls = makeControls(camera);
    controls.target.copy(bounds.getCenter(new THREE.Vector3()));
    if (on) {
      const dist = pos.distanceTo(controls.target);
      const fovH = 2 * dist * Math.tan((perspective.fov * Math.PI) / 360);
      const size = bounds.getSize(new THREE.Vector3());
      const span = Math.max(size.x, size.y, size.z, 1e-6) * 0.75;
      orthographic.zoom = span * 2 / fovH;
      orthographic.updateProjectionMatrix();
    }
    controls.update();
  }

  function applyCreased(geometry) {
    const tris = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
    if (tris > MAX_TRIS_FOR_CREASE) {
      if (!geometry.attributes.normal) geometry.computeVertexNormals();
      return geometry;
    }
    geometry.deleteAttribute('normal');
    return toCreasedNormals(geometry, (35 * Math.PI) / 180);
  }

  async function loadFromBuffer(ext, buffer, steps) {
    ext = String(ext || '').toLowerCase();
    clearModel();
    let object;
    let zUp = true;
    const root = new THREE.Group();

    if (ext === 'stl') {
      const geo = applyCreased(new STLLoader().parse(buffer));
      root.add(new THREE.Mesh(geo, makeMaterial()));
      object = root;
    } else if (ext === 'ply') {
      let geo = new PLYLoader().parse(buffer);
      const hasColor = !!geo.attributes.color;
      if (geo.index || geo.attributes.position.count > 0) {
        const hasFaces = !!geo.index;
        if (!hasFaces) {
          root.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 1, vertexColors: hasColor, color: DEFAULT_COLOR, sizeAttenuation: false })));
          object = root;
        } else {
          if (!geo.attributes.normal) geo.computeVertexNormals();
          root.add(new THREE.Mesh(geo, makeMaterial(null, hasColor)));
          object = root;
        }
      }
    } else if (ext === 'obj') {
      const text = new TextDecoder().decode(buffer);
      object = new OBJLoader().parse(text);
      object.traverse((o) => {
        if (o.isMesh) {
          if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
          o.material = makeMaterial();
        }
      });
    } else if (ext === 'glb' || ext === 'gltf') {
      zUp = false;
      const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(buffer, '', resolve, reject));
      object = gltf.scene;
    } else if (ext === '3mf') {
      object = new ThreeMFLoader().parse(buffer);
    } else if (CAD_EXTS.indexOf(ext) >= 0) {
      const occt = await loadOcct(basePath);
      const bytes = new Uint8Array(buffer);
      const params = { linearUnit: 'millimeter', linearDeflectionType: 'bounding_box_ratio', linearDeflection: 0.0015, angularDeflection: 0.4 };
      const fn = (ext === 'iges' || ext === 'igs') ? occt.ReadIgesFile : ext === 'brep' ? occt.ReadBrepFile : occt.ReadStepFile;
      const result = fn.call(occt, bytes, params);
      if (!result || !result.success || !result.meshes.length) {
        throw new Error('Não consegui interpretar este arquivo CAD (ele pode estar vazio ou corrompido).');
      }
      result.meshes.forEach((m) => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(m.attributes.position.array, 3));
        if (m.attributes.normal) geo.setAttribute('normal', new THREE.Float32BufferAttribute(m.attributes.normal.array, 3));
        else geo.computeVertexNormals();
        geo.setIndex(new THREE.Uint32BufferAttribute(m.index.array, 1));
        const color = m.color ? new THREE.Color(m.color[0], m.color[1], m.color[2]) : null;
        const mesh = new THREE.Mesh(geo, makeMaterial(color ? color.getHex() : null));
        mesh.name = m.name || '';
        root.add(mesh);
      });
      object = root;
    } else {
      throw new Error('Formato ".' + ext + '" não tem visualização 3D.');
    }

    if (!object) throw new Error('O arquivo não contém geometria que possa ser exibida.');
    return finishModel(object, zUp, steps);
  }

  const api = {
    loadFromBuffer,
    setView,
    fit() { setView('iso'); },
    setWireframe(v) { state.wireframe = !!v; applyState(); },
    setEdges(v) { state.edges = !!v; applyState(); },
    setGrid(v) { state.grid = !!v; applyState(); },
    setOrtho,
    rotateModel,
    resetOrientation,
    getOrientation() { return orientSteps.slice(); },
    getCameraUp() { return camera.up.clone().applyQuaternion(camera.quaternion.clone().identity()).toArray(); },
    getCameraMatrixUp() { return new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).toArray(); },
    setClip(axis, t) { state.clipAxis = axis || null; state.clipT = t == null ? 1 : t; applyState(); },
    getState() { return Object.assign({}, state); },
    snapshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.dispose();
      clearModel();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    },
  };
  return api;
}

window.Viewer3D = {
  create,
  MODEL_EXTS,
  CAD_EXTS,
  canView(ext) { return MODEL_EXTS.indexOf(String(ext || '').toLowerCase()) >= 0; },
};
