import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, UserCircle2, ShieldCheck, Zap, Coins, Globe, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Copy } from "../components/Copy";
import { TextSwap } from "../components/TextSwap";
import { GsapColorCycle } from "../components/GsapColorCycle";

export function Home() {
    const barsContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            const handleMouseMove = (e: MouseEvent) => {
                const xOffset = (e.clientX / window.innerWidth - 0.5) * 30;
                gsap.to(".sound-bar", {
                    x: xOffset,
                    duration: 1.5,
                    ease: "power2.out",
                    stagger: { amount: 0.2, from: "center" }
                });
            };
            window.addEventListener("mousemove", handleMouseMove);
            return () => window.removeEventListener("mousemove", handleMouseMove);
        }, barsContainerRef);
        return () => ctx.revert();
    }, []);

    const faqs = [
        {
            question: "How does audio transaction work?",
            answer: "The receiver sends a payment request over sound. An offline hardware wallet reviews and signs it, then sends the signed transaction back over sound for broadcast."
        },
        {
            question: "Is it secure?",
            answer: "The receiver never holds the sender private key. The hardware wallet displays the recipient, amount, chain, and fee, then requires physical approval before signing."
        },
        {
            question: "Do I need an internet connection to send?",
            answer: "The receiver needs internet access to fetch nonce and fee data and broadcast the signed transaction. The hardware signer does not need internet access."
        }
    ];

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="flex-1 flex flex-col w-full relative"
        >
            {/* HERO SECTION */}
            <div className="flex flex-col lg:flex-row w-full min-h-[90vh] relative">
                {/* Left Pane: Content */}
                <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 lg:pl-24 lg:pr-16 pt-40 lg:pt-16 z-10">
                    <h1 className="text-6xl lg:text-7xl font-serif font-medium text-app-dark leading-[1.05] tracking-tight mb-6 mt-12">
                        <Copy duration={0.4} stagger={0.15} blockColor="#BAE1FF">
                            {[
                                "Bridge the gap:", 
                                <span>
                                    simply add{" "}
                                    <GsapColorCycle colors={["#FF0099", "#FFD600", "#00FFA3", "#1848FF"]}>
                                        <TextSwap texts={["sound.", "speed.", "magic.", "safety.", "Monad."]} />
                                    </GsapColorCycle>
                                </span>
                            ]}
                        </Copy>
                    </h1>
                    
                    <div className="text-app-dark/80 text-lg font-sans mb-10 max-w-md leading-relaxed">
                        <Copy duration={0.3} stagger={0.05} delay={0.6} blockColor="#E5E5E5">
                            {[
                                "Accept secure, sound-based crypto", 
                                <span>
                                    <GsapColorCycle colors={["#1848FF", "#00FFA3", "#FF0099"]}>
                                        <TextSwap texts={["payments", "transfers", "transactions"]} />
                                    </GsapColorCycle> 
                                    {" "}on the Monad network
                                </span>, 
                                "using high-frequency audio waves.", 
                                "The receiver stays online; the signer stays offline."
                            ]}
                        </Copy>
                    </div>
                    
                    <div>
                        <Link 
                            to="/receive" 
                            className="inline-block bg-[#1C1C1E] text-white px-8 py-4 rounded-lg font-sans font-medium text-sm hover:bg-black transition-colors"
                        >
                            Open receiver
                        </Link>
                    </div>

                </div>

                {/* Right Pane: Vibrant Background & Phone Mockup */}
                <div className="w-full lg:w-[55%] relative flex items-center justify-center min-h-[60vh] lg:min-h-[90vh] overflow-hidden">
                    {/* Vibrant Soundwave Background */}
                    <div ref={barsContainerRef} className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-60 mix-blend-multiply px-4 lg:px-12">
                        {[...Array(20)].map((_, i) => {
                            const colors = ["vibrant-gradient-1", "vibrant-gradient-2", "vibrant-gradient-3", "vibrant-gradient-4"];
                            return (
                                <motion.div
                                    key={i}
                                    className={`sound-bar flex-1 rounded-full blur-[1px] ${colors[i % 4]}`}
                                    style={{ height: "70%", transformOrigin: "center" }}
                                    animate={{
                                        scaleY: [0.1, Math.random() * 0.8 + 0.2, 0.1]
                                    }}
                                    transition={{
                                        repeat: Infinity,
                                        duration: 0.6 + Math.random() * 0.4,
                                        delay: Math.random() * 0.5,
                                        ease: "easeInOut"
                                    }}
                                />
                            );
                        })}
                    </div>

                    {/* CSS Phone Mockup (Landscape) */}
                    <motion.div 
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.8 }}
                        className="relative z-20 w-[600px] h-[300px] bg-black rounded-[40px] shadow-2xl p-2.5 border-4 border-[#e5e5e5] flex items-center justify-center transform lg:-translate-x-8"
                    >
                        {/* Dynamic Island Notch */}
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-16 bg-black rounded-r-2xl z-30"></div>
                        
                        {/* Screen */}
                        <div className="w-full h-full bg-[#FAFAFA] rounded-[30px] overflow-hidden flex relative">
                            {/* Left Video/Image Placeholder area */}
                            <div className="w-[55%] h-full relative overflow-hidden bg-[#1848FF]">
                                <div className="absolute inset-0 vibrant-gradient-2 opacity-60 mix-blend-multiply"></div>
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center animate-pulse">
                                        <Mic size={32} />
                                    </div>
                                    <p className="mt-4 font-sans font-medium">Listening for Tx...</p>
                                </div>
                            </div>
                            
                            {/* Right UI area */}
                            <div className="w-[45%] h-full p-6 flex flex-col">
                                <h3 className="text-sm font-semibold text-app-dark mb-4">Payload Status</h3>
                                <div className="flex gap-3 mb-6">
                                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-black/5 p-3 flex flex-col items-center justify-center">
                                        <div className="w-8 h-8 rounded-full vibrant-gradient-1 mb-2 shadow-sm"></div>
                                        <span className="text-xs font-medium text-app-dark/60">Amount</span>
                                        <span className="text-sm font-bold text-app-dark mt-1">1.5 MON</span>
                                    </div>
                                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-black/5 p-3 flex flex-col items-center justify-center">
                                        <div className="w-8 h-8 rounded-full vibrant-gradient-3 mb-2 shadow-sm"></div>
                                        <span className="text-xs font-medium text-app-dark/60">Target</span>
                                        <span className="text-sm font-bold text-app-dark mt-1">0x8f...2a</span>
                                    </div>
                                </div>
                                <button className="mt-auto w-full bg-[#1C1C1E] text-white py-3 rounded-lg text-sm font-medium">
                                    Sign Offline
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* TICKER MARQUEE */}
            <div className="w-full py-4 bg-[#1C1C1E] flex items-center overflow-hidden z-20 border-y border-white/10 shadow-inner">
                <motion.div 
                    className="flex w-max font-sans text-sm font-medium"
                    animate={{ x: ["0%", "-50%"] }}
                    transition={{ ease: "linear", duration: 25, repeat: Infinity }}
                >
                    {[...Array(2)].map((_, i) => (
                        <div key={i} className="flex items-center shrink-0">
                            {[
                                "Air-Gapped", "Zero Latency", "Monad Native", 
                                "Offline Signing", "Sound Waves", "Universal", "Audio Broadcast"
                            ].map((text, idx) => (
                                <div key={idx} className="flex items-center">
                                    <span className="mx-10 uppercase tracking-widest text-[11px] font-bold text-white/80">{text}</span>
                                    {/* Musical Equalizer Divider */}
                                    <div className="flex items-end gap-[2px] h-3 opacity-60">
                                        {[1, 2, 3, 4].map(bar => (
                                            <motion.div 
                                                key={bar}
                                                animate={{ height: ["20%", "100%", "30%", "80%", "20%"] }}
                                                transition={{ repeat: Infinity, duration: 0.6 + Math.random(), ease: "easeInOut" }}
                                                className="w-[2px] bg-white rounded-t-sm"
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </motion.div>
            </div>

            {/* FEATURES SECTION */}
            <section id="features" className="w-full max-w-6xl mx-auto px-8 py-32">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-serif font-medium text-app-dark mb-4 flex justify-center">
                        <Copy duration={0.4} stagger={0.15} blockColor="#BAFFC9">
                            {["Premium Security.", "Seamless UX."]}
                        </Copy>
                    </h2>
                    <p className="text-app-dark/60 max-w-xl mx-auto font-sans">The world's first audio-based transaction protocol natively integrated with the lightning-fast Monad network.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { icon: ShieldCheck, color: "vibrant-gradient-1", title: "Air-Gapped Signing", desc: "Keep your private keys completely offline. Generate and sign transactions without ever connecting your device to the internet." },
                        { icon: Zap, color: "vibrant-gradient-2", title: "Zero Latency", desc: "Sound wave transmission takes milliseconds. Combined with Monad's sub-second finality, payments settle instantly." },
                        { icon: Globe, color: "vibrant-gradient-3", title: "Universal Broadcast", desc: "Any device with a speaker can send a transaction. Any device with a microphone can receive and broadcast it." }
                    ].map((feature, i) => (
                        <motion.div 
                            key={i}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.6, delay: i * 0.1 }}
                            className="bg-white p-8 rounded-3xl border border-app-border shadow-[0_15px_40px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-2 transition-transform duration-300"
                        >
                            <div className={`w-14 h-14 rounded-2xl ${feature.color} flex items-center justify-center text-white mb-6 shadow-lg`}>
                                <feature.icon size={28} />
                            </div>
                            <h3 className="text-xl font-semibold font-sans mb-3 text-app-dark">{feature.title}</h3>
                            <p className="text-app-dark/70 text-sm leading-relaxed">{feature.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* HOW IT WORKS SECTION */}
            <section id="how-it-works" className="w-full bg-white py-32 border-y border-app-border overflow-hidden">
                <div className="max-w-4xl mx-auto px-8 mb-16">
                    <div className="flex flex-col items-center">
                        <h2 className="text-4xl md:text-5xl font-serif font-medium text-app-dark mb-6 text-center flex justify-center">
                            <Copy duration={0.4} stagger={0.15} blockColor="#FFB3BA">
                                {["How the magic happens."]}
                            </Copy>
                        </h2>
                        <p className="text-app-dark/60 font-sans text-center max-w-lg">Four simple steps to execute a secure transaction over sound.</p>
                    </div>
                </div>

                {/* Horizontal Marquee Stack */}
                <div className="w-full relative py-8 flex">
                    {/* Fading Edges */}
                    <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
                    <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>
                    
                    <motion.div 
                        className="flex w-max"
                        animate={{ x: ["0%", "-50%"] }}
                        transition={{ ease: "linear", duration: 40, repeat: Infinity }}
                        whileHover={{ animationPlayState: "paused" }}
                    >
                        {[1, 2].map((set) => (
                            <div key={set} className="flex gap-8 px-4">
                                {[
                                    { step: "01", title: "Input Payload", desc: "The receiver enters the requested amount and their wallet address.", color: "#FFB3BA" },
                                    { step: "02", title: "Encode to Audio", desc: "The payload is encoded into an ultrasonic frequency pattern.", color: "#BAFFC9" },
                                    { step: "03", title: "Broadcast", desc: "The sender's device listens, verifies the payload, and signs offline.", color: "#BAE1FF" },
                                    { step: "04", title: "Submit", desc: "The signed transaction is broadcast back via sound and pushed to Monad.", color: "#FFFFBA" }
                                ].map((item, i) => (
                                    <div 
                                        key={i} 
                                        className="w-[380px] shrink-0 p-6 rounded-[32px] border border-black/5 shadow-sm flex flex-col gap-6 relative group transition-transform hover:-translate-y-2 cursor-default"
                                        style={{ backgroundColor: item.color }}
                                    >
                                        {/* Top Section: Ports & Knob */}
                                        <div className="flex justify-between items-start">
                                            {/* Knob */}
                                            <div className="w-16 h-16 rounded-full bg-white/60 backdrop-blur border border-white shadow-sm flex flex-col items-center justify-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-app-dark/40 mb-1"></div>
                                                <span className="font-mono font-bold text-app-dark/60 text-xs tracking-wider">CH {item.step}</span>
                                            </div>
                                            
                                            {/* Ports */}
                                            <div className="flex gap-3">
                                                <div className="w-8 h-8 rounded-full bg-black/10 border border-black/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] flex items-center justify-center relative">
                                                    <div className="w-3 h-3 rounded-full bg-black/80 shadow-[inset_0_1px_2px_rgba(0,0,0,1)]"></div>
                                                    <div className="absolute -bottom-4 text-[9px] font-mono text-app-dark/40 font-bold">IN</div>
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-black/10 border border-black/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] flex items-center justify-center relative">
                                                    <div className="w-3 h-3 rounded-full bg-black/80 shadow-[inset_0_1px_2px_rgba(0,0,0,1)]"></div>
                                                    <div className="absolute -bottom-4 text-[9px] font-mono text-app-dark/40 font-bold">OUT</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Screen Section */}
                                        <div className="w-full bg-white/40 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-[inset_0_1px_4px_rgba(0,0,0,0.05)] min-h-[140px] flex flex-col justify-center">
                                            <h4 className="text-xl font-sans font-bold text-app-dark mb-3 flex items-center justify-between tracking-tight">
                                                {item.title}
                                                {/* Audio Wave Icon */}
                                                <div className="flex items-end gap-[3px] h-4 opacity-50">
                                                    {[1,2,3,4].map(bar => (
                                                        <motion.div 
                                                            key={bar}
                                                            animate={{ height: ["20%", "100%", "40%", "80%", "20%"] }}
                                                            transition={{ repeat: Infinity, duration: 1 + Math.random(), ease: "easeInOut" }}
                                                            className="w-[3px] bg-app-dark rounded-t-sm"
                                                        />
                                                    ))}
                                                </div>
                                            </h4>
                                            <p className="text-app-dark/70 font-sans text-sm leading-relaxed">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* FAQS SECTION */}
            <section id="faqs" className="w-full max-w-3xl mx-auto px-8 py-32">
                <h2 className="text-4xl md:text-5xl font-serif font-medium text-app-dark mb-12 text-center flex justify-center">
                    <Copy duration={0.4} stagger={0.15} blockColor="#FFDFBA">
                        {["Frequently Asked Questions"]}
                    </Copy>
                </h2>
                <div className="space-y-4">
                    {faqs.map((faq, i) => (
                        <FAQItem key={i} question={faq.question} answer={faq.answer} />
                    ))}
                </div>
            </section>

            {/* CONTACT SECTION */}
            <section id="contact" className="w-full bg-[#FAFAFA] border-t border-app-border py-32">
                <div className="max-w-xl mx-auto px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl font-serif font-medium text-app-dark mb-4 flex justify-center">
                            <Copy duration={0.4} stagger={0.15} blockColor="#E2CBF7">
                                {["Get in touch"]}
                            </Copy>
                        </h2>
                        <p className="text-app-dark/60 font-sans">Have questions about integrating MelodyPay? We'd love to hear from you.</p>
                    </div>
                    <form className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs font-medium text-app-dark/60 mb-2 block uppercase tracking-wider">First Name</label>
                                <input type="text" className="w-full bg-white border border-app-border focus:border-app-dark outline-none px-4 py-3 rounded-xl text-sm transition-all shadow-sm" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-app-dark/60 mb-2 block uppercase tracking-wider">Last Name</label>
                                <input type="text" className="w-full bg-white border border-app-border focus:border-app-dark outline-none px-4 py-3 rounded-xl text-sm transition-all shadow-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-app-dark/60 mb-2 block uppercase tracking-wider">Email Address</label>
                            <input type="email" className="w-full bg-white border border-app-border focus:border-app-dark outline-none px-4 py-3 rounded-xl text-sm transition-all shadow-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-app-dark/60 mb-2 block uppercase tracking-wider">Message</label>
                            <textarea rows={4} className="w-full bg-white border border-app-border focus:border-app-dark outline-none px-4 py-3 rounded-xl text-sm transition-all shadow-sm resize-none"></textarea>
                        </div>
                        <button type="button" className="w-full bg-[#1C1C1E] text-white py-4 rounded-xl text-sm font-medium hover:bg-black transition-colors shadow-lg shadow-black/10">
                            Send Message
                        </button>
                    </form>
                </div>
            </section>
        </motion.div>
    );
}

function FAQItem({ question, answer }: { question: string, answer: string }) {
    const [isOpen, setIsOpen] = useState(false);
    
    return (
        <div className="border border-app-border rounded-2xl bg-white overflow-hidden transition-all duration-300 shadow-[0_5px_15px_-5px_rgba(0,0,0,0.02)]">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-6 py-5 flex items-center justify-between text-left"
            >
                <span className="font-serif text-lg font-medium text-app-dark pr-8">{question}</span>
                <ChevronDown className={`shrink-0 text-app-dark/40 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} size={20} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="px-6 pb-6 pt-0 text-app-dark/70 font-sans text-sm leading-relaxed border-t border-app-border/50 mt-2 pt-4">
                            {answer}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
