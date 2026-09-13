import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      {
        name: "resend-api-server",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url === "/api/send-email" && req.method === "POST") {
              let body = "";
              req.on("data", (chunk) => {
                body += chunk;
              });
              req.on("end", async () => {
                try {
                  const data = JSON.parse(body);

                  // Robustly extract Brevo and Resend API keys from env or .env files
                  let brevoKey =
                    env.BREVO_API_KEY ||
                    env.VITE_BREVO_API_KEY ||
                    process.env.BREVO_API_KEY ||
                    process.env.VITE_BREVO_API_KEY;

                  let brevoSender =
                    env.BREVO_SENDER_EMAIL ||
                    process.env.BREVO_SENDER_EMAIL ||
                    "tyra191712@gmail.com";

                  let resendKey =
                    env.RESEND_API_KEY ||
                    env.VITE_RESEND_API_KEY ||
                    process.env.RESEND_API_KEY ||
                    process.env.VITE_RESEND_API_KEY;

                  if (!brevoKey || !resendKey) {
                    try {
                      const fs = await import("fs");
                      const path = await import("path");
                      const possiblePaths = [
                        path.resolve(process.cwd(), ".env"),
                        path.resolve(__dirname, ".env"),
                        path.resolve(__dirname, "receiver-web", ".env"),
                      ];
                      for (const p of possiblePaths) {
                        if (fs.existsSync(p)) {
                          const content = fs.readFileSync(p, "utf-8");
                          if (!brevoKey) {
                            const bMatch = content.match(/BREVO_API_KEY=([^\r\n]+)/);
                            if (bMatch) brevoKey = bMatch[1].trim();
                          }
                          if (!resendKey) {
                            const rMatch = content.match(/RESEND_API_KEY=([^\r\n]+)/);
                            if (rMatch) resendKey = rMatch[1].trim();
                          }
                          const sMatch = content.match(/BREVO_SENDER_EMAIL=([^\r\n]+)/);
                          if (sMatch) brevoSender = sMatch[1].trim();
                        }
                      }
                    } catch {}
                  }

                  // Priority 1: Brevo (formerly Sendinblue) - sends to ANY email without custom domain
                  if (brevoKey) {
                    console.log(`[Vite Email Proxy] 📨 Dispatching via Brevo to: ${data.to} (Subject: "Prebooked")`);
                    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
                      method: "POST",
                      headers: {
                        accept: "application/json",
                        "api-key": brevoKey.trim(),
                        "content-type": "application/json",
                      },
                      body: JSON.stringify({
                        sender: { name: "MelodyPay", email: brevoSender.trim() },
                        to: [{ email: data.to }],
                        subject: "Prebooked",
                        htmlContent: data.html,
                      }),
                    });

                    const brevoResult = await brevoRes.json().catch(() => ({}));
                    if (!brevoRes.ok) {
                      const errMessage = brevoResult.message || `Brevo error (${brevoRes.status})`;
                      console.error(`[Vite Email Proxy] ❌ Brevo error (${brevoRes.status}):`, errMessage);
                      res.statusCode = brevoRes.status;
                      res.setHeader("Content-Type", "application/json");
                      res.end(JSON.stringify({ error: errMessage, ...brevoResult }));
                      return;
                    }

                    console.log(`[Vite Email Proxy] ✅ Email delivered via Brevo! MessageId: ${brevoResult.messageId}`);
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ id: brevoResult.messageId, mode: "brevo" }));
                    return;
                  }

                  // Priority 2: Resend
                  if (resendKey) {
                    console.log(`[Vite Email Proxy] 📨 Dispatching via Resend to: ${data.to} (Subject: "Prebooked")`);
                    const resendRes = await fetch("https://api.resend.com/emails", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${resendKey.trim()}`,
                      },
                      body: JSON.stringify({
                        from: "MelodyPay <onboarding@resend.dev>",
                        to: [data.to],
                        subject: "Prebooked",
                        html: data.html,
                      }),
                    });

                    const result = await resendRes.json();

                    if (!resendRes.ok) {
                      const errMessage =
                        result.message ||
                        result.error ||
                        `Resend API error (${resendRes.status})`;
                      console.error(`[Vite Email Proxy] ❌ Resend Failed (${resendRes.status}):`, errMessage);
                      res.statusCode = resendRes.status;
                      res.setHeader("Content-Type", "application/json");
                      res.end(JSON.stringify({ error: errMessage, ...result }));
                      return;
                    }

                    console.log(`[Vite Email Proxy] ✅ Email delivered via Resend! ID: ${result.id}`);
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ ...result, mode: "resend" }));
                    return;
                  }

                  // Fallback: Missing API keys
                  console.error("[Vite Email Proxy] ❌ Missing BREVO_API_KEY or RESEND_API_KEY in environment.");
                  res.statusCode = 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      error: "Missing BREVO_API_KEY or RESEND_API_KEY in .env.",
                      mode: "simulation",
                    })
                  );
                } catch (err: any) {
                  console.error("[Vite Resend Proxy] ❌ Internal Server Error:", err);
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: err.message }));
                }
              });
              return;
            }
            next();
          });
        },
      },
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "MelodyPay",
          short_name: "MelodyPay",
          description: "Sound-based Monad transactions",
          theme_color: "#7c3aed",
          background_color: "#0f0f0f",
          display: "standalone",
          start_url: "/",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,wasm,json,png,ico}"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\./,
              handler: "CacheFirst",
            },
          ],
        },
      }),
    ],
  };
});
