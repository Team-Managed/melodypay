import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Cpu, Loader2, Radio, ShieldCheck, Wallet } from "lucide-react";
import type { ReceiptData } from "./PaymentReceipt";

const BASE_CHAIN_ID = 8453;
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PREBOOKING_ABI = [
    "function prebook(uint256 quantity) external returns (uint256 startQueueNumber)",
    "function getQueueCount() external view returns (uint256)",
    "function getUserQueue(address user) external view returns (uint256)",
    "function getUserUnits(address user) external view returns (uint256)",
];
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
];

function configuredContractAddress() {
    try {
        const rawAddress = import.meta.env.VITE_PREBOOKING_CONTRACT_ADDRESS;
        return rawAddress ? ethers.getAddress(rawAddress) : "";
    } catch {
        return "";
    }
}

export function Register() {
    const navigate = useNavigate();
    const [wallet, setWallet] = useState("");
    const [chainId, setChainId] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [queueCount, setQueueCount] = useState<number | null>(null);
    const [units, setUnits] = useState(0);
    const [balance, setBalance] = useState("0.00");
    const [allowance, setAllowance] = useState(0n);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");
    const [txHash, setTxHash] = useState("");
    const [busy, setBusy] = useState(false);

    const contractAddress = configuredContractAddress();
    const totalUnits = BigInt(quantity) * 1_000_000n;
    const totalPrice = quantity.toFixed(2);
    const isBase = chainId === BASE_CHAIN_ID;

    async function refreshWalletState(provider: ethers.BrowserProvider, address: string) {
        const network = await provider.getNetwork();
        const activeChainId = Number(network.chainId);
        setChainId(activeChainId);

        if (activeChainId !== BASE_CHAIN_ID) return;

        const usdc = new ethers.Contract(BASE_USDC, ERC20_ABI, provider);
        const [usdcBalance, currentAllowance] = await Promise.all([
            usdc.balanceOf(address),
            contractAddress ? usdc.allowance(address, contractAddress) : 0n,
        ]);
        setBalance(ethers.formatUnits(usdcBalance, 6));
        setAllowance(currentAllowance);

        if (!contractAddress) return;

        const contract = new ethers.Contract(contractAddress, PREBOOKING_ABI, provider);
        const [count, userQueue, userUnits] = await Promise.all([
            contract.getQueueCount(),
            contract.getUserQueue(address).catch(() => 0n),
            contract.getUserUnits(address).catch(() => 0n),
        ]);
        setQueueCount(Number(count));
        setUnits(Number(userQueue) > 0 ? Number(userUnits) : 0);
    }

    async function connectWallet() {
        setError("");
        const ethereum = (window as any).ethereum;
        if (!ethereum) {
            setError("No browser wallet found. Install MetaMask or Coinbase Wallet to continue.");
            return;
        }

        try {
            const provider = new ethers.BrowserProvider(ethereum);
            const accounts = await provider.send("eth_requestAccounts", []);
            const address = accounts[0];
            if (!address) return;
            setWallet(address);
            await refreshWalletState(provider, address);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Wallet connection failed.");
        }
    }

    async function switchToBase() {
        const ethereum = (window as any).ethereum;
        if (!ethereum) return;

        try {
            await ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: "0x2105" }],
            });
        } catch (err: any) {
            if (err?.code !== 4902) {
                setError(err instanceof Error ? err.message : "Could not switch to Base Mainnet.");
                return;
            }

            await ethereum.request({
                method: "wallet_addEthereumChain",
                params: [{
                    chainId: "0x2105",
                    chainName: "Base",
                    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                    rpcUrls: ["https://mainnet.base.org"],
                    blockExplorerUrls: ["https://basescan.org"],
                }],
            });
        }
    }

    async function handlePrebook() {
        setError("");
        setTxHash("");

        if (!wallet) {
            await connectWallet();
            return;
        }
        if (!isBase) {
            await switchToBase();
            return;
        }
        if (!contractAddress) {
            setError("The prebooking contract address is not configured.");
            return;
        }

        const ethereum = (window as any).ethereum;
        if (!ethereum) {
            setError("No browser wallet found.");
            return;
        }

        setBusy(true);
        try {
            const provider = new ethers.BrowserProvider(ethereum);
            const signer = await provider.getSigner();
            const usdc = new ethers.Contract(BASE_USDC, ERC20_ABI, signer);
            const currentBalance = await usdc.balanceOf(wallet);

            if (currentBalance < totalUnits) {
                throw new Error(`Insufficient USDC. ${totalPrice} USDC is required.`);
            }

            let currentAllowance = await usdc.allowance(wallet, contractAddress);
            if (currentAllowance < totalUnits) {
                setStatus(`Approve ${totalPrice} USDC in your wallet...`);
                const approval = await usdc.approve(contractAddress, totalUnits);
                await approval.wait(1);
                currentAllowance = totalUnits;
                setAllowance(currentAllowance);
            }

            setStatus(`Confirm ${quantity} hardware unit${quantity > 1 ? "s" : ""} in your wallet...`);
            const contract = new ethers.Contract(contractAddress, PREBOOKING_ABI, signer);
            const transaction = await contract.prebook(quantity);
            setStatus("Waiting for Base Mainnet confirmation...");
            const receipt = await transaction.wait(1);
            setTxHash(receipt.hash);
            setStatus("Prebooking confirmed on Base Mainnet.");
            await refreshWalletState(provider, wallet);
            const receiptData: ReceiptData = {
                type: "prebooking",
                amount: totalPrice,
                token: "USDC",
                recipient: contractAddress,
                txHash: receipt.hash,
                payer: wallet,
                chainId: BASE_CHAIN_ID,
                networkName: "Base Mainnet",
                timestamp: new Date().toISOString(),
                receiptId: `PREBOOK-BASE-${Date.now().toString().slice(-6)}`,
                quantity,
            };
            localStorage.setItem("melodypay_last_receipt", JSON.stringify(receiptData));
            navigate("/receipt", { state: receiptData });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Prebooking failed.");
            setStatus("");
        } finally {
            setBusy(false);
        }
    }

    useEffect(() => {
        const ethereum = (window as any).ethereum;
        if (!ethereum) return;

        const handleAccountsChanged = (accounts: string[]) => {
            if (!accounts[0]) {
                setWallet("");
                setChainId(0);
                return;
            }
            setWallet(accounts[0]);
            const provider = new ethers.BrowserProvider(ethereum);
            refreshWalletState(provider, accounts[0]).catch(() => undefined);
        };
        const handleChainChanged = () => window.location.reload();

        ethereum.on?.("accountsChanged", handleAccountsChanged);
        ethereum.on?.("chainChanged", handleChainChanged);
        return () => {
            ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
            ethereum.removeListener?.("chainChanged", handleChainChanged);
        };
    }, [contractAddress]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative isolate flex min-h-screen w-full flex-col overflow-hidden px-4 pb-10 pt-28 text-white sm:px-6 sm:pt-32 lg:px-10 lg:pb-12 lg:pt-28"
        >
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#0d281a]">
                <img src="/image copy 2.png" alt="" className="h-full w-full scale-105 object-cover object-center opacity-70" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-[#0d281a]/35 to-black/70" />
                <div className="absolute inset-0 bg-[#0d281a]/15 backdrop-blur-[0.5px]" />
            </div>

            <div className="relative z-10 mx-auto flex w-full max-w-[1380px] flex-1 flex-col justify-center">
                <div className="mx-auto mb-6 max-w-3xl text-center lg:mb-7">
                    <span className="mb-2 block text-[11px] font-mono font-semibold uppercase tracking-[0.22em] text-sky-200 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">// PRIORITY HARDWARE WAITLIST</span>
                    <h1 className="text-3xl font-bold leading-[1.12] tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)] sm:text-4xl lg:text-5xl">
                        Pre-Book Your Sound Wallet.<br />
                        <span className="font-normal text-white/85">Sign offline. Settle on Base.</span>
                    </h1>
                    <p className="mx-auto mt-2.5 max-w-xl text-sm leading-relaxed text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] sm:text-base">
                        Secure first-batch hardware allocation for the ESP32-S3 Air-Gapped Acoustic Sound Terminal. Pay 1.00 USDC on Base to confirm your MelodyPay HardWallet pre-order.
                    </p>
                </div>

                <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2 lg:gap-7 lg:max-h-[560px]">
                    <section className="flex h-full flex-col justify-between rounded-2xl border border-white/25 bg-white/[0.07] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] ring-1 ring-white/10 backdrop-blur-2xl sm:p-6">
                        <div>
                            <Link to="/" className="mb-4 inline-flex items-center gap-2 text-xs text-white/65 transition hover:text-white"><ArrowLeft size={14} /> Back to overview</Link>
                            <div className="mb-4 flex items-center justify-between rounded-xl border border-white/20 bg-white/[0.08] p-2.5 px-3.5 text-xs backdrop-blur-md">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-white"><Wallet size={12} /></div>
                                    <span className="font-semibold text-white">{wallet ? "Wallet Active" : "No Wallet Connected"}</span>
                                    {wallet && <span className="hidden font-mono text-[11px] text-white/70 sm:inline">({wallet.slice(0, 6)}...{wallet.slice(-4)})</span>}
                                </div>
                                {wallet ? (
                                    <span className={isBase ? "text-emerald-300" : "text-amber-200"}>{isBase ? "BASE MAINNET" : "SWITCH NETWORK"}</span>
                                ) : (
                                    <button type="button" onClick={connectWallet} className="rounded-md bg-white px-3 py-1.5 font-semibold text-[#111113] shadow-sm transition hover:bg-white/90">Connect</button>
                                )}
                            </div>

                            <div className="mb-4 flex items-center justify-between rounded-xl border border-white/20 bg-white/[0.08] p-3 px-4 backdrop-blur-md">
                                <div>
                                    <span className="block text-xs font-semibold text-white">ESP32-S3 MelodyPay HardWallet Units</span>
                                    <span className="mt-1 block text-[11px] text-white/70">1.00 USDC per HardWallet // Direct Settlement</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center rounded-lg border border-white/20 bg-white/10 p-0.5">
                                        <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1 || busy} className="h-6 w-6 rounded-md bg-white/20 text-xs font-bold text-white transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-30">-</button>
                                        <span className="w-7 text-center font-mono text-xs font-bold text-white">{quantity}</span>
                                        <button type="button" onClick={() => setQuantity(Math.min(10, quantity + 1))} disabled={quantity >= 10 || busy} className="h-6 w-6 rounded-md bg-white/20 text-xs font-bold text-white transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-30">+</button>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-4 flex items-center justify-between border-b border-white/20 pb-3">
                                <div className="flex items-center gap-2 text-xs text-white/65"><Radio size={14} className="text-sky-200" /> Hardware reservation</div>
                                <div className="text-right"><span className="block text-lg font-bold leading-tight text-white">{totalPrice} USDC</span><span className="block text-[9px] font-mono uppercase tracking-wider text-white/60">Base Mainnet</span></div>
                            </div>

                            <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl border border-white/15 bg-black/20 p-3 font-mono text-[10px] uppercase tracking-wider text-white/55">
                                <div><span className="block">Queue</span><strong className="mt-1 block text-sm text-white">{queueCount === null ? "--" : `#${String(queueCount + 1).padStart(3, "0")}`}</strong></div>
                                <div><span className="block">USDC balance</span><strong className="mt-1 block text-sm text-white">{balance}</strong></div>
                                <div><span className="block">Approval</span><strong className="mt-1 block text-sm text-emerald-300">{allowance >= totalUnits ? "READY" : "REQUIRED"}</strong></div>
                            </div>

                            {units > 0 && <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-400/35 bg-emerald-500/20 p-2.5 px-3.5 text-xs text-white"><span><CheckCircle2 size={13} className="mr-1.5 inline text-emerald-300" />Active allocation: {units} unit{units > 1 ? "s" : ""}</span><span className="font-mono text-emerald-200">ON-CHAIN</span></div>}
                            {status && <div className="mb-4 flex items-center gap-2 rounded-lg border border-white/30 bg-white/15 p-2.5 px-3.5 text-xs text-white"><Loader2 size={13} className={busy ? "animate-spin" : ""} /> <span className="truncate">{status}</span></div>}
                            {error && <div className="mb-4 rounded-lg border border-red-300/40 bg-red-400/20 p-2.5 px-3.5 text-xs text-red-100">{error}</div>}
                        </div>

                        <div>
                            {txHash && <a className="mb-3 block truncate text-xs text-sky-200 hover:underline" href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noreferrer">View confirmed transaction: {txHash}</a>}
                            {!wallet ? (
                                <button type="button" onClick={connectWallet} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#111113] shadow-lg transition hover:bg-white/90"><Wallet size={15} /> Connect Wallet to Pre-Book <ArrowRight size={14} /></button>
                            ) : !isBase ? (
                                <button type="button" onClick={switchToBase} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#111113] shadow-lg transition hover:bg-white/90">Switch to Base (8453) <ArrowRight size={14} /></button>
                            ) : (
                                <button type="button" onClick={handlePrebook} disabled={busy || !contractAddress} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#111113] shadow-lg transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50">
                                    {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                    {contractAddress ? `Pre-Book ${quantity} HardWallet${quantity > 1 ? "s" : ""} for ${totalPrice} USDC` : "Contract address missing"}
                                </button>
                            )}
                            <p className="mt-3 text-center text-[11px] text-white/55">Email notifications are disabled. Your transaction hash is the confirmation.</p>
                        </div>
                    </section>

                    <aside className="flex h-full flex-col justify-between rounded-2xl border border-white/25 bg-white/[0.07] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] ring-1 ring-white/10 backdrop-blur-2xl sm:p-6">
                        <div className="space-y-5">
                            <div className="flex items-center gap-2 border-b border-white/20 pb-2.5"><Cpu size={15} className="text-white" /><h2 className="text-xs font-mono font-semibold uppercase tracking-[0.18em] text-white">ESP32-S3 Sound Terminal Specifications</h2></div>
                            <ul className="space-y-2 text-xs leading-relaxed text-white/85 sm:text-sm">
                                <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white" /><span><strong className="font-semibold text-white">Acoustic Wire</strong>: Ultrasonic tones demodulated locally on-chip.</span></li>
                                <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white" /><span><strong className="font-semibold text-white">Zero Radios</strong>: Wi-Fi and Bluetooth remain disabled at the silicon boundary.</span></li>
                                <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white" /><span><strong className="font-semibold text-white">Tactile Switch</strong>: Physical push-button authorizes every transaction.</span></li>
                                <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white" /><span><strong className="font-semibold text-white">OLED Screen</strong>: SSD1306 high-contrast cryptographic display.</span></li>
                            </ul>

                            <div className="border-t border-dashed border-white/20 pt-4">
                                <div className="mb-3 flex items-center gap-2 border-b border-white/20 pb-2.5"><ShieldCheck size={15} className="text-white" /><h2 className="text-xs font-mono font-semibold uppercase tracking-[0.18em] text-white">What Your 1.00 USDC Secures</h2></div>
                                <div className="space-y-2 text-xs text-white/85">
                                    <div className="flex items-center justify-between border-b border-dashed border-white/10 pb-1.5"><span className="text-white/65">Allocation:</span><span className="text-right font-semibold text-white">Batch #1 Priority HardWallet</span></div>
                                    <div className="flex items-center justify-between border-b border-dashed border-white/10 pb-1.5"><span className="text-white/65">Confirmation:</span><span className="font-semibold text-emerald-200">On-chain transaction</span></div>
                                    <div className="flex items-center justify-between border-b border-dashed border-white/10 pb-1.5"><span className="text-white/65">Receipt Proof:</span><span className="font-semibold text-white">BaseScan transaction</span></div>
                                    <div className="flex items-center justify-between"><span className="text-white/65">Settlement:</span><span className="font-semibold text-white">USDC on Base</span></div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex items-center justify-between border-t border-white/15 pt-3 text-[10px] font-mono uppercase tracking-[0.18em] text-white/60"><span>HARDWARE TERMINAL V1</span><span className="font-semibold text-emerald-300">AIR-GAP VERIFIED</span></div>
                    </aside>
                </div>
            </div>
        </motion.div>
    );
}
