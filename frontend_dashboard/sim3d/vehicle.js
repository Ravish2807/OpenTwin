/**
 * OpenTwin: 3D Vehicle Simulation — Vehicle PBR Rig
 * Phase 1.3 — High-Fidelity Rigged Sports Car Mesh & Physical Materials
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

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
    this.wheelFL = new THREE.Group();
    this.wheelFR = new THREE.Group();
    this.wheelRL = new THREE.Group();
    this.wheelRR = new THREE.Group();

    // Wheel Meshes for spinning
    this.wheelFLSpin = new THREE.Group();
    this.wheelFRSpin = new THREE.Group();
    this.wheelRLSpin = new THREE.Group();
    this.wheelRRSpin = new THREE.Group();

    this.taillightMesh = null;
    this.headlightSpotL = null;
    this.headlightSpotR = null;

    this.wheelbaseHalf = this.wheelbase / 2; // 1.3m
    this.trackHalf = this.trackWidth / 2;     // 0.8m

    this.buildVehicle();
    this.scene.add(this.root);
  }

  buildVehicle() {
    this.root.add(this.chassisGroup);

    // 1. PBR Materials
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
    this.chassisGroup.add(tub);

    // Aerodynamic Hood slope (Front)
    const hoodGeo = new THREE.BoxGeometry(1.78, 0.22, 1.4);
    const hood = new THREE.Mesh(hoodGeo, bodyMat);
    hood.position.set(0, 0.58, 1.25);
    hood.rotation.x = 0.08;
    hood.castShadow = true;
    this.chassisGroup.add(hood);

    // Front Bumper / Nosecone
    const noseGeo = new THREE.BoxGeometry(1.8, 0.35, 0.6);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.set(0, 0.4, 2.15);
    nose.castShadow = true;
    this.chassisGroup.add(nose);

    // Front Air Splitter
    const splitterGeo = new THREE.BoxGeometry(1.86, 0.06, 0.8);
    const splitter = new THREE.Mesh(splitterGeo, carbonMat);
    splitter.position.set(0, 0.22, 2.18);
    splitter.castShadow = true;
    this.chassisGroup.add(splitter);

    // Side Skirts (Left & Right)
    const skirtL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 2.4), carbonMat);
    skirtL.position.set(-0.93, 0.24, 0);
    const skirtR = skirtL.clone();
    skirtR.position.x = 0.93;
    this.chassisGroup.add(skirtL);
    this.chassisGroup.add(skirtR);

    // Cabin Greenhouse & Canopy Glass
    const greenhouseGeo = new THREE.BoxGeometry(1.42, 0.54, 1.9);
    const greenhouse = new THREE.Mesh(greenhouseGeo, cabinGlassMat);
    greenhouse.position.set(0, 0.86, -0.15);
    greenhouse.castShadow = true;
    this.chassisGroup.add(greenhouse);

    // Cabin Roof Panel
    const roofGeo = new THREE.BoxGeometry(1.36, 0.05, 1.4);
    const roof = new THREE.Mesh(roofGeo, bodyMat);
    roof.position.set(0, 1.14, -0.22);
    roof.castShadow = true;
    this.chassisGroup.add(roof);

    // Rear Fastback Deck
    const rearDeckGeo = new THREE.BoxGeometry(1.78, 0.38, 1.2);
    const rearDeck = new THREE.Mesh(rearDeckGeo, bodyMat);
    rearDeck.position.set(0, 0.62, -1.55);
    rearDeck.castShadow = true;
    this.chassisGroup.add(rearDeck);

    // Rear Carbon Diffuser
    const diffuserGeo = new THREE.BoxGeometry(1.82, 0.22, 0.6);
    const diffuser = new THREE.Mesh(diffuserGeo, carbonMat);
    diffuser.position.set(0, 0.32, -2.15);
    diffuser.rotation.x = -0.12;
    diffuser.castShadow = true;
    this.chassisGroup.add(diffuser);

    // Rear GT Wing Spoiler
    const wingBladeGeo = new THREE.BoxGeometry(1.84, 0.04, 0.35);
    const wingBlade = new THREE.Mesh(wingBladeGeo, carbonMat);
    wingBlade.position.set(0, 1.05, -2.1);
    wingBlade.castShadow = true;

    const wingPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.12), carbonMat);
    wingPillarL.position.set(-0.55, 0.9, -2.05);
    const wingPillarR = wingPillarL.clone();
    wingPillarR.position.x = 0.55;

    this.chassisGroup.add(wingBlade);
    this.chassisGroup.add(wingPillarL);
    this.chassisGroup.add(wingPillarR);

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

    // Dynamic Headlight Spotlights pointing forward
    this.headlightSpotL = new THREE.SpotLight(0xc8eeff, 3.0, 45, Math.PI / 6, 0.35, 1.2);
    this.headlightSpotL.position.set(-0.68, 0.54, 2.45);
    this.headlightSpotL.target.position.set(-0.68, 0.1, 20);

    this.headlightSpotR = new THREE.SpotLight(0xc8eeff, 3.0, 45, Math.PI / 6, 0.35, 1.2);
    this.headlightSpotR.position.set(0.68, 0.54, 2.45);
    this.headlightSpotR.target.position.set(0.68, 0.1, 20);

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
  }

  setupWheels() {
    // Wheel Positions: Front-Left, Front-Right, Rear-Left, Rear-Right
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
      this.buildWheelGeometry(w.spin, w.isLeft);
    }
  }

  buildWheelGeometry(spinGroup, isLeft) {
    // Tire Rubber Material
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x171923,
      roughness: 0.88,
      metalness: 0.08
    });

    // Alloy Rim Material
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      metalness: 0.95,
      roughness: 0.12
    });

    // Caliper Material
    const caliperMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      metalness: 0.4,
      roughness: 0.25
    });

    // Brake Disc Material
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x9ca3af,
      metalness: 0.85,
      roughness: 0.3
    });

    // 1. Tire Cylinder (oriented along X axis)
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

    // 3. Wheel Spokes (5-spoke star geometry)
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
}
