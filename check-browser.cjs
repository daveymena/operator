const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.connect({ browserURL: "http://localhost:9222" });
  const pages = await browser.pages();
  for (const p of pages) {
    try {
      const url = p.url();
      const title = await p.title();
      console.log("TITLE:", title);
      console.log("URL:", url);

      // Get page content snippet
      const bodyText = await p.evaluate(() => {
        return (document.body ? document.body.innerText : "").substring(0, 2000);
      }).catch(() => "ERROR");

      console.log("CONTENT:");
      console.log(bodyText);
      console.log("---");
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
  browser.disconnect();
})();
