import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Menu, X, Radio } from "lucide-react";
import { MelodyLogoM } from "./MelodyLogoM";

export function StudioHeader() {
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    const navItems = [
        { path: "/", label: "Overview", hash: "" },
        { path: "/#features", label: "Features", hash: "features" },
        { path: "/#how-it-works", label: "How It Works", hash: "how-it-works" },
        { path: "/#prototype", label: "Prototype", hash: "prototype" },
        { path: "/#faqs", label: "FAQs", hash: "faqs" },
        { path: "/receive", label: "Terminal", hash: "" },
        { path: "/register", label: "Register", hash: "" },
    ];

    const handleScrollOrNav = (path: string, hash: string) => {
        setMobileOpen(false);
        if (hash && location.pathname === "/") {
            const el = document.getElementById(hash);
            if (el) {
                el.scrollIntoView({ behavior: "smooth" });
            }
        }
    };

    return (
        <header className="fixed top-4 sm:top-5 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-4xl select-none">
            {/* Dark Floating Architectural Header */}
            <nav className="relative bg-[#111113]/95 backdrop-blur-xl border border-white/15 rounded-xl px-4 sm:px-6 py-2.5 shadow-2xl flex items-center justify-between text-white transition-all">
                {/* Brand Logo & Title */}
                <Link 
                    to="/" 
                    className="flex items-center gap-2.5 cursor-pointer group"
                    onClick={() => setMobileOpen(false)}
                >
                    <MelodyLogoM size={20} />
                    <span className="text-sm font-semibold tracking-tight text-white font-sans">
                        MelodyPay
                    </span>
                </Link>

                {/* Desktop Nav Links */}
                <div className="hidden md:flex items-center gap-6 text-xs font-sans font-medium text-neutral-300">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path && !item.hash;
                        return (
                            <Link
                                key={item.label}
                                to={item.path}
                                onClick={() => handleScrollOrNav(item.path, item.hash)}
                                className={`transition-colors hover:text-white relative py-1 ${
                                    isActive ? "text-white font-semibold" : "text-neutral-300"
                                }`}
                            >
                                <span>{item.label}</span>
                                {isActive && (
                                    <motion.span
                                        layoutId="nav-tab-active"
                                        className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[#0088FF]"
                                    />
                                )}
                            </Link>
                        );
                    })}
                </div>

                {/* Right Action Button & Mobile Toggle */}
                <div className="flex items-center gap-2">
                    <Link
                        to="/receive"
                        className="bg-white hover:bg-neutral-100 text-[#111113] px-4 py-1.5 sm:py-2 rounded-md text-xs font-sans font-semibold transition-all shadow-sm flex items-center gap-1.5 group cursor-pointer"
                    >
                        <span>Launch Terminal</span>
                        <ArrowUpRight size={13} className="text-neutral-500 group-hover:text-black group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </Link>

                    {/* Mobile Menu Toggle Button */}
                    <button
                        type="button"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="md:hidden p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer rounded-md"
                        aria-label="Toggle navigation menu"
                    >
                        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>
            </nav>

            {/* Mobile Dropdown Menu */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                        className="md:hidden mt-2 bg-[#111113]/98 backdrop-blur-2xl border border-white/15 rounded-xl p-4 shadow-2xl flex flex-col gap-3"
                    >
                        {navItems.map((item) => (
                            <Link
                                key={item.label}
                                to={item.path}
                                onClick={() => handleScrollOrNav(item.path, item.hash)}
                                className="flex items-center justify-between px-3 py-2 rounded-md text-sm text-neutral-300 hover:text-white hover:bg-white/5 transition-colors font-sans"
                            >
                                <span>{item.label}</span>
                                <ArrowUpRight size={14} className="text-neutral-500" />
                            </Link>
                        ))}
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-neutral-400 px-3">
                            <span className="flex items-center gap-1.5">
                                <Radio size={12} className="text-[#0088FF]" />
                                KEYLESS POS RECEIVER
                            </span>
                            <span className="text-emerald-400">MULTICHAIN EVM</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
