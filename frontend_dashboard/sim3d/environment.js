/**
 * OpenTwin: 3D Vehicle Simulation — Environment & Lighting
 * Phase 1.2 — Photorealistic Lighting Rig, Shadow Maps, and Proving Ground
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class EnvironmentManager {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;

    this.sunLight = null;
    this.hemiLight = null;
    this.groundMesh = null;
    this.gridHelper = null;

    this.setupLighting();
    this.setupProvingGround();
  }

  setupLighting() {
    // 1. Hemisphere Light: Natural ambient sky bounce and dark asphalt bounce
    this.hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x090d16, 0.75);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // 2. Ambient Fill Light for deep cyber shadows
    const ambientLight = new THREE.AmbientLight(0x1e293b, 0.4);
    this.scene.add(ambientLight);

    // 3. Primary Key Sun Light with High-Resolution Cascaded Soft Shadows
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.8);
    this.sunLight.position.set(35, 45, 30);
    this.sunLight.castShadow = true;

    // Shadow Map configuration
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 160;

    const d = 35;
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

    // Central circular skid pad
    const ringGeo = new THREE.RingGeometry(18, 18.2, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    padGroup.add(ring);

    // Outer dynamic radius ring
    const outerRingGeo = new THREE.RingGeometry(38, 38.3, 64);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.01;
    padGroup.add(outerRing);

    // Starting grid launch stripes
    for (let i = -3; i <= 3; i++) {
      const stripeGeo = new THREE.PlaneGeometry(0.3, 3);
      const stripeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35
      });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(i * 1.5, 0.01, -6);
      padGroup.add(stripe);
    }

    this.scene.add(padGroup);
  }

  update(targetPos) {
    if (this.sunLight && targetPos) {
      // Follow vehicle with directional light to ensure crisp shadows everywhere
      this.sunLight.position.set(targetPos.x + 35, targetPos.y + 45, targetPos.z + 30);
      this.sunLight.target.position.copy(targetPos);
    }
  }
}
