import { useState, useEffect } from "react";
import { Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("pwa_dismissed") === "1");

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };
        window.addEventListener("beforeinstallprompt", handler);
        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    async function handleInstall() {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
            setDeferredPrompt(null);
        }
    }

    function handleDismiss() {
        setDismissed(true);
        sessionStorage.setItem("pwa_dismissed", "1");
    }

    // Don't show if already installed, dismissed, or no prompt available
    if (!deferredPrompt || dismissed) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md">
            <div className="bg-white border border-app-border rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.15)] p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Download size={20} className="text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-app-dark">Install MelodyPay</p>
                    <p className="text-xs text-app-dark/50">Works offline for air-gapped payments</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                    <button
                        onClick={handleDismiss}
                        className="text-xs text-app-dark/40 hover:text-app-dark/70 px-2 py-1"
                    >
                        Later
                    </button>
                    <button
                        onClick={handleInstall}
                        className="bg-[#1C1C1E] text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-black transition-colors"
                    >
                        Install
                    </button>
                </div>
            </div>
        </div>
    );
}
