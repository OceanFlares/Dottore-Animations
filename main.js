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

    let morphMeshes = [];

    let activeActions = [];
    let activeDuration = 0;

    let isPlaying = true;
    let isScrubbing = false;
    let currentSpeed = 1;

    const playPauseBtn = document.getElementById("playPause");


    const frameDisplay = document.getElementById("frameDisplay");
    const FPS = 60;
    const speedSlider = document.getElementById("speed");
    const speedNumber = document.getElementById("speedNumber");

    init();

    function init() {

      const container = document.getElementById('container');
      const timeline = document.getElementById("timeline");
      const speedControl = document.getElementById("speed");

      setSpeed(1);

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
      
      renderer.domElement.tabIndex = 0;
      renderer.domElement.style.outline = "none";
      renderer.domElement.focus();

      window.addEventListener("click", () => {
        renderer.domElement.focus();
      });

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

        model.traverse((obj) => {
          if (obj.isMesh) {
            obj.frustumCulled = false;
          }
        });

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

        model.traverse((obj) => {
          if (obj.isMesh && obj.morphTargetInfluences) {
            morphMeshes.push(obj);
            console.log(obj.name, obj.morphTargetDictionary);
          }
        });

        createPanel();

      }, undefined, function(error) {
        console.error(error);
      } );

      // camera
      camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 500);
      camera.updateProjectionMatrix();
      camera.position.set(-1, 2, 3);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.target.set(0, 1, 0);
      controls.update();

      //Timeline
      timeline.addEventListener("input", () => {
        if (!mixer || activeActions.length === 0) return;
        isScrubbing = true;

        const t = (timeline.value / 100) * activeDuration;
        
        activeActions.forEach(action => {
          action.time = t;
        });
      });

      timeline.addEventListener("change", () => {
        isScrubbing = false;
      });

      playPauseBtn.addEventListener("click", () => { togglePlayPause() });

      speedControl.addEventListener("input", () => {
        if (mixer) mixer.timeScale = parseFloat(speedControl.value);
      });

      window.addEventListener('resize', onWindowResize);

      speedSlider.addEventListener("input", () => {
        setSpeed(parseFloat(speedSlider.value));
      });

      speedNumber.addEventListener("input", () => {
          const v = parseFloat(speedNumber.value);
          if (Number.isFinite(v)) {
            setSpeed(v);
          }
      });

      speedNumber.addEventListener("blur", () => {
        if (speedNumber.value === "") {
          speedNumber.value = currentSpeed;
        }
      });

      window.addEventListener("keydown", onKeyDown);
    }

    function animate() {
      timer.update();
      controls.update();

      const delta = timer.getDelta();

      if (mixer) {
        mixer.update(delta);
      }
      
      updateTimelineAndFrame();
      renderer.render(scene, camera);
    }

    function createPanel() { 
      const panel = new GUI({width: 310});

      const stateFolder = panel.addFolder("States");
      const individualAnimations = panel.addFolder('Individual Animations');
      const morphFolder = panel.addFolder("Facial Expressions");

      //Individual Animations
      for (const [name, fn] of Object.entries(animations)) {
        individualAnimations.add({[name]: fn}, name);
      }

      //Facial Expressions
      const mesh = morphMeshes[0];
      const dict = mesh.morphTargetDictionary;

      Object.keys(dict).forEach((key) => {
        const index = dict[key];

        const control = { value: mesh.morphTargetInfluences[index] };

        morphFolder.add(control, "value", 0, 1, 0.01)
          .name(key)
          .onChange((v) => {
            morphMeshes.forEach(m => {
              m.morphTargetInfluences[index] = v;
            });
          });
      });

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
      if (!clipGroups[name]) return;

      activeActions.forEach(action => {
        action.enabled = false;
        action.stop();
      });

      activeActions = [];
      activeDuration = 0;

      clipGroups[name].forEach((clip) => {
        const action = mixer.clipAction(clip);

        action.reset();
        action.setLoop(THREE.LoopRepeat);
        action.clampWhenFinished = false;
        action.enabled = true;
        action.play();

        activeActions.push(action);
        activeDuration = Math.max(activeDuration, clip.duration);
      });
    }

    // function setMorph(name, value) {
    //   morphMeshes.forEach(mesh => {
    //     const dict = mesh.morphTargetDictionary;
    //     if (dict && dict[name] !== undefined) {
    //       mesh.morphTargetInfluences[dict[name]] = value;
    //     }
    //   });
    // }

    function togglePlayPause() {
      isPlaying = !isPlaying;
      
      mixer.timeScale = isPlaying ? currentSpeed : 0;

      playPauseBtn.textContent = isPlaying ? "Pause" : "Play";
    }

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function setSpeed(v) {
      if (!Number.isFinite(v)) return;
      currentSpeed = v;

      speedSlider.value = v;
      speedNumber.value = v;

      if (mixer && isPlaying) {
        mixer.timeScale = v;
      }
    }

    function stepFrame(direction) {
      const frameTime = 1 / FPS;

      activeActions.forEach(action => {
        let newTime = action.time + direction * frameTime;
        const duration = action.getClip().duration;

        action.time = (newTime % duration + duration) % duration;
      });

      updateTimelineAndFrame();
    }

    function updateTimelineAndFrame() {
      if (!activeActions.length) return;

      const t = activeActions[0].time;
      const currentFrame = Math.floor(t * FPS);

      frameDisplay.textContent = `Frame: ${currentFrame}`;
      timeline.value = (t / activeDuration) * 100;
    }

    function onKeyDown(e) {
      if (!mixer || activeActions.length === 0) return;

      switch (e.code) {

        case "Space":
          e.preventDefault();
          togglePlayPause();
          break;

        case "ArrowRight":
          e.preventDefault();
          stepFrame(1);
          break;

        case "ArrowLeft":
          e.preventDefault();
          stepFrame(-1);
          break;

        case "ArrowUp":
          e.preventDefault();
          setSpeed((currentSpeed * 10 + 1) / 10);
          break;

        case "ArrowDown":
          e.preventDefault();
          setSpeed((currentSpeed * 10 - 1) / 10);
          break;
      }
    }