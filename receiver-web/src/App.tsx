import { BrowserRouter, Routes, Route, useLocation, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Home } from "./pages/Home";
import { ReceivePayment } from "./pages/ReceivePayment";
import { InstallPrompt } from "./components/InstallPrompt";
import ReactLenis from "lenis/react";

function AudioLogo() {
    return (
        <div className="flex items-end gap-[3px] h-6">
            {[1, 2, 3, 4, 5].map(bar => (
                <motion.div
                    key={bar}
                    animate={{ height: ["20%", "100%", "40%", "80%", "20%"] }}
                    transition={{ repeat: Infinity, duration: 0.5 + Math.random(), ease: "easeInOut" }}
                    className="w-[3px] bg-app-dark rounded-t-[1px]"
                />
            ))}
        </div>
    );
}

function Navbar() {
    return (
        <nav className="absolute top-0 left-0 w-full flex items-center justify-between px-8 py-6 z-50 pointer-events-auto">
            <Link to="/" className="flex items-center gap-3 text-app-dark hover:opacity-80 transition-opacity">
                <AudioLogo />
                <span className="text-xl font-semibold tracking-tight font-sans">MelodyPay</span>
            </Link>

            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-app-dark/60 font-sans">
                <a href="/#features" className="hover:text-app-dark transition-colors flex items-center gap-2 group">
                    <span className="w-1.5 h-1.5 rounded-full bg-app-dark/0 group-hover:bg-app-dark/40 transition-colors"></span>
                    Features
                </a>
                <a href="/#how-it-works" className="hover:text-app-dark transition-colors flex items-center gap-2 group">
                    <span className="w-1.5 h-1.5 rounded-full bg-app-dark/0 group-hover:bg-app-dark/40 transition-colors"></span>
                    How it Works
                </a>
                <a href="/#faqs" className="hover:text-app-dark transition-colors flex items-center gap-2 group">
                    <span className="w-1.5 h-1.5 rounded-full bg-app-dark/0 group-hover:bg-app-dark/40 transition-colors"></span>
                    FAQs
                </a>
                <Link to="/receive" className="text-app-dark hover:opacity-80 transition-opacity font-semibold ml-4">
                    Receive payment
                </Link>
            </div>
        </nav>
    );
}

function AnimatedRoutes() {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Home />} />
                <Route path="/receive" element={
                    <PageWrapper>
                        <ReceivePayment />
                    </PageWrapper>
                } />
            </Routes>
        </AnimatePresence>
    );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full flex-1 flex flex-col items-center justify-center relative z-10 min-h-screen py-24"
        >
            {children}
        </motion.div>
    );
}

export default function App() {
    return (
        <ReactLenis root>
            <BrowserRouter>
                <div className="min-h-screen bg-app-bg text-app-dark relative overflow-hidden flex flex-col">
                    <Navbar />
                    <AnimatedRoutes />
                    <InstallPrompt />
                </div>
            </BrowserRouter>
        </ReactLenis>
    );
}
