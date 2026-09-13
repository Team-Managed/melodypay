import * as THREE from "three";

export interface ExplodedPart {
    name: string;
    group: THREE.Group;
    anchorPos: THREE.Vector3;
    explodedPos: THREE.Vector3;
    anchorRot: THREE.Euler;
    explodedRot: THREE.Euler;
    title: string;
    subtitle: string;
    description: string;
}

export interface Hardware3DAssembly {
    root: THREE.Group;
    parts: ExplodedPart[];
    updateOLEDTexture: (time: number) => void;
    updatePulseRings: (time: number) => void;
}

// Generate tie-point hole matrix texture for prototype breadboard
function createBreadboardTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Off-white base plastic
    ctx.fillStyle = "#ECE7DE";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Power rails: Top (+ red, - blue)
    ctx.fillStyle = "#EF4444";
    ctx.fillRect(40, 36, 944, 4);
    ctx.fillStyle = "#2563EB";
    ctx.fillRect(40, 72, 944, 4);

    // Power rails: Bottom (- blue, + red)
    ctx.fillStyle = "#2563EB";
    ctx.fillRect(40, 564, 944, 4);
    ctx.fillStyle = "#EF4444";
    ctx.fillRect(40, 600, 944, 4);

    // Rail +/- symbols
    ctx.font = "bold 20px monospace";
    ctx.fillStyle = "#EF4444";
    ctx.fillText("+", 18, 42);
    ctx.fillText("+", 18, 606);
    ctx.fillStyle = "#2563EB";
    ctx.fillText("-", 20, 78);
    ctx.fillText("-", 20, 570);

    // Center divider trench
    ctx.fillStyle = "#D6CFBE";
    ctx.fillRect(40, 312, 944, 16);

    // Tie-point pin holes (columns 1 to 60)
    const cols = 55;
    const startX = 50;
    const stepX = (canvas.width - 100) / cols;

    ctx.fillStyle = "#2A2A2E";

    // Upper power bus (2 rows)
    for (let c = 0; c < cols; c++) {
        const x = startX + c * stepX;
        ctx.fillRect(x - 2, 26, 5, 5);
        ctx.fillRect(x - 2, 82, 5, 5);
    }

    // Main upper terminal strips (rows A - E)
    for (let r = 0; r < 5; r++) {
        const y = 130 + r * 32;
        for (let c = 0; c < cols; c++) {
            const x = startX + c * stepX;
            ctx.fillRect(x - 2.5, y - 2.5, 6, 6);
        }
    }

    // Main lower terminal strips (rows F - J)
    for (let r = 0; r < 5; r++) {
        const y = 356 + r * 32;
        for (let c = 0; c < cols; c++) {
            const x = startX + c * stepX;
            ctx.fillRect(x - 2.5, y - 2.5, 6, 6);
        }
    }

    // Lower power bus (2 rows)
    for (let c = 0; c < cols; c++) {
        const x = startX + c * stepX;
        ctx.fillRect(x - 2, 554, 5, 5);
        ctx.fillRect(x - 2, 610, 5, 5);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}

// Generate real-time OLED display texture
function createOLEDTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
    canvas.width = 256;
    canvas.height = 128;
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}

export function buildHardware3DAssembly(): Hardware3DAssembly {
    const root = new THREE.Group();
    const parts: ExplodedPart[] = [];

    // Shared materials
    const goldPinMaterial = new THREE.MeshStandardMaterial({
        color: 0xE6B84A,
        metalness: 0.95,
        roughness: 0.2,
    });
    const pcbBlackMaterial = new THREE.MeshStandardMaterial({
        color: 0x121714,
        metalness: 0.2,
        roughness: 0.7,
    });

    // ==========================================
    // 1. PROTOTYPE BREADBOARD BASE
    // ==========================================
    const breadboardGroup = new THREE.Group();
    const bbTexture = createBreadboardTexture();
    const bbMaterial = new THREE.MeshStandardMaterial({
        map: bbTexture,
        roughness: 0.65,
        metalness: 0.05,
    });
    const bbSideMaterial = new THREE.MeshStandardMaterial({
        color: 0xE8E3D8,
        roughness: 0.6,
        metalness: 0.05,
    });

    const bbMaterials = [
        bbSideMaterial, // right
        bbSideMaterial, // left
        bbMaterial,     // top
        bbSideMaterial, // bottom
        bbSideMaterial, // front
        bbSideMaterial, // back
    ];
    const bbMesh = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.75, 7.8), bbMaterials);
    bbMesh.castShadow = true;
    bbMesh.receiveShadow = true;
    breadboardGroup.add(bbMesh);

    // Rubber feet at 4 corners
    const footGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 16);
    const footMat = new THREE.MeshStandardMaterial({ color: 0x1E1E24, roughness: 0.9 });
    [
        [-6.0, -3.4],
        [6.0, -3.4],
        [-6.0, 3.4],
        [6.0, 3.4],
    ].forEach(([fx, fz]) => {
        const foot = new THREE.Mesh(footGeo, footMat);
        foot.position.set(fx, -0.4, fz);
        breadboardGroup.add(foot);
    });

    breadboardGroup.position.set(0, 0, 0);
    root.add(breadboardGroup);

    parts.push({
        name: "breadboard",
        group: breadboardGroup,
        anchorPos: new THREE.Vector3(0, 0, 0),
        explodedPos: new THREE.Vector3(0, -3.6, 0),
        anchorRot: new THREE.Euler(0, 0, 0),
        explodedRot: new THREE.Euler(0.12, 0, 0),
        title: "Prototyping Bus Base",
        subtitle: "Solderless Acoustic Test Bench",
        description: "Zero-internet physical breadboard bus hosting the air-gapped cryptographic hardware wallet components."
    });

    // ==========================================
    // 2. ESP32-S3 MICROCONTROLLER MODULE
    // ==========================================
    const esp32Group = new THREE.Group();

    // Matte black PCB slab
    const espPCB = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.22, 2.6), pcbBlackMaterial);
    espPCB.castShadow = true;
    esp32Group.add(espPCB);

    // Metallic RF Shield Can (Brushed stainless steel look)
    const rfShieldGeo = new THREE.BoxGeometry(2.3, 0.28, 2.1);
    const rfShieldMat = new THREE.MeshStandardMaterial({
        color: 0xC8CBD0,
        metalness: 0.9,
        roughness: 0.22,
    });
    const rfShield = new THREE.Mesh(rfShieldGeo, rfShieldMat);
    rfShield.position.set(-0.6, 0.2, 0);
    rfShield.castShadow = true;
    esp32Group.add(rfShield);

    // Gold PCB antenna trace on right edge
    const antennaGeo = new THREE.BoxGeometry(0.9, 0.05, 2.2);
    const antennaMat = new THREE.MeshStandardMaterial({
        color: 0xD4AF37,
        metalness: 0.85,
        roughness: 0.35,
    });
    const antenna = new THREE.Mesh(antennaGeo, antennaMat);
    antenna.position.set(2.0, 0.12, 0);
    esp32Group.add(antenna);

    // Micro LEDs
    const ledMatRed = new THREE.MeshBasicMaterial({ color: 0xFF2244 });
    const ledMatCyan = new THREE.MeshBasicMaterial({ color: 0x00E5FF });
    const pwrLed = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.2), ledMatRed);
    pwrLed.position.set(-2.0, 0.14, -0.8);
    esp32Group.add(pwrLed);

    const statusLed = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.2), ledMatCyan);
    statusLed.position.set(-2.0, 0.14, 0.8);
    esp32Group.add(statusLed);

    // Dual rows of golden header pins extending into the breadboard
    const pinGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.55, 8);
    for (let p = 0; p < 15; p++) {
        const px = -2.2 + p * 0.31;
        // Top row
        const pinTop = new THREE.Mesh(pinGeo, goldPinMaterial);
        pinTop.position.set(px, -0.3, -1.15);
        esp32Group.add(pinTop);

        // Bottom row
        const pinBtm = new THREE.Mesh(pinGeo, goldPinMaterial);
        pinBtm.position.set(px, -0.3, 1.15);
        esp32Group.add(pinBtm);
    }

    esp32Group.position.set(0, 0.52, 0);
    root.add(esp32Group);

    parts.push({
        name: "esp32",
        group: esp32Group,
        anchorPos: new THREE.Vector3(0, 0.52, 0),
        explodedPos: new THREE.Vector3(0, 2.2, 0.4),
        anchorRot: new THREE.Euler(0, 0, 0),
        explodedRot: new THREE.Euler(-0.15, 0.2, 0),
        title: "ESP32-S3 Hardware Enclave",
        subtitle: "Zero-Internet Cryptographic Core",
        description: "Dual-core Xtensa LX7 SoC running isolated cryptographic signing logic. Never touches IP networks or exports private keys."
    });

    // ==========================================
    // 3. 0.96" OLED DISPLAY MODULE
    // ==========================================
    const oledGroup = new THREE.Group();
    const oledCanvas = document.createElement("canvas");
    const oledTexture = createOLEDTexture(oledCanvas);

    // OLED Blue breakout PCB
    const oledPcbMat = new THREE.MeshStandardMaterial({
        color: 0x1E3A8A,
        metalness: 0.3,
        roughness: 0.6,
    });
    const oledPCB = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.18, 2.7), oledPcbMat);
    oledPCB.castShadow = true;
    oledGroup.add(oledPCB);

    // Glass display frame
    const glassFrameMat = new THREE.MeshStandardMaterial({
        color: 0x0A0A0E,
        metalness: 0.8,
        roughness: 0.2,
    });
    const glassFrame = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 1.9), glassFrameMat);
    glassFrame.position.set(0, 0.12, 0.15);
    oledGroup.add(glassFrame);

    // Active OLED Screen Surface (Luminous Canvas)
    const oledScreenMat = new THREE.MeshBasicMaterial({
        map: oledTexture,
    });
    const oledScreen = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.6), oledScreenMat);
    oledScreen.rotation.x = -Math.PI / 2;
    oledScreen.position.set(0, 0.17, 0.15);
    oledGroup.add(oledScreen);

    // 4-pin header pins (GND, VCC, SCL, SDA)
    for (let p = 0; p < 4; p++) {
        const pin = new THREE.Mesh(pinGeo, goldPinMaterial);
        pin.position.set(-0.75 + p * 0.5, -0.3, -1.15);
        oledGroup.add(pin);
    }

    oledGroup.position.set(-3.8, 0.52, -1.2);
    root.add(oledGroup);

    parts.push({
        name: "oled",
        group: oledGroup,
        anchorPos: new THREE.Vector3(-3.8, 0.52, -1.2),
        explodedPos: new THREE.Vector3(-3.8, 3.2, -1.2),
        anchorRot: new THREE.Euler(0, 0, 0),
        explodedRot: new THREE.Euler(-0.25, 0.15, 0),
        title: "0.96\" I2C OLED Display",
        subtitle: "Clear-Signing Visual Verification",
        description: "High-contrast SSD1306 display showing live USDC amount, receiver subname, and acoustic frequency spectrum."
    });

    // ==========================================
    // 4. APPROVE (GREEN) & DECLINE (RED) BUTTONS
    // ==========================================
    const buttonBaseGeo = new THREE.BoxGeometry(1.1, 0.38, 1.1);
    const buttonBaseMat = new THREE.MeshStandardMaterial({
        color: 0x2A2A32,
        metalness: 0.7,
        roughness: 0.4,
    });
    const btnCapGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.32, 24);

    // Approve Button (Green)
    const approveGroup = new THREE.Group();
    const appBase = new THREE.Mesh(buttonBaseGeo, buttonBaseMat);
    approveGroup.add(appBase);

    const btnPinGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8);
    const btnPinMat = new THREE.MeshStandardMaterial({ color: 0xCBD5E1, metalness: 0.9, roughness: 0.2 });
    [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]].forEach(([px, pz]) => {
        const pin = new THREE.Mesh(btnPinGeo, btnPinMat);
        pin.position.set(px, -0.25, pz);
        approveGroup.add(pin);
    });

    const appCapMat = new THREE.MeshStandardMaterial({
        color: 0x10B981,
        emissive: 0x059669,
        emissiveIntensity: 0.45,
        roughness: 0.3,
    });
    const appCap = new THREE.Mesh(btnCapGeo, appCapMat);
    appCap.position.set(0, 0.28, 0);
    appCap.castShadow = true;
    approveGroup.add(appCap);

    approveGroup.position.set(4.0, 0.6, -1.4);
    root.add(approveGroup);

    parts.push({
        name: "approve_button",
        group: approveGroup,
        anchorPos: new THREE.Vector3(4.0, 0.6, -1.4),
        explodedPos: new THREE.Vector3(4.2, 2.6, -2.4),
        anchorRot: new THREE.Euler(0, 0, 0),
        explodedRot: new THREE.Euler(-0.2, -0.2, 0),
        title: "Tactile Approve Button",
        subtitle: "Physical Human Actuation",
        description: "Hardware micro-switch requiring conscious finger actuation before signing cryptographic payment authorization."
    });

    // Decline Button (Red)
    const declineGroup = new THREE.Group();
    const decBase = new THREE.Mesh(buttonBaseGeo, buttonBaseMat);
    declineGroup.add(decBase);

    [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]].forEach(([px, pz]) => {
        const pin = new THREE.Mesh(btnPinGeo, btnPinMat);
        pin.position.set(px, -0.25, pz);
        declineGroup.add(pin);
    });

    const decCapMat = new THREE.MeshStandardMaterial({
        color: 0xEF4444,
        emissive: 0xDC2626,
        emissiveIntensity: 0.45,
        roughness: 0.3,
    });
    const decCap = new THREE.Mesh(btnCapGeo, decCapMat);
    decCap.position.set(0, 0.28, 0);
    decCap.castShadow = true;
    declineGroup.add(decCap);

    declineGroup.position.set(4.0, 0.6, 1.4);
    root.add(declineGroup);

    parts.push({
        name: "decline_button",
        group: declineGroup,
        anchorPos: new THREE.Vector3(4.0, 0.6, 1.4),
        explodedPos: new THREE.Vector3(4.2, 2.6, 2.4),
        anchorRot: new THREE.Euler(0, 0, 0),
        explodedRot: new THREE.Euler(0.2, -0.2, 0),
        title: "Tactile Decline Button",
        subtitle: "Instant State Abort",
        description: "Cancels transaction payload, wipes transient memory buffers, and prevents replay attacks instantly."
    });

    // ==========================================
    // 5. INMP441 I2S DIGITAL MEMS MICROPHONE (Input)
    // ==========================================
    const inmpGroup = new THREE.Group();

    // Purple breakout PCB
    const inmpPcbMat = new THREE.MeshStandardMaterial({
        color: 0x7E22CE,
        metalness: 0.35,
        roughness: 0.5,
    });
    const inmpPCB = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 2.0), inmpPcbMat);
    inmpPCB.castShadow = true;
    inmpGroup.add(inmpPCB);

    // Gold MEMS acoustic transducer module
    const memsGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.25, 20);
    const memsMat = new THREE.MeshStandardMaterial({
        color: 0xF59E0B,
        metalness: 0.92,
        roughness: 0.18,
    });
    const memsMesh = new THREE.Mesh(memsGeo, memsMat);
    memsMesh.position.set(0, 0.18, -0.25);
    inmpGroup.add(memsMesh);

    // Acoustic sound port aperture
    const portGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.28, 16);
    const portMat = new THREE.MeshBasicMaterial({ color: 0x09090C });
    const portMesh = new THREE.Mesh(portGeo, portMat);
    portMesh.position.set(0, 0.19, -0.25);
    inmpGroup.add(portMesh);

    // 6 gold pins (SCK, WS, SD, L/R, GND, VDD)
    for (let p = 0; p < 6; p++) {
        const pin = new THREE.Mesh(pinGeo, goldPinMaterial);
        pin.position.set(-0.6 + p * 0.24, -0.3, 0.85);
        inmpGroup.add(pin);
    }

    inmpGroup.position.set(-3.8, 0.52, 1.6);
    root.add(inmpGroup);

    parts.push({
        name: "inmp441_microphone",
        group: inmpGroup,
        anchorPos: new THREE.Vector3(-3.8, 0.52, 1.6),
        explodedPos: new THREE.Vector3(-4.4, 2.5, 2.5),
        anchorRot: new THREE.Euler(0, 0, 0),
        explodedRot: new THREE.Euler(0.2, 0.25, 0),
        title: "INMP441 I2S Microphone",
        subtitle: "Acoustic Invoice Capture (Input)",
        description: "High-precision omnidirectional digital MEMS microphone with I2S DMA streaming directly into the ggwave FSK audio decoder at 48 kHz."
    });

    // ==========================================
    // 6. PIEZO ACOUSTIC SPEAKER / BUZZER (Output)
    // ==========================================
    const speakerGroup = new THREE.Group();

    // Black cylindrical transducer body
    const spkBodyGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.72, 32);
    const spkBodyMat = new THREE.MeshStandardMaterial({
        color: 0x18181B,
        metalness: 0.4,
        roughness: 0.6,
    });
    const spkBody = new THREE.Mesh(spkBodyGeo, spkBodyMat);
    spkBody.castShadow = true;
    speakerGroup.add(spkBody);

    // Top sound aperture hole
    const spkHole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.75, 20), new THREE.MeshBasicMaterial({ color: 0x050508 }));
    speakerGroup.add(spkHole);

    // Glowing sonic pulse rings above speaker
    const pulseRings: THREE.Mesh[] = [];
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x836EF9,
        wireframe: true,
        transparent: true,
        opacity: 0.6,
    });
    for (let r = 0; r < 3; r++) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.4 + r * 0.25, 0.48 + r * 0.25, 24), ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(0, 0.45 + r * 0.2, 0);
        speakerGroup.add(ring);
        pulseRings.push(ring);
    }

    speakerGroup.position.set(1.6, 0.75, 2.0);
    root.add(speakerGroup);

    parts.push({
        name: "piezo_speaker",
        group: speakerGroup,
        anchorPos: new THREE.Vector3(1.6, 0.75, 2.0),
        explodedPos: new THREE.Vector3(2.2, 3.2, 2.4),
        anchorRot: new THREE.Euler(0, 0, 0),
        explodedRot: new THREE.Euler(0.15, -0.2, 0),
        title: "Piezo Acoustic Transducer",
        subtitle: "Ultrasonic Payment Transmission (Output)",
        description: "Emits modulated FSK audio waveforms (1875 Hz – 2187 Hz) carrying cryptographic payment signatures over air."
    });

    // ==========================================
    // 7. CURVED 3D JUMPER WIRES
    // ==========================================
    const wiresGroup = new THREE.Group();

    const wireColors = [
        0x00E5FF, // Cyan (OLED SDA)
        0x836EF9, // Purple (OLED SCL)
        0xEF4444, // Red (Power 3.3V)
        0x2563EB, // Blue (GND)
        0x10B981, // Emerald Green (Approve button signal - GPIO 18)
        0xEA580C, // Bright Orange/Amber (Decline red button signal - GPIO 19)
        0x3B82F6, // Blue (Decline button GND rail return)
        0xF59E0B, // Amber (INMP441 I2S WS)
        0xEC4899, // Pink (INMP441 I2S SD)
        0xA855F7, // Violet (Speaker DAC)
    ];

    const wirePoints: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [
        // Wire 1: OLED to ESP32
        [
            new THREE.Vector3(-3.2, 0.65, -1.8),
            new THREE.Vector3(-2.4, 1.4, -2.0),
            new THREE.Vector3(-1.2, 1.2, -1.6),
            new THREE.Vector3(-0.6, 0.65, -1.15)
        ],
        // Wire 2: OLED to Breadboard Rail
        [
            new THREE.Vector3(-3.6, 0.65, -1.8),
            new THREE.Vector3(-3.8, 1.3, -2.8),
            new THREE.Vector3(-3.2, 1.0, -3.2),
            new THREE.Vector3(-2.8, 0.45, -3.2)
        ],
        // Wire 3: Power Red Rail to ESP32
        [
            new THREE.Vector3(-1.0, 0.45, -3.2),
            new THREE.Vector3(-0.8, 1.2, -2.4),
            new THREE.Vector3(-0.4, 1.1, -1.8),
            new THREE.Vector3(0.2, 0.65, -1.15)
        ],
        // Wire 4: GND Blue Rail to ESP32
        [
            new THREE.Vector3(1.0, 0.45, -3.0),
            new THREE.Vector3(0.8, 1.3, -2.2),
            new THREE.Vector3(0.4, 1.1, -1.6),
            new THREE.Vector3(0.6, 0.65, -1.15)
        ],
        // Wire 5: Approve Button (Green) to ESP32 (GPIO 18)
        [
            new THREE.Vector3(3.6, 0.65, -1.4),
            new THREE.Vector3(2.6, 1.5, -0.8),
            new THREE.Vector3(1.6, 1.2, -0.6),
            new THREE.Vector3(1.0, 0.65, -1.15)
        ],
        // Wire 6: Decline Button (Red) to ESP32 (GPIO 19)
        [
            new THREE.Vector3(3.6, 0.65, 1.4),
            new THREE.Vector3(2.8, 1.45, 1.3),
            new THREE.Vector3(1.8, 1.25, 1.2),
            new THREE.Vector3(1.2, 0.65, 1.15)
        ],
        // Wire 7: Decline Button GND return to Breadboard Rail
        [
            new THREE.Vector3(4.4, 0.65, 1.4),
            new THREE.Vector3(4.6, 1.0, 2.2),
            new THREE.Vector3(4.2, 0.8, 2.8),
            new THREE.Vector3(3.8, 0.45, 3.2)
        ],
        // Wire 8: INMP441 Microphone to ESP32 I2S
        [
            new THREE.Vector3(-3.2, 0.65, 1.6),
            new THREE.Vector3(-2.2, 1.5, 1.8),
            new THREE.Vector3(-1.0, 1.3, 1.4),
            new THREE.Vector3(-0.4, 0.65, 1.15)
        ],
        // Wire 9: Speaker to ESP32 DAC
        [
            new THREE.Vector3(1.6, 0.8, 1.2),
            new THREE.Vector3(1.2, 1.4, 0.8),
            new THREE.Vector3(0.8, 1.2, 0.6),
            new THREE.Vector3(0.4, 0.65, 1.15)
        ]
    ];

    wirePoints.forEach((pts, i) => {
        const curve = new THREE.CatmullRomCurve3(pts);
        const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.065, 8, false);
        const tubeMat = new THREE.MeshStandardMaterial({
            color: wireColors[i % wireColors.length],
            roughness: 0.4,
            metalness: 0.1,
        });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        tubeMesh.castShadow = true;
        wiresGroup.add(tubeMesh);
    });

    wiresGroup.position.set(0, 0, 0);
    root.add(wiresGroup);

    parts.push({
        name: "jumper_wires",
        group: wiresGroup,
        anchorPos: new THREE.Vector3(0, 0, 0),
        explodedPos: new THREE.Vector3(0, 1.8, 0),
        anchorRot: new THREE.Euler(0, 0, 0),
        explodedRot: new THREE.Euler(-0.1, 0, 0),
        title: "Point-to-Point Jumper Bus",
        subtitle: "Direct GPIO & I2S Interconnects",
        description: "Hardwired electrical connections routing audio capture DMA, OLED visual feedback, and tactile confirmation pins."
    });

    // Dynamic texture animation updater
    const updateOLEDTexture = (time: number) => {
        const ctx = oledCanvas.getContext("2d");
        if (!ctx) return;

        ctx.fillStyle = "#020204";
        ctx.fillRect(0, 0, 256, 128);

        // Header status bar
        ctx.fillStyle = "#00E5FF";
        ctx.font = "bold 14px monospace";
        ctx.fillText("MELODYPAY // AIR-GAP", 12, 22);

        // Battery / Signal
        ctx.fillStyle = "#10B981";
        ctx.fillText("● READY", 190, 22);

        ctx.strokeStyle = "#00E5FF";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(10, 28);
        ctx.lineTo(246, 28);
        ctx.stroke();

        // Transaction Amount
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 26px monospace";
        ctx.fillText("1.00 USDC", 20, 64);

        // Subtitle
        ctx.fillStyle = "#836EF9";
        ctx.font = "12px monospace";
        ctx.fillText("PAYMENT AUTHORIZATION", 20, 84);

        // Frequency telemetry bar
        ctx.fillStyle = "#00E5FF";
        ctx.font = "11px monospace";
        ctx.fillText("FSK: 1875 - 2187 Hz", 20, 106);

        // Animated sound wave graph at bottom
        ctx.strokeStyle = "#00E5FF";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 160; x < 244; x += 4) {
            const y = 104 + Math.sin(x * 0.15 + time * 5) * 8;
            if (x === 160) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        oledTexture.needsUpdate = true;
    };

    const updatePulseRings = (time: number) => {
        pulseRings.forEach((ring, idx) => {
            const scale = 1.0 + ((time * 2 + idx * 0.3) % 1.0) * 0.6;
            const opacity = 0.8 - ((time * 2 + idx * 0.3) % 1.0) * 0.7;
            ring.scale.set(scale, scale, 1);
            (ring.material as THREE.MeshBasicMaterial).opacity = opacity;
        });
    };

    return {
        root,
        parts,
        updateOLEDTexture,
        updatePulseRings,
    };
}
