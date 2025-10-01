const puppeteer = require("puppeteer");
const { logger } = require("../logger");

const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";

async function launchBrowser() {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: chromePath,
        defaultViewport: null,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-maximized"],
    });
    console.log("Browser launched.");

    const page = await browser.newPage();
    console.log("New page created.");

    // handle popups
    page.on("dialog", async (dialog) => {
        logger.info(`Dialog appeared: ${dialog.message()}`);
        console.log(`Dialog appeared: ${dialog.message()}`);
        await dialog.dismiss();
        console.log("Dialog dismissed.");
    });

    await page.setCacheEnabled(false);
    console.log("Cache disabled.");

    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/116.0 Safari/537.36"
    );
    console.log("User agent set.");

    return { browser, page };
}

module.exports = { launchBrowser };
