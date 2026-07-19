const puppeteer = require("puppeteer");
const { setTimeout: wait } = require("timers/promises");

(async () => {
  console.log("Conectando al browser existente...");
  const browser = await puppeteer.connect({ browserURL: "http://localhost:9222" });
  const [page] = await browser.pages();

  // EasyPanel login
  console.log("Abriendo EasyPanel...");
  await page.goto("http://35.254.218.190:3000/", { waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});
  await wait(3000);

  // Login
  const url = page.url();
  console.log("Pagina:", url.substring(0, 100));

  if (url.includes("login") || url.includes("auth")) {
    console.log("Logging in...");
    try {
      await page.fill('input[name="email"]', "daveymena16@gmail.com");
      await page.fill('input[name="password"]', "6715320Dvd.");
      await page.click('button[type="submit"]');
      await wait(5000);
      console.log("Login done:", page.url().substring(0, 100));
    } catch (e) {
      console.log("Form fill error:", e.message);
    }
  }

  // Navigate to project
  await page.goto("http://35.254.218.190:3000/projects/tecnology", { waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});
  await wait(3000);
  console.log("Project page:", page.url().substring(0, 100));

  // Look for environment variable settings
  const text = await page.evaluate(() => document.body.innerText).catch(() => "");
  console.log("Page content (first 1000 chars):", text.substring(0, 1000));

  // Keep open for manual interaction
  console.log("\nBrowser is open. If needed, configure env vars manually.");
  console.log("Required env vars for api-server:");
  console.log("FB_APP_ID=4238613976451604");
  console.log("FB_APP_SECRET=93071f6b1afe369e4bea20b5bfa19294");
  console.log("FB_PAGE_ID=1166948726503638");
  console.log("FB_MESSENGER_PAGE_TOKEN=EAA8OZCzhoChQBRx7SJ7RNIBkm7j18uQ4tvFA4EbONkD1fsVGDGAenrzU6JvcZCzj5X30hSfGupl198kGAmhPQjexjGCK3nrkVjRg1SLKYcEafZCWGpZCOrnnLXHaU9fU5YKua5ZCr1m2q4D3Qpf5vZAhEBb3ZCRrychOc7ZCYatYXBd0c42RnIRNBpvvc5RtHMx2pLnS424ZAdWSTuGov6CloEZAGV638ZA6L99faF15lPS6Rbn");

  await wait(60000);
  await browser.disconnect();
})();
