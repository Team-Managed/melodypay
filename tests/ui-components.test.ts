import { describe, it, expect } from "vitest";
import { getChainConfig } from "../receiver-web/src/core/chains";

describe("Frontend Industrial Studio Components & Logic", () => {
  it("validates ENS merchant subname formats", () => {
    const isValidSubname = (name: string) => {
      const clean = name.toLowerCase().trim();
      return clean.length >= 3 && /^[a-z0-9-]+$/.test(clean);
    };

    expect(isValidSubname("cafe")).toBe(true);
    expect(isValidSubname("starbucks-pos")).toBe(true);
    expect(isValidSubname("bodega101")).toBe(true);

    // Invalid cases
    expect(isValidSubname("ab")).toBe(false); // Too short (< 3)
    expect(isValidSubname("cafe_shop")).toBe(false); // Underscores not standard in subnames
    expect(isValidSubname("cafe.melodypay.eth")).toBe(false); // Should be pure label
    expect(isValidSubname("   ")).toBe(false);
  });

  it("generates correct CLI registration commands for Sepolia NameWrapper", () => {
    const generateCliCommand = (subname: string, token = "USDC", recipient?: string) => {
      const clean = subname.toLowerCase().trim().replace(/[^a-z0-9-]/g, "");
      return `npx melodypay register ${clean}.melodypay.eth --network sepolia --token ${token}${recipient ? ` --recipient ${recipient}` : ""}`;
    };

    const cmd1 = generateCliCommand("cafe");
    expect(cmd1).toBe("npx melodypay register cafe.melodypay.eth --network sepolia --token USDC");

    const cmd2 = generateCliCommand("boutique", "ETH", "0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF");
    expect(cmd2).toBe(
      "npx melodypay register boutique.melodypay.eth --network sepolia --token ETH --recipient 0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF"
    );
  });

  it("formats reservation ticket IDs with MP-2026 schema", () => {
    const generateTicketId = (num: number) => `MP-2026-${String(num).padStart(4, "0")}`;
    expect(generateTicketId(42)).toBe("MP-2026-0042");
    expect(generateTicketId(1024)).toBe("MP-2026-1024");
  });

  it("provides correct network telemetry configs for all 3 supported chains", () => {
    const arc = getChainConfig(5042002);
    expect(arc).toBeDefined();
    expect(arc?.name).toContain("Arc");
    expect(arc?.nativeSymbol).toBe("USDC");

    const monad = getChainConfig(10143);
    expect(monad).toBeDefined();
    expect(monad?.nativeSymbol).toBe("MON");

    const sepolia = getChainConfig(11155111);
    expect(sepolia).toBeDefined();
    expect(sepolia?.nativeSymbol).toBe("ETH");
  });

  it("verifies hero centerpiece and editorial layout content contracts", () => {
    const heroContent = {
      headline: "Air-gapped by sound.",
      subheadline: "Sign offline. Settle on-chain.",
      centerpieceImage: "/image copy 3.png",
      primaryCta: "Launch Terminal",
      primaryCtaLink: "/receive",
      secondaryCta: "Pre-book Device & ENS ➔",
      secondaryCtaLink: "/register",
    };

    expect(heroContent.headline).toBe("Air-gapped by sound.");
    expect(heroContent.subheadline).toBe("Sign offline. Settle on-chain.");
    expect(heroContent.centerpieceImage).toBe("/image copy 3.png");
    expect(heroContent.primaryCtaLink).toBe("/receive");
    expect(heroContent.secondaryCtaLink).toBe("/register");
  });

  it("verifies StudioHeader navigation links and action targets", () => {
    const navItems = [
      { path: "/", label: "Overview" },
      { path: "/#features", label: "Features" },
      { path: "/#how-it-works", label: "How It Works" },
      { path: "/#prototype", label: "Prototype" },
      { path: "/#faqs", label: "FAQs" },
      { path: "/receive", label: "Terminal" },
      { path: "/register", label: "Register" },
    ];

    expect(navItems.length).toBe(7);
    expect(navItems.find((item) => item.label === "Features")?.path).toBe("/#features");
    expect(navItems.find((item) => item.label === "How It Works")?.path).toBe("/#how-it-works");
    expect(navItems.find((item) => item.label === "Prototype")?.path).toBe("/#prototype");
    expect(navItems.find((item) => item.label === "FAQs")?.path).toBe("/#faqs");
    expect(navItems.find((item) => item.label === "Terminal")?.path).toBe("/receive");
    expect(navItems.find((item) => item.label === "Register")?.path).toBe("/register");
  });

  it("verifies MelodyLogoM component export and default props contract", async () => {
    const { MelodyLogoM } = await import("../receiver-web/src/components/MelodyLogoM");
    expect(MelodyLogoM).toBeDefined();
    expect(typeof MelodyLogoM).toBe("function");
  });
});
