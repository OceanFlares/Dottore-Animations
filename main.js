import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Timer } from './utils/Timer.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let scene, renderer, camera, controls;
let model, skeleton, mixer, timer;

let clipGroups = {};
let currentAnimation = 'Standby';
const animations = {
  Alert: () => playGroup("Alert"),
  Standby: () => playGroup("Standby"),
  Break: () => playGroup("Break")
};

init();

function init() {

  const container = document.getElementById('container');
  timer = new Timer();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3D3D3D);
  scene.fog = new THREE.Fog(0x333333, 10, 50);

  const light = new THREE.AmbientLight( 0xffffff, 1 );
  scene.add( light );

  //Renderer
  renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);
  renderer.setAnimationLoop(animate);

  //Ground
  const ground = new THREE.Mesh( new THREE.PlaneGeometry( 100, 100 ), new THREE.MeshPhongMaterial( { color: 0xcbcbcb, depthWrite: false } ) );
  ground.rotation.x = - Math.PI / 2;
  ground.receiveShadow = true;
  scene.add( ground );

  //Model
  const loader = new GLTFLoader();
  loader.load('/Dottore-Animations/Monster_Dotorre.glb', function (gltf) {

    model = gltf.scene;
    scene.add(model);

    //Shadows
    model.traverse(function(object) {
      if (object.isMesh) object.castShadow = true;
    } );

    //Skeleton
    skeleton = new THREE.SkeletonHelper(model);
    skeleton.visible = false;
    scene.add(skeleton);


    mixer = new THREE.AnimationMixer(model);
    clipGroups = groupClips(gltf.animations);
    playGroup(currentAnimation);

    console.log(clipGroups); //debug

    createPanel();

  }, undefined, function(error) {
    console.error(error);
  } );

  // camera
  camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.01, 100);
  camera.position.set(-1, 2, 3);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 1, 0);
  controls.update();

  window.addEventListener('resize', onWindowResize);

}

function animate() {
  timer.update();
  controls.update();

  const delta = timer.getDelta();

  if (mixer) mixer.update(delta);

  renderer.render(scene, camera);
}

function createPanel() { 
  const panel = new GUI({width: 310});

  const timerFolder = panel.addFolder('Timer');
  const controlsFolder = panel.addFolder('Playback');
  const advancedFolder = panel.addFolder('Advanced');

  timerFolder.add({ Pause: () => timer.pause() }, 'Pause');
  timerFolder.add({ Resume: () => timer.resume() }, 'Resume');

  const playback = { speed: 1 };
  controlsFolder.add(playback, 'speed', 0, 2, 0.01).name('Speed').onChange((v) => {
    if (mixer) mixer.timeScale = v;
  });

  for (const [name, fn] of Object.entries(animations)) {
    advancedFolder.add({[name]: fn}, name);
  }

  timerFolder.open();
  controlsFolder.open();
  advancedFolder.open();
}

function groupClips (clips) {
  const groups = {};

  clips.forEach((clip) => {
    const baseName = clip.name.split('_')[0];

    if (!groups[baseName]) {
      groups[baseName] = [];
    }

    groups[baseName].push(clip);
  });

  return groups;
}

// function playGroup(name) {
//   if(name == 'Standby Free') {

//   }
// }

// function playGroupComponent(name) {
function playGroup(name) {
  if (!clipGroups[name]) {
    console.warn(`No animation group: ${name}`);
    return;
  }

  mixer.stopAllAction();

  clipGroups[name].forEach((clip) => {
    const action = mixer.clipAction(clip);
    action.reset().play();
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}