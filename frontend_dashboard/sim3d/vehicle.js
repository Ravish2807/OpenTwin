/**
 * OpenTwin: 3D Vehicle Simulation — Vehicle PBR Rig
 * Phase 1.3 & Phase 6 — High-Fidelity Rigged Sports Car Mesh, Dynamic Lighting,
 * and Extensible Custom 3D Vehicle Model Loader (GLTF / GLB)
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class VehicleRig {
  constructor(scene) {
    this.scene = scene;

    // Vehicle dimensions & layout (Meters)
    this.wheelbase = 2.6;    // Distance between front & rear axles
    this.trackWidth = 1.6;   // Distance between left & right wheels
    this.wheelRadius = 0.34; // Outer tire radius
    this.wheelWidth = 0.24;  // Tire width

    // Root Group
    this.root = new THREE.Group();
    this.root.name = "VehicleRig";

    // Sub-components
    this.chassisGroup = new THREE.Group();
    this.chassisGroup.name = "ChassisGroup";

    // Stock procedural body vs custom imported model container
    this.stockBodyGroup = new THREE.Group();
    this.stockBodyGroup.name = "StockBodyGroup";
    this.chassisGroup.add(this.stockBodyGroup);

    this.customModelGroup = new THREE.Group();
    this.customModelGroup.name = "CustomModelGroup";
    this.chassisGroup.add(this.customModelGroup);

    // Wheel mounting groups (steer & suspension)
    this.wheelFL = new THREE.Group();
    this.wheelFR = new THREE.Group();
    this.wheelRL = new THREE.Group();
    this.wheelRR = new THREE.Group();

    // Wheel Meshes for spinning
    this.wheelFLSpin = new THREE.Group();
    this.wheelFRSpin = new THREE.Group();
    this.wheelRLSpin = new THREE.Group();
    this.wheelRRSpin = new THREE.Group();

    this.stockWheelMeshes = [];
    this.customWheelMeshes = [];

    this.taillightMesh = null;
    this.headlightSpotL = null;
    this.headlightSpotR = null;
    this.reverseLightMesh = null;
    this.headlightMat = null;
    this.headlightMode = 1;

    this.wheelbaseHalf = this.wheelbase / 2; // 1.3m
    this.trackHalf = this.trackWidth / 2;     // 0.8m

    this.isCustomModelLoaded = false;
    this.customModelMetadata = null;

    this.buildVehicle();
    this.scene.add(this.root);
  }

  buildVehicle() {
    this.root.add(this.chassisGroup);

    // 1. PBR Materials for Procedural Cyber GT
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x00f0ff,
      metalness: 0.85,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      reflectivity: 0.9
    });

    const cabinGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a101d,
      transmission: 0.82,
      opacity: 1.0,
      transparent: true,
      roughness: 0.1,
      ior: 1.52,
      metalness: 0.1
    });

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.7,
      roughness: 0.4
    });

    // 2. Chassis Main Body Panels
    // Lower main tub
    const tubGeo = new THREE.BoxGeometry(1.82, 0.48, 4.3);
    const tub = new THREE.Mesh(tubGeo, bodyMat);
    tub.position.y = 0.46;
    tub.castShadow = true;
    tub.receiveShadow = true;
    this.stockBodyGroup.add(tub);

    // Aerodynamic Hood slope (Front)
    const hoodGeo = new THREE.BoxGeometry(1.78, 0.22, 1.4);
    const hood = new THREE.Mesh(hoodGeo, bodyMat);
    hood.position.set(0, 0.58, 1.25);
    hood.rotation.x = 0.08;
    hood.castShadow = true;
    this.stockBodyGroup.add(hood);

    // Front Bumper / Nosecone
    const noseGeo = new THREE.BoxGeometry(1.8, 0.35, 0.6);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.set(0, 0.4, 2.15);
    nose.castShadow = true;
    this.stockBodyGroup.add(nose);

    // Front Air Splitter
    const splitterGeo = new THREE.BoxGeometry(1.86, 0.06, 0.8);
    const splitter = new THREE.Mesh(splitterGeo, carbonMat);
    splitter.position.set(0, 0.22, 2.18);
    splitter.castShadow = true;
    this.stockBodyGroup.add(splitter);

    // Side Skirts (Left & Right)
    const skirtL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 2.4), carbonMat);
    skirtL.position.set(-0.93, 0.24, 0);
    const skirtR = skirtL.clone();
    skirtR.position.x = 0.93;
    this.stockBodyGroup.add(skirtL);
    this.stockBodyGroup.add(skirtR);

    // Cabin Greenhouse & Canopy Glass
    const greenhouseGeo = new THREE.BoxGeometry(1.42, 0.54, 1.9);
    const greenhouse = new THREE.Mesh(greenhouseGeo, cabinGlassMat);
    greenhouse.position.set(0, 0.86, -0.15);
    greenhouse.castShadow = true;
    this.stockBodyGroup.add(greenhouse);

    // Cabin Roof Panel
    const roofGeo = new THREE.BoxGeometry(1.36, 0.05, 1.4);
    const roof = new THREE.Mesh(roofGeo, bodyMat);
    roof.position.set(0, 1.14, -0.22);
    roof.castShadow = true;
    this.stockBodyGroup.add(roof);

    // Rear Fastback Deck
    const rearDeckGeo = new THREE.BoxGeometry(1.78, 0.38, 1.2);
    const rearDeck = new THREE.Mesh(rearDeckGeo, bodyMat);
    rearDeck.position.set(0, 0.62, -1.55);
    rearDeck.castShadow = true;
    this.stockBodyGroup.add(rearDeck);

    // Rear Carbon Diffuser
    const diffuserGeo = new THREE.BoxGeometry(1.82, 0.22, 0.6);
    const diffuser = new THREE.Mesh(diffuserGeo, carbonMat);
    diffuser.position.set(0, 0.32, -2.15);
    diffuser.rotation.x = -0.12;
    diffuser.castShadow = true;
    this.stockBodyGroup.add(diffuser);

    // Rear GT Wing Spoiler
    const wingBladeGeo = new THREE.BoxGeometry(1.84, 0.04, 0.35);
    const wingBlade = new THREE.Mesh(wingBladeGeo, carbonMat);
    wingBlade.position.set(0, 1.05, -2.1);
    wingBlade.castShadow = true;

    const wingPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.12), carbonMat);
    wingPillarL.position.set(-0.55, 0.9, -2.05);
    const wingPillarR = wingPillarL.clone();
    wingPillarR.position.x = 0.55;

    this.stockBodyGroup.add(wingBlade);
    this.stockBodyGroup.add(wingPillarL);
    this.stockBodyGroup.add(wingPillarR);

    // 3. Headlights & Taillights
    this.setupLightingFixtures();

    // 4. Wheels Assemblies
    this.setupWheels();
  }

  setupLightingFixtures() {
    // Front Projector Headlight LEDs
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x38bdf8,
      emissiveIntensity: 3.5,
      roughness: 0.1
    });

    const headGeo = new THREE.BoxGeometry(0.35, 0.08, 0.05);
    const headL = new THREE.Mesh(headGeo, headMat);
    headL.position.set(-0.68, 0.54, 2.4);
    const headR = headL.clone();
    headR.position.x = 0.68;
    this.chassisGroup.add(headL);
    this.chassisGroup.add(headR);

    // Dynamic Headlight Spotlights with real-time shadow projection
    this.headlightSpotL = new THREE.SpotLight(0xdbeafe, 4.0, 50, Math.PI / 5.5, 0.35, 1.2);
    this.headlightSpotL.position.set(-0.68, 0.54, 2.45);
    this.headlightSpotL.target.position.set(-0.68, 0.1, 25);
    this.headlightSpotL.castShadow = true;
    this.headlightSpotL.shadow.mapSize.width = 1024;
    this.headlightSpotL.shadow.mapSize.height = 1024;
    this.headlightSpotL.shadow.bias = -0.0005;

    this.headlightSpotR = new THREE.SpotLight(0xdbeafe, 4.0, 50, Math.PI / 5.5, 0.35, 1.2);
    this.headlightSpotR.position.set(0.68, 0.54, 2.45);
    this.headlightSpotR.target.position.set(0.68, 0.1, 25);
    this.headlightSpotR.castShadow = true;
    this.headlightSpotR.shadow.mapSize.width = 1024;
    this.headlightSpotR.shadow.mapSize.height = 1024;
    this.headlightSpotR.shadow.bias = -0.0005;

    this.headlightMat = headMat;
    this.headlightMode = 1;

    this.chassisGroup.add(this.headlightSpotL);
    this.chassisGroup.add(this.headlightSpotL.target);
    this.chassisGroup.add(this.headlightSpotR);
    this.chassisGroup.add(this.headlightSpotR.target);

    // Rear Cyber Light Bar (Emissive Red)
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0x330000,
      emissive: 0xef4444,
      emissiveIntensity: 1.8,
      roughness: 0.2
    });
    this.taillightMesh = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.07, 0.04), tailMat);
    this.taillightMesh.position.set(0, 0.64, -2.16);
    this.chassisGroup.add(this.taillightMesh);

    // White Reverse Backup Lamps
    const revMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      emissive: 0xffffff,
      emissiveIntensity: 0.0,
      roughness: 0.2
    });
    this.reverseLightMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 0.04), revMat);
    this.reverseLightMesh.position.set(0, 0.42, -2.18);
    this.chassisGroup.add(this.reverseLightMesh);
  }

  setupWheels() {
    const positions = [
      { group: this.wheelFL, spin: this.wheelFLSpin, x: -this.trackHalf, y: this.wheelRadius, z: this.wheelbaseHalf, isLeft: true },
      { group: this.wheelFR, spin: this.wheelFRSpin, x: this.trackHalf, y: this.wheelRadius, z: this.wheelbaseHalf, isLeft: false },
      { group: this.wheelRL, spin: this.wheelRLSpin, x: -this.trackHalf, y: this.wheelRadius, z: -this.wheelbaseHalf, isLeft: true },
      { group: this.wheelRR, spin: this.wheelRRSpin, x: this.trackHalf, y: this.wheelRadius, z: -this.wheelbaseHalf, isLeft: false }
    ];

    for (const w of positions) {
      w.group.position.set(w.x, w.y, w.z);
      this.root.add(w.group);

      w.group.add(w.spin);
      const stockWheelContainer = new THREE.Group();
      this.buildWheelGeometry(stockWheelContainer, w.isLeft);
      w.spin.add(stockWheelContainer);
      this.stockWheelMeshes.push(stockWheelContainer);
    }
  }

  buildWheelGeometry(spinGroup, isLeft) {
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x171923,
      roughness: 0.88,
      metalness: 0.08
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      metalness: 0.95,
      roughness: 0.12
    });

    const caliperMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      metalness: 0.4,
      roughness: 0.25
    });

    const discMat = new THREE.MeshStandardMaterial({
      color: 0x9ca3af,
      metalness: 0.85,
      roughness: 0.3
    });

    // 1. Tire Cylinder
    const tireGeo = new THREE.CylinderGeometry(this.wheelRadius, this.wheelRadius, this.wheelWidth, 24);
    tireGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    spinGroup.add(tire);

    // 2. Alloy Rim Center
    const rimGeo = new THREE.CylinderGeometry(this.wheelRadius * 0.72, this.wheelRadius * 0.72, this.wheelWidth + 0.005, 20);
    rimGeo.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.castShadow = true;
    spinGroup.add(rim);

    // 3. Wheel Spokes
    for (let s = 0; s < 5; s++) {
      const angle = (s * Math.PI * 2) / 5;
      const spokeGeo = new THREE.BoxGeometry(0.03, this.wheelRadius * 0.65, 0.04);
      const spoke = new THREE.Mesh(spokeGeo, rimMat);
      spoke.position.x = isLeft ? -0.11 : 0.11;
      spoke.rotation.x = angle;
      spinGroup.add(spoke);
    }

    // 4. Brake Disc Rotor
    const discGeo = new THREE.CylinderGeometry(this.wheelRadius * 0.58, this.wheelRadius * 0.58, 0.03, 16);
    discGeo.rotateZ(Math.PI / 2);
    const disc = new THREE.Mesh(discGeo, discMat);
    spinGroup.add(disc);

    // 5. Red Caliper
    const caliperGeo = new THREE.BoxGeometry(0.06, 0.1, 0.14);
    const caliper = new THREE.Mesh(caliperGeo, caliperMat);
    caliper.position.set(isLeft ? -0.04 : 0.04, this.wheelRadius * 0.32, 0);
    spinGroup.add(caliper);
  }

  setStockWheelsVisible(visible) {
    for (const w of this.stockWheelMeshes) {
      w.visible = visible;
    }
  }

  clearCustomModel() {
    while (this.customModelGroup.children.length > 0) {
      const obj = this.customModelGroup.children[0];
      this.customModelGroup.remove(obj);
    }
    for (const w of this.customWheelMeshes) {
      if (w.parent) w.parent.remove(w);
    }
    this.customWheelMeshes = [];
    this.isCustomModelLoaded = false;
    this.customModelMetadata = null;
  }

  resetToStockModel() {
    this.clearCustomModel();
    this.stockBodyGroup.visible = true;
    this.setStockWheelsVisible(true);

    // Restore stock lights
    if (this.headlightSpotL) this.headlightSpotL.position.set(-0.68, 0.54, 2.45);
    if (this.headlightSpotR) this.headlightSpotR.position.set(0.68, 0.54, 2.45);
    if (this.taillightMesh) this.taillightMesh.position.set(0, 0.64, -2.16);
    if (this.reverseLightMesh) this.reverseLightMesh.position.set(0, 0.42, -2.18);

    console.log("[VehicleRig] Reset to default Procedural Cyber GT.");
  }

  /**
   * Load and dynamically rig any custom 3D vehicle model (.glb / .gltf)
   * @param {File|Blob|string|ArrayBuffer} source File object, Blob, ArrayBuffer, or URL string
   * @param {Function} onProgress Progress callback
   * @param {Function} onLoad Complete callback with loaded metadata
   * @param {Function} onError Error callback
   */
  loadCustomModel(source, onProgress, onLoad, onError) {
    const loader = new GLTFLoader();

    const handleLoadedGLTF = (gltf) => {
      try {
        console.log("[VehicleRig] Successfully parsed custom GLTF model:", gltf);
        this.clearCustomModel();

        const modelRoot = gltf.scene;

        // 1. Enable shadows on all child meshes
        let meshCount = 0;
        modelRoot.traverse((node) => {
          if (node.isMesh) {
            meshCount++;
            node.castShadow = true;
            node.receiveShadow = true;
            if (node.material) {
              node.material.depthWrite = true;
            }
          }
        });

        // 2. Calculate model bounding box for auto-scaling and centering
        const bbox = new THREE.Box3().setFromObject(modelRoot);
        const size = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());

        console.log(`[VehicleRig] Raw model dimensions: X=${size.x.toFixed(2)}m, Y=${size.y.toFixed(2)}m, Z=${size.z.toFixed(2)}m`);

        // Check orientation (if model is oriented along X instead of Z, rotate it)
        if (size.x > size.z * 1.35) {
          modelRoot.rotation.y = -Math.PI / 2;
          bbox.setFromObject(modelRoot);
          bbox.getSize(size);
          bbox.getCenter(center);
        }

        // Standard sports car length ~4.3 meters
        const targetLength = 4.3;
        const maxHoriz = Math.max(size.z, 0.01);
        const scaleFactor = targetLength / maxHoriz;
        modelRoot.scale.setScalar(scaleFactor);

        // Recompute bbox after scaling
        bbox.setFromObject(modelRoot);
        bbox.getSize(size);
        bbox.getCenter(center);

        // Center model so origin is aligned with chassis reference
        modelRoot.position.x = -center.x;
        modelRoot.position.z = -center.z;
        // Align ground clearance so bottom aligns with wheel contact
        modelRoot.position.y = -bbox.min.y + 0.12;

        // 3. Wheel detection in custom GLTF hierarchy
        const wheelRegexFL = /(wheel|tire|rim|tyre).*(fl|front.*l|left.*f)/i;
        const wheelRegexFR = /(wheel|tire|rim|tyre).*(fr|front.*r|right.*f)/i;
        const wheelRegexRL = /(wheel|tire|rim|tyre).*(rl|rear.*l|left.*r)/i;
        const wheelRegexRR = /(wheel|tire|rim|tyre).*(rr|rear.*r|right.*r)/i;

        const foundWheels = { fl: null, fr: null, rl: null, rr: null };

        modelRoot.traverse((node) => {
          if (!node.name) return;
          if (wheelRegexFL.test(node.name) && !foundWheels.fl) foundWheels.fl = node;
          else if (wheelRegexFR.test(node.name) && !foundWheels.fr) foundWheels.fr = node;
          else if (wheelRegexRL.test(node.name) && !foundWheels.rl) foundWheels.rl = node;
          else if (wheelRegexRR.test(node.name) && !foundWheels.rr) foundWheels.rr = node;
        });

        const hasCustomWheels = (foundWheels.fl && foundWheels.fr && foundWheels.rl && foundWheels.rr);

        if (hasCustomWheels) {
          console.log("[VehicleRig] Detected separated 4-wheel assemblies in custom model.");
          this.setStockWheelsVisible(false);

          const attachWheel = (wheelNode, spinGroup) => {
            const clone = wheelNode.clone();
            clone.position.set(0, 0, 0);
            spinGroup.add(clone);
            this.customWheelMeshes.push(clone);
            wheelNode.visible = false; // Hide from chassis body
          };

          attachWheel(foundWheels.fl, this.wheelFLSpin);
          attachWheel(foundWheels.fr, this.wheelFRSpin);
          attachWheel(foundWheels.rl, this.wheelRLSpin);
          attachWheel(foundWheels.rr, this.wheelRRSpin);
        } else {
          console.log("[VehicleRig] Custom model is a body shell. Retaining procedural sports wheels.");
          this.setStockWheelsVisible(true);
        }

        // 4. Mount custom model to chassis
        this.customModelGroup.add(modelRoot);
        this.stockBodyGroup.visible = false;
        this.isCustomModelLoaded = true;

        // 5. Adapt headlight and taillight positions to custom vehicle length
        const frontZ = (size.z / 2) + 0.1;
        const rearZ = -(size.z / 2) - 0.05;
        if (this.headlightSpotL) this.headlightSpotL.position.set(-0.65, 0.52, frontZ);
        if (this.headlightSpotR) this.headlightSpotR.position.set(0.65, 0.52, frontZ);
        if (this.taillightMesh) this.taillightMesh.position.set(0, 0.62, rearZ);
        if (this.reverseLightMesh) this.reverseLightMesh.position.set(0, 0.40, rearZ);

        this.customModelMetadata = {
          meshCount,
          lengthMeters: size.z.toFixed(2),
          widthMeters: size.x.toFixed(2),
          hasCustomWheels
        };

        if (onLoad) onLoad(this.customModelMetadata);
      } catch (err) {
        console.error("[VehicleRig] Error setting up custom model:", err);
        if (onError) onError(err);
      }
    };

    if (source instanceof File || source instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        loader.parse(e.target.result, '', handleLoadedGLTF, (err) => {
          if (onError) onError(err);
        });
      };
      reader.onerror = (e) => {
        if (onError) onError(e);
      };
      if (onProgress) {
        reader.onprogress = (e) => {
          if (e.lengthComputable) onProgress(e.loaded / e.total);
        };
      }
      reader.readAsArrayBuffer(source);
    } else if (source instanceof ArrayBuffer) {
      loader.parse(source, '', handleLoadedGLTF, onError);
    } else if (typeof source === 'string') {
      loader.load(source, handleLoadedGLTF, (xhr) => {
        if (xhr.lengthComputable && onProgress) onProgress(xhr.loaded / xhr.total);
      }, onError);
    } else {
      if (onError) onError(new Error("Unsupported source format for custom vehicle model."));
    }
  }

  setSteering(angleLeft, angleRight) {
    this.wheelFL.rotation.y = angleLeft;
    this.wheelFR.rotation.y = angleRight;
  }

  spinWheels(deltaAngle) {
    this.wheelFLSpin.rotation.x += deltaAngle;
    this.wheelFRSpin.rotation.x += deltaAngle;
    this.wheelRLSpin.rotation.x += deltaAngle;
    this.wheelRRSpin.rotation.x += deltaAngle;
  }

  setBraking(isBraking) {
    if (this.taillightMesh && this.taillightMesh.material) {
      this.taillightMesh.material.emissiveIntensity = isBraking ? 5.0 : 1.8;
      this.taillightMesh.material.color.setHex(isBraking ? 0xff0000 : 0x330000);
    }
  }

  setSuspensionY(flY, frY, rlY, rrY) {
    this.wheelFL.position.y = flY;
    this.wheelFR.position.y = frY;
    this.wheelRL.position.y = rlY;
    this.wheelRR.position.y = rrY;
  }

  setBodyPitchRoll(pitch, roll) {
    this.chassisGroup.rotation.x = pitch;
    this.chassisGroup.rotation.z = roll;
  }

  setHeadlights(mode) {
    this.headlightMode = mode; // 0=Off, 1=Low, 2=High
    if (mode === 0) {
      this.headlightSpotL.intensity = 0.0;
      this.headlightSpotR.intensity = 0.0;
      if (this.headlightMat) this.headlightMat.emissiveIntensity = 0.2;
    } else if (mode === 1) {
      this.headlightSpotL.intensity = 4.0;
      this.headlightSpotR.intensity = 4.0;
      this.headlightSpotL.distance = 50.0;
      this.headlightSpotR.distance = 50.0;
      if (this.headlightMat) this.headlightMat.emissiveIntensity = 2.8;
    } else if (mode === 2) {
      this.headlightSpotL.intensity = 8.5;
      this.headlightSpotR.intensity = 8.5;
      this.headlightSpotL.distance = 95.0;
      this.headlightSpotR.distance = 95.0;
      if (this.headlightMat) this.headlightMat.emissiveIntensity = 5.0;
    }
  }

  setReverse(isReversing) {
    if (this.reverseLightMesh && this.reverseLightMesh.material) {
      this.reverseLightMesh.material.emissiveIntensity = isReversing ? 4.0 : 0.0;
      this.reverseLightMesh.material.color.setHex(isReversing ? 0xffffff : 0x222222);
    }
  }
}
