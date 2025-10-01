const puppeteer = require("puppeteer");
const { logger } = require("../logger");

const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";

async function launchBrowser() {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: chromePath,
    defaultViewport: null,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-maximized"],
  });
  const page = await browser.newPage();

  // handle popups
  page.on("dialog", async (dialog) => {
    logger.info(`Dialog appeared: ${dialog.message()}`);
    await dialog.dismiss();
  });

  await page.setCacheEnabled(false);
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/116.0 Safari/537.36"
  );

  return { browser, page };
}

module.exports = { launchBrowser };
