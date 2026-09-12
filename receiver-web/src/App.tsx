import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Home } from "./pages/Home";
import { Register } from "./pages/Register";
import { ReceivePayment } from "./pages/ReceivePayment";
import { StudioHeader } from "./components/StudioHeader";
import { InstallPrompt } from "./components/InstallPrompt";
import ReactLenis from "lenis/react";

function AnimatedRoutes() {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Home />} />
                <Route path="/register" element={<Register />} />
                <Route path="/receive" element={<ReceivePayment />} />
            </Routes>
        </AnimatePresence>
    );
}

export default function App() {
    return (
        <ReactLenis root>
            <BrowserRouter>
                <div className="min-h-screen bg-[#FBFBF9] text-[#111113] relative overflow-hidden flex flex-col font-sans selection:bg-[#0088FF]/20 selection:text-[#111113]">
                    <StudioHeader />
                    <main className="flex-1 flex flex-col">
                        <AnimatedRoutes />
                    </main>
                    <InstallPrompt />
                </div>
            </BrowserRouter>
        </ReactLenis>
    );
}
