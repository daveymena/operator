const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { setTimeout: wait } = require("timers/promises");

const APP_ID = "4238613976451604";
const REDIRECT_URI = "https://developers.facebook.com/tools/explorer/callback";
const SCOPES = "pages_show_list,pages_messaging,pages_read_engagement";
const PROFILE = path.join(__dirname, ".fb-profile");

(async () => {
  console.log("=".repeat(60));
  console.log("FACEBOOK PAGE ACCESS TOKEN");
  console.log("=".repeat(60));
  console.log("");
  console.log("OPTION 1: Paste an existing token");
  console.log("OPTION 2: Auto-generate via browser");
  console.log("");
  console.log("Enter a token to use it directly, or press Enter to open browser:");

  const manual = await new Promise((resolve) => {
    const rl = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("> ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  if (manual) {
    fs.writeFileSync(path.join(__dirname, "page_token.txt"), manual, "utf-8");
    console.log("\n[OK] Token saved to page_token.txt");
    console.log("\nNow you can set it in .env:");
    console.log(`FB_MESSENGER_PAGE_TOKEN=${manual.substring(0, 30)}...`);
    process.exit(0);
  }

  console.log("\nOpening browser with saved profile...");

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    userDataDir: PROFILE,
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();

  // Check if logged in
  await page.goto("https://www.facebook.com/", { waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});
  await wait(3000);

  const loggedIn = !page.url().includes("login");
  console.log("Facebook logged in:", loggedIn);
  if (!loggedIn) {
    console.log("Not logged in. Please log in, then press Enter in this terminal...");
    // Wait for user to press Enter
    await new Promise(resolve => {
      process.stdin.once("data", resolve);
    });
  }

  // Go to OAuth dialog
  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${SCOPES}&response_type=token,granted_scopes&auth_type=rerequest`;
  console.log("\nOpening OAuth dialog...");
  await page.goto(authUrl, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});

  // Monitor for token
  for (let i = 0; i < 300; i++) {
    await wait(2000);

    const pages = await browser.pages();
    for (const p of pages) {
      try {
        const url = p.url();
        const match = url.match(/access_token=([^&]+)/);
        if (match) {
          const token = match[1];
          console.log("\n" + "=".repeat(60));
          console.log("PAGE ACCESS TOKEN");
          console.log("=".repeat(60));
          console.log(token);
          console.log("=".repeat(60));
          fs.writeFileSync(path.join(__dirname, "page_token.txt"), token, "utf-8");
          console.log("[OK] Saved to page_token.txt\n");
          await browser.close();
          process.exit(0);
        }

        // Also check via evaluate (hash fragment)
        const hashToken = await p.evaluate(() => {
          const h = window.location.hash;
          const m = h.match(/access_token=([^&]+)/);
          return m ? m[1] : null;
        }).catch(() => null);
        if (hashToken) {
          console.log("\n" + "=".repeat(60));
          console.log("PAGE ACCESS TOKEN (from hash)");
          console.log("=".repeat(60));
          console.log(hashToken);
          console.log("=".repeat(60));
          fs.writeFileSync(path.join(__dirname, "page_token.txt"), hashToken, "utf-8");
          await browser.close();
          process.exit(0);
        }
      } catch {}
    }

    const url = page.url();
    if (url.includes("login")) {
      console.log(`[${(i+1)*2}s] Login page - log in...`);
    } else if (url.includes("two_step") || url.includes("checkpoint")) {
      console.log(`[${(i+1)*2}s] 2FA - enter code...`);
    } else if (url.includes("dialog") || url.includes("confirm")) {
      console.log(`[${(i+1)*2}s] Permissions - click Continue...`);
      // Auto-click
      try {
        const btns = await page.$$("button, div[role='button']");
        for (const btn of btns) {
          const txt = await page.evaluate(el => (el.textContent || "").toLowerCase().trim(), btn);
          if (txt.includes("continuar") || txt.includes("continue")) {
            await btn.click();
            console.log("  -> Auto-clicked Continue");
            break;
          }
        }
      } catch {}
    } else if (url.includes("developers.facebook.com") || url.includes("access_token")) {
      console.log(`[${(i+1)*2}s] Redirected - checking for token...`);
    } else {
      console.log(`[${(i+1)*2}s] ${url.substring(0, 100)}`);
    }
  }

  console.log("\n[!] Timed out. The browser will stay open. Press Ctrl+C to close.");
  await wait(99999999);
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
