import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Cpu, Loader2, ShieldCheck, Wallet } from "lucide-react";

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
            className="relative isolate min-h-[calc(100vh-5rem)] overflow-hidden px-4 py-12 text-white sm:px-6 lg:px-10 lg:py-16"
        >
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#0d281a]">
                <img src="/image copy 2.png" alt="" className="h-full w-full scale-105 object-cover object-center opacity-70" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-[#0d281a]/35 to-black/70" />
            </div>

            <div className="relative z-10 mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-3xl border border-white/20 bg-white/[0.09] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-8">
                    <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-white/70 transition hover:text-white">
                        <ArrowLeft size={16} /> Back to overview
                    </Link>
                    <div className="mb-8">
                        <p className="mb-3 text-xs font-mono uppercase tracking-[0.2em] text-sky-200">Hardware priority queue</p>
                        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Reserve the sound wallet.</h1>
                        <p className="mt-3 max-w-lg text-sm leading-6 text-white/70">Prebook an ESP32-S3 MelodyPay HardWallet with a direct USDC settlement on Base Mainnet.</p>
                    </div>

                    <div className="mb-6 flex items-center justify-between rounded-2xl border border-white/15 bg-black/20 p-4 text-sm">
                        <div className="flex items-center gap-3">
                            <span className="rounded-full bg-white/10 p-2"><Wallet size={16} /></span>
                            <span>{wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "No wallet connected"}</span>
                        </div>
                        {wallet && <span className={isBase ? "text-emerald-300" : "text-amber-200"}>{isBase ? "Base Mainnet" : "Wrong network"}</span>}
                    </div>

                    <div className="mb-6 rounded-2xl border border-white/15 bg-black/20 p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold">MelodyPay HardWallet V1</p>
                                <p className="mt-1 text-xs text-white/60">1.00 USDC per unit</p>
                            </div>
                            <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 p-1">
                                <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1 || busy} className="h-7 w-7 rounded-lg bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30">-</button>
                                <span className="w-6 text-center font-mono text-sm">{quantity}</span>
                                <button type="button" onClick={() => setQuantity(Math.min(10, quantity + 1))} disabled={quantity >= 10 || busy} className="h-7 w-7 rounded-lg bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30">+</button>
                            </div>
                        </div>
                        <div className="mt-5 flex items-end justify-between border-t border-white/10 pt-4">
                            <span className="text-xs uppercase tracking-wider text-white/50">Total</span>
                            <span className="text-2xl font-semibold">{totalPrice} USDC</span>
                        </div>
                    </div>

                    {error && <p className="mb-4 rounded-xl border border-red-300/30 bg-red-400/15 p-3 text-sm text-red-100">{error}</p>}
                    {status && <p className="mb-4 flex items-center gap-2 rounded-xl border border-sky-300/25 bg-sky-400/15 p-3 text-sm text-sky-100"><Loader2 size={15} className={busy ? "animate-spin" : ""} /> {status}</p>}
                    {txHash && <a className="mb-4 block truncate text-xs text-sky-200 hover:underline" href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noreferrer">View confirmed transaction: {txHash}</a>}

                    {!wallet ? (
                        <button type="button" onClick={connectWallet} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 text-sm font-semibold text-[#111113] transition hover:bg-sky-50"><Wallet size={17} /> Connect wallet</button>
                    ) : !isBase ? (
                        <button type="button" onClick={switchToBase} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 text-sm font-semibold text-[#111113] transition hover:bg-sky-50">Switch to Base <ArrowRight size={17} /></button>
                    ) : (
                        <button type="button" onClick={handlePrebook} disabled={busy || !contractAddress} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 text-sm font-semibold text-[#111113] transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50">
                            {busy ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
                            {contractAddress ? `Prebook for ${totalPrice} USDC` : "Contract address missing"}
                        </button>
                    )}
                    <p className="mt-4 text-center text-xs text-white/45">Email notifications are disabled. Your transaction hash is the confirmation.</p>
                </section>

                <aside className="rounded-3xl border border-white/20 bg-[#071c17]/90 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-8">
                    <div className="mb-8 flex items-center gap-3 border-b border-white/15 pb-5"><Cpu size={18} className="text-sky-200" /><span className="text-xs font-mono uppercase tracking-[0.18em] text-white/75">Terminal allocation</span></div>
                    <div className="space-y-5 text-sm text-white/75">
                        <div className="flex items-start gap-3"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-300" /><span>Direct USDC settlement on Base Mainnet.</span></div>
                        <div className="flex items-start gap-3"><Cpu size={18} className="mt-0.5 shrink-0 text-sky-300" /><span>ESP32-S3 hardware with physical transaction approval.</span></div>
                        <div className="flex items-start gap-3"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-300" /><span>No email dependency. The on-chain receipt is authoritative.</span></div>
                    </div>
                    <div className="mt-10 rounded-2xl border border-white/15 bg-black/25 p-4 font-mono text-xs text-white/65">
                        <div className="flex justify-between"><span>QUEUE</span><span className="text-white">{queueCount === null ? "--" : `#${String(queueCount + 1).padStart(3, "0")}`}</span></div>
                        <div className="mt-3 flex justify-between"><span>YOUR UNITS</span><span className="text-white">{units || "--"}</span></div>
                        <div className="mt-3 flex justify-between"><span>USDC BALANCE</span><span className="text-white">{balance}</span></div>
                        <div className="mt-3 flex justify-between"><span>CONTRACT</span><span className="text-emerald-300">{contractAddress ? "CONFIGURED" : "MISSING"}</span></div>
                    </div>
                </aside>
            </div>
        </motion.div>
    );
}
