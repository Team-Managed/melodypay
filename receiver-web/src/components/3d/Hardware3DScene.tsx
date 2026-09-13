import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildHardware3DAssembly, Hardware3DAssembly } from "./Hardware3DModel";

interface Hardware3DSceneProps {
    explosionProgress?: number; // 0.0 (assembled) to 1.0 (fully exploded)
    isHeroRotating?: boolean;
    className?: string;
    onPartSelect?: (partName: string) => void;
    activePartKey?: string; // e.g. "mcu" | "mic" | "buttons" | "amp" | "oled"
}

export function Hardware3DScene({
    explosionProgress = 0,
    isHeroRotating = true,
    className = "w-full h-full",
    onPartSelect,
    activePartKey,
}: Hardware3DSceneProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const assemblyRef = useRef<Hardware3DAssembly | null>(null);
    const activePartRef = useRef<string | undefined>(activePartKey);
    const progressRef = useRef<number>(explosionProgress);

    useEffect(() => {
        progressRef.current = explosionProgress;
    }, [explosionProgress]);

    useEffect(() => {
        activePartRef.current = activePartKey;
    }, [activePartKey]);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        // 1. SCENE SETUP
        const scene = new THREE.Scene();

        // 2. CAMERA SETUP - eye-level viewing with crisp framing
        const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(0, 0.35, 16.8);
        camera.lookAt(0, 0.1, 0);

        // 3. RENDERER SETUP
        const renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // 4. THREE-POINT STUDIO LIGHTING
        // Ambient fill
        const ambientLight = new THREE.AmbientLight(0x201A35, 1.4);
        scene.add(ambientLight);

        // Key light (Crisp white top-front)
        const keyLight = new THREE.DirectionalLight(0xFFFFFF, 3.2);
        keyLight.position.set(6, 12, 12);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        keyLight.shadow.camera.near = 0.5;
        keyLight.shadow.camera.far = 30;
        keyLight.shadow.bias = -0.0005;
        scene.add(keyLight);

        // Rim Backlight (Monad purple / electric violet backlight)
        const rimLight = new THREE.DirectionalLight(0x836EF9, 4.5);
        rimLight.position.set(-8, 6, -8);
        scene.add(rimLight);

        // Cyan Fill Light (Soft acoustic telemetry reflection)
        const cyanFill = new THREE.PointLight(0x00E5FF, 2.5, 20);
        cyanFill.position.set(6, -4, 8);
        scene.add(cyanFill);

        // Dynamic Spotlight for component highlighting
        const highlightSpot = new THREE.SpotLight(0x059669, 0, 18, Math.PI / 4.5, 0.4, 1.2);
        highlightSpot.position.set(0, 7, 5);
        scene.add(highlightSpot);
        scene.add(highlightSpot.target);

        // Bottom bounce light
        const bottomBounce = new THREE.DirectionalLight(0x3B82F6, 1.2);
        bottomBounce.position.set(0, -8, 4);
        scene.add(bottomBounce);

        // 5. BUILD 3D HARDWARE MODEL (STANDING UPRIGHT FACING FRONT)
        const pivotGroup = new THREE.Group();
        scene.add(pivotGroup);

        const assembly = buildHardware3DAssembly();
        assemblyRef.current = assembly;

        // Scale to 1.15 for commanding, detailed visual presence
        assembly.root.scale.set(1.15, 1.15, 1.15);

        // Orient model so the FRONT FACE stands upright facing the user:
        assembly.root.rotation.x = 1.28;
        assembly.root.rotation.y = -0.22;
        assembly.root.rotation.z = 0;
        assembly.root.position.set(0, 0, 0);
        pivotGroup.add(assembly.root);

        // Holographic Highlight Beacon Group (added to assembly root so it follows orientation)
        const beaconGroup = new THREE.Group();
        assembly.root.add(beaconGroup);

        // Inner pulsing ring
        const beaconRingGeo = new THREE.RingGeometry(0.32, 0.42, 32);
        const beaconRingMat = new THREE.MeshBasicMaterial({
            color: 0x059669,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,
        });
        const beaconRing = new THREE.Mesh(beaconRingGeo, beaconRingMat);
        beaconRing.rotation.x = -Math.PI / 2;
        beaconGroup.add(beaconRing);

        // Outer radiating ping ring
        const pingRingGeo = new THREE.RingGeometry(0.42, 0.48, 32);
        const pingRingMat = new THREE.MeshBasicMaterial({
            color: 0x34D399,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6,
        });
        const pingRing = new THREE.Mesh(pingRingGeo, pingRingMat);
        pingRing.rotation.x = -Math.PI / 2;
        beaconGroup.add(pingRing);

        // Downward pointing diamond marker
        const pinGeo = new THREE.ConeGeometry(0.12, 0.28, 4);
        const pinMat = new THREE.MeshBasicMaterial({ color: 0x059669 });
        const pinMesh = new THREE.Mesh(pinGeo, pinMat);
        pinMesh.rotation.x = Math.PI; // point downwards
        pinMesh.position.set(0, 0.22, 0);
        beaconGroup.add(pinMesh);

        // 6. RESIZE OBSERVER & HANDLER
        const handleResize = () => {
            if (!container) return;
            const w = container.clientWidth || 300;
            const h = container.clientHeight || 300;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(container);
        window.addEventListener("resize", handleResize);

        // 8. RAYCASTING INTERACTION
        const raycaster = new THREE.Raycaster();
        const mouseVec = new THREE.Vector2();

        const handleClick = (e: MouseEvent) => {
            if (!onPartSelect) return;
            const rect = canvas.getBoundingClientRect();
            mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouseVec.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
            raycaster.setFromCamera(mouseVec, camera);

            const intersects = raycaster.intersectObjects(assembly.root.children, true);
            if (intersects.length > 0) {
                let currentObj: THREE.Object3D | null = intersects[0].object;
                while (currentObj && currentObj !== assembly.root) {
                    const matchedPart = assembly.parts.find(p => p.group === currentObj);
                    if (matchedPart) {
                        onPartSelect(matchedPart.name);
                        return;
                    }
                    currentObj = currentObj.parent;
                }
            }
        };
        canvas.addEventListener("click", handleClick);

        // 9. ANIMATION LOOP
        let animId: number;
        let clock = new THREE.Clock();

        const render = () => {
            const elapsedTime = clock.getElapsedTime();
            const p = progressRef.current;

            // Stable Upright Pivot (Does not follow mouse)
            if (p <= 0.02) {
                pivotGroup.rotation.set(0, -0.22, 0);
                pivotGroup.position.y = Math.sin(elapsedTime * 1.2) * 0.04;
            } else {
                pivotGroup.rotation.set(0.18, 0.42, 0);
                pivotGroup.position.y = -0.1;
            }

            // Identify active part from activePartKey
            const activeKey = (activePartRef.current || "").toLowerCase();
            let activePart = null;
            if (activeKey.includes("mcu") || activeKey.includes("esp32")) {
                activePart = assembly.parts.find(p => p.name === "esp32");
            } else if (activeKey.includes("mic") || activeKey.includes("inmp")) {
                activePart = assembly.parts.find(p => p.name.includes("mic"));
            } else if (activeKey.includes("button")) {
                activePart = assembly.parts.find(p => p.name.includes("approve") || p.name.includes("button"));
            } else if (activeKey.includes("amp") || activeKey.includes("speaker")) {
                activePart = assembly.parts.find(p => p.name.includes("speaker"));
            } else if (activeKey.includes("oled") || activeKey.includes("display")) {
                activePart = assembly.parts.find(p => p.name === "oled");
            }

            // Interpolate each part: position + active component elevation
            assembly.parts.forEach(part => {
                const isThisPartActive = 
                    (activeKey.includes("mcu") && part.name === "esp32") ||
                    (activeKey.includes("mic") && part.name.includes("mic")) ||
                    (activeKey.includes("button") && part.name.includes("button")) ||
                    (activeKey.includes("amp") && part.name.includes("speaker")) ||
                    (activeKey.includes("oled") && part.name === "oled");

                if (p <= 0.02) {
                    // Elevated hover highlight when part is selected
                    const targetY = isThisPartActive ? part.anchorPos.y + 0.35 : part.anchorPos.y;
                    part.group.position.y += (targetY - part.group.position.y) * 0.12;

                    const targetScale = isThisPartActive ? 1.05 : 1.0;
                    part.group.scale.x += (targetScale - part.group.scale.x) * 0.12;
                    part.group.scale.y += (targetScale - part.group.scale.y) * 0.12;
                    part.group.scale.z += (targetScale - part.group.scale.z) * 0.12;
                } else {
                    part.group.position.lerpVectors(part.anchorPos, part.explodedPos, p);
                    part.group.rotation.x = part.anchorRot.x + (part.explodedRot.x - part.anchorRot.x) * p;
                    part.group.rotation.y = part.anchorRot.y + (part.explodedRot.y - part.anchorRot.y) * p;
                    part.group.rotation.z = part.anchorRot.z + (part.explodedRot.z - part.anchorRot.z) * p;
                }
            });

            // Position & animate the beacon indicator
            if (activePart && p <= 0.02) {
                beaconGroup.visible = true;
                const targetBeaconPos = new THREE.Vector3(
                    activePart.anchorPos.x,
                    activePart.group.position.y + 0.72 + Math.sin(elapsedTime * 3.5) * 0.05,
                    activePart.anchorPos.z
                );
                beaconGroup.position.lerp(targetBeaconPos, 0.15);

                const pingProgress = (elapsedTime * 2.2) % 1.0;
                pingRing.scale.set(1 + pingProgress * 0.8, 1 + pingProgress * 0.8, 1);
                pingRingMat.opacity = (1.0 - pingProgress) * 0.65;

                highlightSpot.target.position.copy(activePart.group.position);
                highlightSpot.intensity = 5.5 + Math.sin(elapsedTime * 3) * 1.5;
            } else {
                beaconGroup.visible = false;
                highlightSpot.intensity = 0;
            }

            // Update real-time textures & pulse rings
            assembly.updateOLEDTexture(elapsedTime);
            assembly.updatePulseRings(elapsedTime);

            renderer.render(scene, camera);
            animId = requestAnimationFrame(render);
        };

        animId = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(animId);
            resizeObserver.disconnect();
            window.removeEventListener("resize", handleResize);
            canvas.removeEventListener("click", handleClick);
            renderer.dispose();
        };
    }, [isHeroRotating, onPartSelect]);

    return (
        <div ref={containerRef} className={`relative select-none ${className}`}>
            <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />
        </div>
    );
}
