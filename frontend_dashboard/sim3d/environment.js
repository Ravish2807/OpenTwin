/**
 * OpenTwin: 3D Vehicle Simulation — Environment & Lighting
 * Phase 1.2 & Phase 5.1 — Photorealistic Lighting Rig, Shadow Maps,
 * Comprehensive Proving Ground, Runway Lanes, Slalom Cones & Perimeter Barriers
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class EnvironmentManager {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;

    this.sunLight = null;
    this.hemiLight = null;
    this.ambientLight = null;
    this.groundMesh = null;
    this.cones = [];
    this.barriers = [];

    this.setupLighting();
    this.setupProvingGround();
    this.setupRunwayLanes();
    this.setupSlalomCourse();
    this.setupSafetyBarriers();
  }

  setupLighting() {
    // 1. Hemisphere Light: Natural ambient sky bounce and dark asphalt bounce
    this.hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x090d16, 0.75);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // 2. Ambient Fill Light for deep cyber shadows
    this.ambientLight = new THREE.AmbientLight(0x1e293b, 0.4);
    this.scene.add(this.ambientLight);

    // 3. Primary Key Sun Light with High-Resolution Cascaded Soft Shadows
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.8);
    this.sunLight.position.set(35, 45, 30);
    this.sunLight.castShadow = true;

    // Shadow Map configuration
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 160;

    const d = 40;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 0.02;

    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  setupProvingGround() {
    // Generate high-resolution procedural asphalt texture via offscreen Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Base dark asphalt
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle asphalt grain noise
    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 14;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    // Grid lines (5m major grid, 1m subtle subdivisions)
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= 1024; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y <= 1024; y += 128) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Outer cyber track markings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 1016, 1016);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(100, 100);
    texture.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 16);

    // Proving Ground Plane: 1000m x 1000m
    const groundGeo = new THREE.PlaneGeometry(1000, 1000, 1, 1);
    const groundMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.85,
      metalness: 0.15,
      depthWrite: true
    });

    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = 0;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    // Cyber Proving Ground Center Marker Rings
    this.createCenterPad();
  }

  createCenterPad() {
    const padGroup = new THREE.Group();

    // Concentric radius rings for skid pad: 10m, 20m, 30m, 40m, 50m
    const radii = [10, 20, 30, 40, 50];
    for (const r of radii) {
      const ringGeo = new THREE.RingGeometry(r - 0.1, r + 0.1, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: r === 30 ? 0x00f0ff : 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: r === 30 ? 0.45 : 0.2
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      padGroup.add(ring);
    }

    // Starting grid launch stripes
    for (let i = -3; i <= 3; i++) {
      const stripeGeo = new THREE.PlaneGeometry(0.35, 3.2);
      const stripeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4
      });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(i * 1.5, 0.01, -6);
      padGroup.add(stripe);
    }

    this.scene.add(padGroup);
  }

  setupRunwayLanes() {
    const runwayGroup = new THREE.Group();

    // 200m Sprint Runway Lane Markings
    const laneWidth = 12.0;
    const runwayLength = 200.0;

    // Outer Boundary Lines (Solid White)
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    const borderLeft = new THREE.Mesh(new THREE.PlaneGeometry(0.25, runwayLength), lineMat);
    borderLeft.rotation.x = -Math.PI / 2;
    borderLeft.position.set(-laneWidth / 2, 0.015, runwayLength / 2);
    runwayGroup.add(borderLeft);

    const borderRight = new THREE.Mesh(new THREE.PlaneGeometry(0.25, runwayLength), lineMat);
    borderRight.rotation.x = -Math.PI / 2;
    borderRight.position.set(laneWidth / 2, 0.015, runwayLength / 2);
    runwayGroup.add(borderRight);

    // Center Dashed Dividing Line (Cyan Glow)
    const dashMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.6 });
    for (let z = 5; z < runwayLength; z += 10) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 5), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.015, z);
      runwayGroup.add(dash);
    }

    // Distance Milestone Markers on Track (50m, 100m, 150m, 200m)
    const milestones = [50, 100, 150, 200];
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.7 });
    for (const dist of milestones) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(laneWidth, 0.6), markerMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(0, 0.016, dist);
      runwayGroup.add(bar);
    }

    this.scene.add(runwayGroup);
  }

  setupSlalomCourse() {
    const coneGroup = new THREE.Group();

    const coneMat = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      roughness: 0.4,
      metalness: 0.1
    });
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.8
    });
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2
    });

    // Place 9 traffic cones along X = -35m from Z = -60m to Z = 100m (every 20m)
    for (let z = -60; z <= 100; z += 20) {
      const coneUnit = new THREE.Group();

      // Square base
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.55), baseMat);
      base.position.y = 0.025;
      base.castShadow = true;
      base.receiveShadow = true;
      coneUnit.add(base);

      // Orange cone
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.85, 16), coneMat);
      cone.position.y = 0.45;
      cone.castShadow = true;
      coneUnit.add(cone);

      // White reflective collar
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.2, 16), collarMat);
      collar.position.y = 0.48;
      coneUnit.add(collar);

      coneUnit.position.set(-35.0, 0, z);
      coneGroup.add(coneUnit);
      this.cones.push(coneUnit);
    }

    this.scene.add(coneGroup);
  }

  setupSafetyBarriers() {
    const barrierGroup = new THREE.Group();

    // Red-and-White FIA-style alternating curb barrier material
    const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.6 });

    const createSegmentedWall = (x, y, z, width, length, isHorizontal) => {
      const wallGroup = new THREE.Group();
      const segLen = 4.0;
      const totalLen = isHorizontal ? width : length;
      const count = Math.floor(totalLen / segLen);

      for (let i = 0; i < count; i++) {
        const mat = (i % 2 === 0) ? redMat : whiteMat;
        let mesh;
        if (isHorizontal) {
          mesh = new THREE.Mesh(new THREE.BoxGeometry(segLen, 1.2, 1.0), mat);
          mesh.position.set(-totalLen / 2 + i * segLen + segLen / 2, 0.6, 0);
        } else {
          mesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, segLen), mat);
          mesh.position.set(0, 0.6, -totalLen / 2 + i * segLen + segLen / 2);
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        wallGroup.add(mesh);
      }

      wallGroup.position.set(x, y, z);
      barrierGroup.add(wallGroup);
    };

    // North Barrier: Z = 220m
    createSegmentedWall(0, 0, 220, 280, 1, true);

    // South Barrier: Z = -140m
    createSegmentedWall(0, 0, -140, 280, 1, true);

    // East Barrier: X = 140m
    createSegmentedWall(140, 0, 40, 1, 360, false);

    // West Barrier: X = -140m
    createSegmentedWall(-140, 0, 40, 1, 360, false);

    this.scene.add(barrierGroup);
  }

  update(targetPos) {
    if (this.sunLight && targetPos) {
      // Follow vehicle with directional light to ensure crisp shadows everywhere
      this.sunLight.position.set(targetPos.x + 35, targetPos.y + 45, targetPos.z + 30);
      this.sunLight.target.position.copy(targetPos);
    }
  }
}
