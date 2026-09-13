import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
    CheckCircle2, 
    AlertCircle, 
    Cpu, 
    ShieldCheck, 
    Radio,
    Sparkles,
    ArrowRight,
    Mail,
    Wallet,
    Loader2
} from "lucide-react";
import { sendPrebookingConfirmationEmail } from "../core/email";

// Base Mainnet Constants (Chain ID 8453)
const BASE_CHAIN_ID = 8453;

// Official Circle Native USDC on Base Mainnet
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TREASURY_ADDRESS = "0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF";

// Target Contract — set VITE_PREBOOKING_CONTRACT_ADDRESS in .env after mainnet deployment
const RAW_PREBOOKING_ADDRESS =
    (import.meta as any).env?.VITE_PREBOOKING_CONTRACT_ADDRESS || "";

const PREBOOKING_CONTRACT_ADDRESS = (() => {
    try {
        if (!RAW_PREBOOKING_ADDRESS) return "";
        return ethers.getAddress(RAW_PREBOOKING_ADDRESS.toLowerCase());
    } catch {
        return "";
    }
})();

const PREBOOKING_ABI = [
    "function prebook() external returns (uint256 queueNumber)",
    "function prebook(uint256 quantity) external returns (uint256 startQueueNumber)",
    "function getQueueCount() external view returns (uint256)",
    "function getUserQueue(address user) external view returns (uint256)",
    "function getUserUnits(address user) external view returns (uint256)",
    "function hasPrebooked(address user) external view returns (bool)",
    "function totalPrebookings() external view returns (uint256)",
    "event Prebooked(uint256 indexed queueNumber, address indexed user, uint256 totalCost, uint256 quantity, uint256 timestamp)",
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
];

export function Register() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
    const [currentChainId, setCurrentChainId] = useState<number>(BASE_CHAIN_ID);
    const [isBaseNetwork, setIsBaseNetwork] = useState(false);
    const [queueCount, setQueueCount] = useState<number>(0);
    const [userExistingQueue, setUserExistingQueue] = useState<number | null>(null);
    const [userUnits, setUserUnits] = useState<number>(0);
    const [quantity, setQuantity] = useState<number>(1);
    const [usdcAllowance, setUsdcAllowance] = useState<bigint>(0n);
    const [usdcBalance, setUsdcBalance] = useState<string>("0.00");
    const [isApproving, setIsApproving] = useState(false);
    const [isPrebooking, setIsPrebooking] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [statusMessage, setStatusMessage] = useState("");

    const activeUsdcAddress = BASE_USDC;

    const unitPrice = 1.0;
    const totalPrice = (quantity * unitPrice).toFixed(2);
    const totalAllowanceNeeded = BigInt(quantity) * 1_000_000n;

    // Fetch live on-chain queue count from Base Mainnet contract immediately
    useEffect(() => {
        const fetchLiveQueue = async () => {
            if (!PREBOOKING_CONTRACT_ADDRESS || !ethers.isAddress(PREBOOKING_CONTRACT_ADDRESS)) {
                return;
            }
            try {
                const rpcProvider = new ethers.JsonRpcProvider("https://mainnet.base.org");
                const contract = new ethers.Contract(PREBOOKING_CONTRACT_ADDRESS, PREBOOKING_ABI, rpcProvider);
                const count = await contract.getQueueCount();
                setQueueCount(Number(count));
            } catch (err) {
                console.warn("Could not read on-chain queue count:", err);
            }
        };
        fetchLiveQueue();
    }, []);

    // 1. Check connected wallet & Base network on mount
    useEffect(() => {
        const checkWalletAndNetwork = async () => {
            if (typeof window !== "undefined" && (window as any).ethereum) {
                try {
                    const provider = new ethers.BrowserProvider((window as any).ethereum);
                    const accounts = await provider.listAccounts();
                    if (accounts.length > 0) {
                        const addr = accounts[0].address;
                        setConnectedWallet(addr);
                        checkNetworkAndState(provider, addr);
                    }
                } catch {}

                (window as any).ethereum.on?.("accountsChanged", (accounts: string[]) => {
                    if (accounts && accounts.length > 0) {
                        setConnectedWallet(accounts[0]);
                        const provider = new ethers.BrowserProvider((window as any).ethereum);
                        checkNetworkAndState(provider, accounts[0]);
                    } else {
                        setConnectedWallet(null);
                        setUserExistingQueue(null);
                    }
                });

                (window as any).ethereum.on?.("chainChanged", () => {
                    window.location.reload();
                });
            }
        };

        checkWalletAndNetwork();
    }, []);

    const checkNetworkAndState = async (provider: ethers.BrowserProvider, userAddr: string) => {
        try {
            const network = await provider.getNetwork();
            const chainId = Number(network.chainId);
            setCurrentChainId(chainId);
            const isBase = chainId === BASE_CHAIN_ID;
            setIsBaseNetwork(isBase);

            const usdcAddr = BASE_USDC;

            if (isBase && PREBOOKING_CONTRACT_ADDRESS && ethers.isAddress(PREBOOKING_CONTRACT_ADDRESS)) {
                // Read live queue count & user reservations
                try {
                    const contract = new ethers.Contract(PREBOOKING_CONTRACT_ADDRESS, PREBOOKING_ABI, provider);
                    const count = await contract.getQueueCount();
                    setQueueCount(Number(count));

                    const [existingQ, units] = await Promise.all([
                        contract.getUserQueue(userAddr).catch(() => 0n),
                        contract.getUserUnits(userAddr).catch(() => 0n),
                    ]);
                    if (Number(existingQ) > 0) {
                        setUserExistingQueue(Number(existingQ));
                        setUserUnits(Number(units) || 1);
                    } else {
                        setUserExistingQueue(null);
                        setUserUnits(0);
                    }
                } catch {}

                // Check USDC balance & allowance
                try {
                    const usdcContract = new ethers.Contract(usdcAddr, ERC20_ABI, provider);
                    const [bal, allow] = await Promise.all([
                        usdcContract.balanceOf(userAddr),
                        usdcContract.allowance(userAddr, PREBOOKING_CONTRACT_ADDRESS),
                    ]);
                    setUsdcBalance(ethers.formatUnits(bal, 6));
                    setUsdcAllowance(allow);
                } catch {}
            } else if (isBase) {
                try {
                    const usdcContract = new ethers.Contract(usdcAddr, ERC20_ABI, provider);
                    const bal = await usdcContract.balanceOf(userAddr);
                    setUsdcBalance(ethers.formatUnits(bal, 6));
                } catch {}
            }
        } catch {}
    };

    const connectWallet = async () => {
        setErrorMessage("");
        if (typeof window === "undefined" || !(window as any).ethereum) {
            setErrorMessage("No Web3 wallet found. Please install MetaMask or Coinbase Wallet.");
            return;
        }

        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const accounts = await provider.send("eth_requestAccounts", []);
            if (accounts.length > 0) {
                setConnectedWallet(accounts[0]);
                checkNetworkAndState(provider, accounts[0]);
            }
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to connect wallet.");
        }
    };

    const disconnectWallet = () => {
        setConnectedWallet(null);
        setUserExistingQueue(null);
        setUserUnits(0);
        setUsdcAllowance(0n);
        setUsdcBalance("0.00");
        setErrorMessage("");
        setStatusMessage("");
    };

    const switchToBase = async () => {
        if (typeof window === "undefined" || !(window as any).ethereum) return;
        try {
            await (window as any).ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: "0x2105" }], // 8453 in hex (Base Mainnet)
            });
        } catch (switchError: any) {
            if (switchError.code === 4902) {
                try {
                    await (window as any).ethereum.request({
                        method: "wallet_addEthereumChain",
                        params: [
                            {
                                chainId: "0x2105",
                                chainName: "Base",
                                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                                rpcUrls: ["https://mainnet.base.org"],
                                blockExplorerUrls: ["https://basescan.org"],
                            },
                        ],
                    });
                } catch {}
            }
        }
    };

    const handleApproveUSDC = async () => {
        if (!connectedWallet) {
            connectWallet();
            return;
        }
        if (!isBaseNetwork) {
            switchToBase();
            return;
        }

        if (!PREBOOKING_CONTRACT_ADDRESS || !ethers.isAddress(PREBOOKING_CONTRACT_ADDRESS)) {
            setErrorMessage("MelodyPay Prebooking contract is not yet deployed or configured on Base Mainnet. Please deploy and set VITE_PREBOOKING_CONTRACT_ADDRESS in .env.");
            return;
        }

        setErrorMessage("");
        setIsApproving(true);
        setStatusMessage(`Requesting ${totalPrice} USDC approval in wallet...`);

        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();
            const usdcContract = new ethers.Contract(activeUsdcAddress, ERC20_ABI, signer);

            // Approve needed USDC
            const tx = await usdcContract.approve(PREBOOKING_CONTRACT_ADDRESS, totalAllowanceNeeded);
            setStatusMessage("Awaiting approval transaction confirmation...");
            await tx.wait(1);

            setUsdcAllowance(totalAllowanceNeeded);
            setStatusMessage("USDC approval confirmed! Ready to pre-book.");
        } catch (err: any) {
            setErrorMessage(err.reason || err.message || "Failed to approve USDC.");
            setStatusMessage("");
        } finally {
            setIsApproving(false);
        }
    };

    const handlePrebook = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage("");
        setStatusMessage("");

        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
            setErrorMessage("Please enter a valid email address to receive your confirmation and queue updates.");
            return;
        }

        if (!connectedWallet) {
            connectWallet();
            return;
        }

        if (!isBaseNetwork) {
            switchToBase();
            return;
        }

        if (!PREBOOKING_CONTRACT_ADDRESS || !ethers.isAddress(PREBOOKING_CONTRACT_ADDRESS)) {
            setErrorMessage("MelodyPay Prebooking contract is not yet deployed or configured on Base Mainnet. Please deploy and set VITE_PREBOOKING_CONTRACT_ADDRESS in .env.");
            return;
        }

        const networkName = "Base Mainnet";
        setIsPrebooking(true);
        setStatusMessage(`Preparing ${totalPrice} USDC pre-booking on ${networkName}...`);

        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();
            const userAddress = await signer.getAddress();
            const contract = new ethers.Contract(PREBOOKING_CONTRACT_ADDRESS, PREBOOKING_ABI, signer);

            // 1. Check USDC Balance
            const usdcContract = new ethers.Contract(activeUsdcAddress, ERC20_ABI, signer);
            const bal = await usdcContract.balanceOf(userAddress);
            if (bal < totalAllowanceNeeded) {
                setErrorMessage(`Insufficient USDC on Base. Your balance is ${ethers.formatUnits(bal, 6)} USDC, but ${totalPrice} USDC is required for ${quantity} MelodyPay HardWallet${quantity > 1 ? "s" : ""}.`);
                setIsPrebooking(false);
                setStatusMessage("");
                return;
            }

            // 2. Check Allowance and Auto-Approve if needed
            const currentAllowance = await usdcContract.allowance(userAddress, PREBOOKING_CONTRACT_ADDRESS);
            if (currentAllowance < totalAllowanceNeeded) {
                setStatusMessage(`Step 1/2: Please approve ${totalPrice} USDC in your wallet...`);
                const approveTx = await usdcContract.approve(PREBOOKING_CONTRACT_ADDRESS, totalAllowanceNeeded);
                setStatusMessage("Awaiting USDC approval confirmation on Base Mainnet...");
                await approveTx.wait(1);
                setUsdcAllowance(totalAllowanceNeeded);
            }

            // 3. Submit real prebooking transaction on Base Mainnet
            setStatusMessage(`Step 2/2: Confirming ${totalPrice} USDC pre-booking for ${quantity} MelodyPay HardWallet${quantity > 1 ? "s" : ""} in wallet...`);
            const tx = await contract["prebook(uint256)"](quantity);
            setStatusMessage("Awaiting on-chain settlement on Base Mainnet...");
            const receipt = await tx.wait(1);
            const txHash = receipt.hash;

            setStatusMessage("Payment confirmed on-chain! Dispatching confirmation email...");

            // 4. Dispatch Confirmation Email with exact subject "Prebooked"
            const emailResult = await sendPrebookingConfirmationEmail({
                to: cleanEmail,
                quantity,
                txHash,
                payerAddress: userAddress,
                amount: totalPrice,
                networkName,
                timestamp: new Date().toISOString(),
            });

            if (!emailResult.success && emailResult.error) {
                console.warn("[Register] Email dispatch notice:", emailResult.error);
                setStatusMessage(`Payment confirmed! Note on email: ${emailResult.error}`);
            }

            // 5. Prepare receipt data for /receipt
            const receiptData = {
                type: "prebooking" as const,
                quantity,
                amount: totalPrice,
                token: "USDC",
                recipient: TREASURY_ADDRESS,
                payer: userAddress,
                txHash,
                chainId: BASE_CHAIN_ID,
                networkName,
                timestamp: new Date().toISOString(),
                receiptId: `PREBOOK-BASE-${Date.now().toString().slice(-6)}`,
            };

            // 6. Save to localStorage for refresh persistence
            try {
                localStorage.setItem("melodypay_last_receipt", JSON.stringify(receiptData));
            } catch {}

            // 7. Navigate to receipt
            setStatusMessage("Redirecting to your thermal POS receipt...");
            setTimeout(() => {
                navigate("/receipt", { state: receiptData });
            }, 800);

        } catch (err: any) {
            console.error("Pre-booking error:", err);
            const reason = err.reason || err.shortMessage || err.message || "Pre-booking failed. Please check your wallet and try again.";
            setErrorMessage(reason);
            setIsPrebooking(false);
            setStatusMessage("");
        }
    };

    return (
        <div className="flex-1 flex flex-col justify-start lg:justify-center w-full text-[#111113] relative overflow-x-hidden overflow-y-auto lg:overflow-hidden py-6 sm:py-8 pt-20 sm:pt-24 lg:pt-26 min-h-screen lg:h-screen lg:max-h-screen font-sans selection:bg-[#836EF9]/20 selection:text-[#111113]">
            {/* Full-Bleed Meadow with Birds Aerial Background */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <img
                    src="/image copy 2.png"
                    alt="Meadow with Birds Background"
                    className="w-full h-full object-cover object-center select-none scale-105"
                />
                {/* Soft ambient vignette & subtle darkening for superior contrast and readability */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/55 pointer-events-none" />
                <div className="absolute inset-0 bg-[#0d281a]/20 backdrop-blur-[0.5px] pointer-events-none" />
            </div>

            <div className="relative w-full max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-10 z-10 flex-1 flex flex-col justify-center">
                {/* Page Title Header - Brought lower down for balanced screen composition */}
                <div className="mb-6 lg:mb-7 text-center max-w-2xl mx-auto">
                    <span className="text-[11px] font-mono text-[#38BDF8] uppercase tracking-[0.22em] font-semibold mb-2 block drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
                        // PRIORITY HARDWARE WAITLIST
                    </span>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)] font-sans leading-[1.12]">
                        Pre-Book Your Sound Wallet.<br />
                        <span className="text-white/85 font-normal">Sign offline. Settle on Base.</span>
                    </h1>
                    <p className="text-sm sm:text-base font-sans text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] mt-2 sm:mt-2.5 leading-relaxed max-w-xl mx-auto">
                        Secure first-batch hardware allocation for the ESP32-S3 Air-Gapped Acoustic Sound Terminal. 
                        Pay 1.00 USDC on Base to confirm your MelodyPay HardWallet pre-order.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-7 items-stretch flex-1 lg:max-h-[520px]">
                    {/* Left Column: Pre-Booking Form (Compact & Clean White Transparent Glassmorphic Card) */}
                    <div className="bg-white/[0.07] backdrop-blur-2xl border border-white/25 rounded-2xl p-5 sm:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.25)] ring-1 ring-white/10 flex flex-col justify-between h-full">
                        <div className="flex flex-col justify-between h-full space-y-3.5">
                            {/* Lean Top Wallet Status Bar */}
                            <div className="p-2.5 px-3.5 rounded-xl border border-white/20 bg-white/[0.08] backdrop-blur-md flex items-center justify-between text-xs font-sans">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-white/15 text-white">
                                        <Wallet size={12} />
                                    </div>
                                    <span className="font-semibold text-white font-sans">
                                        {connectedWallet ? "Wallet Active" : "No Wallet Connected"}
                                    </span>
                                    {connectedWallet && (
                                        <span className="text-white/70 font-mono text-[11px] hidden sm:inline">
                                            ({connectedWallet.slice(0, 6)}...{connectedWallet.slice(-4)})
                                        </span>
                                    )}
                                </div>
                                <div>
                                    {connectedWallet ? (
                                        <button
                                            type="button"
                                            onClick={disconnectWallet}
                                            className="text-white/75 hover:text-white underline cursor-pointer text-xs font-sans transition-colors"
                                        >
                                            Disconnect
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={connectWallet}
                                            className="bg-white hover:bg-white/90 text-black px-3 py-1.5 rounded-md text-xs font-semibold font-sans shadow-sm transition-all cursor-pointer"
                                        >
                                            Connect
                                        </button>
                                    )}
                                </div>
                            </div>

                            <form onSubmit={handlePrebook} className="space-y-3.5 flex-1 flex flex-col justify-between">
                                {/* Step 1: Contact Email */}
                                <div>
                                    <label className="block text-xs font-sans font-semibold text-white mb-1.5">
                                        Contact Email
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/50">
                                            <Mail size={14} />
                                        </div>
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="developer@company.com"
                                            className="w-full bg-white/[0.08] border border-white/25 focus:border-white focus:bg-white/[0.14] focus:ring-1 focus:ring-white rounded-lg pl-9 pr-3 py-2.5 text-sm font-sans text-white placeholder-white/40 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Step 2: Multi-Unit Quantity & Pricing Card */}
                                <div className="p-3 px-4 bg-white/[0.08] backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-sans font-semibold text-white block">
                                            ESP32-S3 MelodyPay HardWallet Units
                                        </span>
                                        <span className="text-[11px] text-white/70 font-sans block">
                                            1.00 USDC per HardWallet // Direct Settlement
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/20">
                                            <button
                                                type="button"
                                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                                disabled={quantity <= 1}
                                                className="w-6 h-6 rounded-md bg-white/20 hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                                                title="Decrease quantity"
                                            >
                                                -
                                            </button>
                                            <span className="w-7 text-center font-mono font-bold text-white text-xs">
                                                {quantity}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setQuantity(Math.min(10, quantity + 1))}
                                                disabled={quantity >= 10}
                                                className="w-6 h-6 rounded-md bg-white/20 hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                                                title="Increase quantity"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <div className="text-right pl-2 border-l border-white/20 min-w-[70px]">
                                            <span className="text-lg font-bold font-sans text-white block tracking-tight leading-tight">
                                                {totalPrice} USDC
                                            </span>
                                            <span className="text-[9px] font-mono text-white/70 block uppercase tracking-wider">
                                                Base Mainnet
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Active Reservation Badge (if already pre-booked) */}
                                {userExistingQueue !== null && (
                                    <div className="p-2.5 px-3.5 rounded-lg bg-emerald-500/20 border border-emerald-400/35 text-xs font-sans text-white flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 truncate">
                                            <CheckCircle2 size={13} className="shrink-0 text-emerald-300" />
                                            <span className="truncate">
                                                Active order: <strong>{userUnits || 1} unit{(userUnits || 1) > 1 ? "s" : ""}</strong> (Queue #{String(userExistingQueue).padStart(3, "0")})
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => navigate("/receipt")}
                                            className="text-[11px] font-sans font-semibold text-white underline hover:text-emerald-200 shrink-0 cursor-pointer ml-1"
                                        >
                                            View Receipt ↗
                                        </button>
                                    </div>
                                )}

                                {/* Status & Error Alerts */}
                                {statusMessage && (
                                    <div className="p-2.5 px-3.5 rounded-lg bg-white/15 border border-white/30 text-xs font-sans text-white flex items-center gap-2">
                                        <Loader2 size={13} className="animate-spin shrink-0 text-white" />
                                        <span className="truncate">{statusMessage}</span>
                                    </div>
                                )}

                                {errorMessage && (
                                    <div className="p-2.5 px-3.5 rounded-lg bg-white/20 border border-white/40 text-xs font-sans text-white flex items-center gap-2">
                                        <AlertCircle size={13} className="shrink-0 text-white" />
                                        <span className="truncate">{errorMessage}</span>
                                    </div>
                                )}

                                {/* Action Button */}
                                <div>
                                    {!connectedWallet ? (
                                        <button
                                            type="button"
                                            onClick={connectWallet}
                                            className="w-full bg-white hover:bg-white/90 text-black py-3 px-5 rounded-xl text-sm font-sans font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-xl"
                                        >
                                            <Wallet size={15} />
                                            <span>Connect Wallet to Pre-Book</span>
                                            <ArrowRight size={14} />
                                        </button>
                                    ) : !isBaseNetwork ? (
                                        <button
                                            type="button"
                                            onClick={switchToBase}
                                            className="w-full bg-white hover:bg-white/90 text-black py-3 px-5 rounded-xl text-sm font-sans font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-xl"
                                        >
                                            <ArrowRight size={14} />
                                            <span>Switch to Base (8453)</span>
                                        </button>
                                    ) : usdcAllowance < totalAllowanceNeeded ? (
                                        <button
                                            type="button"
                                            onClick={handleApproveUSDC}
                                            disabled={isApproving}
                                            className="w-full bg-white hover:bg-white/90 text-black py-3 px-5 rounded-xl text-sm font-sans font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-xl"
                                        >
                                            {isApproving ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    <span>Approving {totalPrice} USDC...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>Step 1: Approve {totalPrice} USDC</span>
                                                    <ArrowRight size={14} />
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <button
                                            type="submit"
                                            disabled={isPrebooking}
                                            className="w-full bg-white hover:bg-white/90 text-black py-3 px-5 rounded-xl text-sm font-sans font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-xl"
                                        >
                                            {isPrebooking ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    <span>Confirming {quantity} MelodyPay HardWallet{quantity > 1 ? "s" : ""}...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>Step 2: Pre-Book {quantity} MelodyPay HardWallet{quantity > 1 ? "s" : ""} for {totalPrice} USDC</span>
                                                    <ArrowRight size={14} />
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                <p className="text-xs font-sans text-white/60 text-center">
                                    {userExistingQueue !== null 
                                        ? "You can reserve additional MelodyPay HardWallets with this wallet anytime. Instant cryptographic POS receipt generated." 
                                        : "Secures MelodyPay HardWallet priority slot. Instant cryptographic POS receipt generated."}
                                </p>
                            </form>
                        </div>
                    </div>

                    {/* Right Column: Hardware Overview & Benefits (Matching Clean & Lean Card) */}
                    <div className="bg-white/[0.07] backdrop-blur-2xl border border-white/25 rounded-2xl p-5 sm:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.25)] ring-1 ring-white/10 flex flex-col justify-between h-full">
                        <div className="space-y-4">
                            {/* Section 1: Device Specs */}
                            <div>
                                <div className="flex items-center gap-2 pb-2 mb-2.5 border-b border-white/20">
                                    <Cpu size={15} className="text-white" />
                                    <h3 className="text-xs font-mono font-semibold uppercase tracking-[0.18em] text-white">
                                        ESP32-S3 Sound Terminal Specifications
                                    </h3>
                                </div>

                                <ul className="space-y-2 text-xs sm:text-sm font-sans text-white/85 leading-relaxed">
                                    <li className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-white mt-1.5 shrink-0" />
                                        <span><strong className="text-white font-semibold font-sans">Acoustic Wire</strong>: Ultrasonic tones demodulated locally on-chip.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-white mt-1.5 shrink-0" />
                                        <span><strong className="text-white font-semibold font-sans">Zero Radios</strong>: Wi-Fi & Bluetooth permanently disabled at silicon level.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-white mt-1.5 shrink-0" />
                                        <span><strong className="text-white font-semibold font-sans">Tactile Switch</strong>: Physical push-button authorizes every transaction.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-white mt-1.5 shrink-0" />
                                        <span><strong className="text-white font-semibold font-sans">OLED Screen</strong>: SSD1306 high-contrast cryptographic display.</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Section 2: What Your 1 USDC Secures */}
                            <div className="pt-3 border-t border-dashed border-white/20">
                                <div className="flex items-center gap-2 pb-2 mb-2.5 border-b border-white/20">
                                    <ShieldCheck size={15} className="text-white" />
                                    <h3 className="text-xs font-mono font-semibold uppercase tracking-[0.18em] text-white">
                                        What Your 1.00 USDC Secures
                                    </h3>
                                </div>

                                <div className="space-y-2 text-xs font-sans text-white/85">
                                    <div className="flex items-center justify-between pb-1.5 border-b border-dashed border-white/10">
                                        <span className="text-white/70 font-sans">Allocation:</span>
                                        <span className="font-semibold text-white font-sans">Batch #1 Priority MelodyPay HardWallet</span>
                                    </div>
                                    <div className="flex items-center justify-between pb-1.5 border-b border-dashed border-white/10">
                                        <span className="text-white/70 font-sans">Confirmation:</span>
                                        <span className="font-semibold text-white font-sans">Instant Subject: Prebooked</span>
                                    </div>
                                    <div className="flex items-center justify-between pb-1.5 border-b border-dashed border-white/10">
                                        <span className="text-white/70 font-sans">Receipt Proof:</span>
                                        <span className="font-semibold text-white font-sans">Thermal POS On-Chain Slip</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-white/70 font-sans">Settlement:</span>
                                        <span className="font-semibold text-white font-sans">1.00 USDC on Base</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Hardware Micro-Badge for Perfect Vertical Alignment */}
                        <div className="pt-3 mt-3 border-t border-white/15 text-[10px] font-mono text-white/70 flex items-center justify-between tracking-[0.18em] uppercase">
                            <span>HARDWARE TERMINAL V1</span>
                            <span className="text-white font-semibold">AIR-GAP VERIFIED</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
