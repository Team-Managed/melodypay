import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Home } from "./pages/Home";
import { ReceivePayment } from "./pages/ReceivePayment";
import { AudioTest } from "./pages/AudioTest";
import { Register } from "./pages/Register";
import { StudioHeader } from "./components/StudioHeader";
import ReactLenis from "lenis/react";

function AnimatedRoutes() {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Home />} />
                <Route path="/register" element={<Register />} />
                <Route path="/receive" element={<ReceivePayment />} />
                <Route path="/audio-test" element={<AudioTest />} />
            </Routes>
        </AnimatePresence>
    );
}

export default function App() {
    return (
        <ReactLenis root>
            <BrowserRouter>
                <div className="min-h-screen bg-[#FBFBF9] text-[#111113] relative overflow-x-clip flex flex-col font-sans selection:bg-[#0088FF]/20 selection:text-[#111113]">
                    <StudioHeader />
                    <main className="min-h-0 flex-1 flex flex-col">
                        <AnimatedRoutes />
                    </main>
                </div>
            </BrowserRouter>
        </ReactLenis>
    );
}
