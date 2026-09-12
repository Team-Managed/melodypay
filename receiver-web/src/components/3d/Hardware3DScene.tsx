import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildHardware3DAssembly, Hardware3DAssembly } from "./Hardware3DModel";

interface Hardware3DSceneProps {
    explosionProgress?: number; // 0.0 (assembled) to 1.0 (fully exploded)
    isHeroRotating?: boolean;
    className?: string;
    onPartSelect?: (partName: string) => void;
}

export function Hardware3DScene({
    explosionProgress = 0,
    isHeroRotating = true,
    className = "w-full h-full",
    onPartSelect,
}: Hardware3DSceneProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const assemblyRef = useRef<Hardware3DAssembly | null>(null);
    const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
    });
    const progressRef = useRef<number>(explosionProgress);

    useEffect(() => {
        progressRef.current = explosionProgress;
    }, [explosionProgress]);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        // 1. SCENE SETUP
        const scene = new THREE.Scene();

        // 2. CAMERA SETUP - eye-level viewing with crisp framing
        const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(0, 0.4, 19.8);
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
        const rimLight = new THREE.DirectionalLight(0x836EF9, 5.5);
        rimLight.position.set(-8, 6, -8);
        scene.add(rimLight);

        // Cyan Fill Light (Soft acoustic telemetry reflection)
        const cyanFill = new THREE.PointLight(0x00E5FF, 2.5, 20);
        cyanFill.position.set(6, -4, 8);
        scene.add(cyanFill);

        // Bottom bounce light
        const bottomBounce = new THREE.DirectionalLight(0x3B82F6, 1.2);
        bottomBounce.position.set(0, -8, 4);
        scene.add(bottomBounce);

        // 5. BUILD 3D HARDWARE MODEL (STANDING UPRIGHT FACING FRONT)
        const pivotGroup = new THREE.Group();
        scene.add(pivotGroup);

        const assembly = buildHardware3DAssembly();
        assemblyRef.current = assembly;

        // Scale to 0.95 for commanding visual presence while remaining safely within canvas bounds
        assembly.root.scale.set(0.95, 0.95, 0.95);

        // Orient model so the FRONT FACE stands upright facing the user:
        // x tilt: ~1.28 rad (~74° upright from horizontal sleeping state)
        // y tilt: -0.22 rad (subtle 12° isometric angle for 3D depth and metallic highlights)
        // z tilt: 0 (natural horizontal breadboard orientation, all screen text readable)
        assembly.root.rotation.x = 1.28;
        assembly.root.rotation.y = -0.22;
        assembly.root.rotation.z = 0;
        assembly.root.position.set(0, 0, 0);
        pivotGroup.add(assembly.root);

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

        // 7. LIVE PRODUCT DEMO MOUSE TRACKING
        const handleMouseMove = (e: MouseEvent) => {
            // Global screen coordinates normalized around center (-1 to 1)
            const nx = (e.clientX / window.innerWidth) * 2 - 1;
            const ny = -((e.clientY / window.innerHeight) * 2 - 1);
            mouseRef.current.targetX = nx;
            mouseRef.current.targetY = ny;
        };
        window.addEventListener("mousemove", handleMouseMove);

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

            // Fluid spring lerp interpolation for live product demo feel
            mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
            mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

            // Live Product Demo Upright Pivot Rotation:
            if (p <= 0.02) {
                // Moving the cursor changes the 3D orientation in real-time (yaw, pitch, roll)
                const targetRotY = -0.22 + mouseRef.current.x * 0.48;
                const targetRotX = mouseRef.current.y * 0.28 + Math.sin(elapsedTime * 1.5) * 0.015;
                const targetRotZ = -mouseRef.current.x * 0.08;

                pivotGroup.rotation.y = targetRotY;
                pivotGroup.rotation.x = targetRotX;
                pivotGroup.rotation.z = targetRotZ;
                pivotGroup.position.y = Math.sin(elapsedTime * 1.8) * 0.08;
            } else {
                // In Exploded Features mode: angle upright device to reveal separated 3D layers
                const targetRotX = 0.18 + mouseRef.current.y * 0.15;
                const targetRotY = 0.42 + mouseRef.current.x * 0.15;
                pivotGroup.rotation.x += (targetRotX - pivotGroup.rotation.x) * 0.08;
                pivotGroup.rotation.y += (targetRotY - pivotGroup.rotation.y) * 0.08;
                pivotGroup.rotation.z += (0 - pivotGroup.rotation.z) * 0.08;
                pivotGroup.position.y += (-0.1 - pivotGroup.position.y) * 0.08;
            }

            // Interpolate each part along its explosion vector based on p
            assembly.parts.forEach(part => {
                // Position interpolation: anchor -> exploded
                part.group.position.lerpVectors(part.anchorPos, part.explodedPos, p);

                // Rotation interpolation
                part.group.rotation.x = part.anchorRot.x + (part.explodedRot.x - part.anchorRot.x) * p;
                part.group.rotation.y = part.anchorRot.y + (part.explodedRot.y - part.anchorRot.y) * p;
                part.group.rotation.z = part.anchorRot.z + (part.explodedRot.z - part.anchorRot.z) * p;
            });

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
            window.removeEventListener("mousemove", handleMouseMove);
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
