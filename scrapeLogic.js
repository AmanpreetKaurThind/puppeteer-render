const puppeteer = require("puppeteer");
const fetch = require("cross-fetch");
const { puppeteerRealBrowser } = require("puppeteer-real-browser");
const { DEFAULT_INTERCEPT_RESOLUTION_PRIORITY } = require("puppeteer");
const { PuppeteerBlocker } = require("@cliqz/adblocker-puppeteer");

const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker");
const puppeteerExtra = require("puppeteer-extra");

puppeteerExtra.use(
  AdblockerPlugin({
    interceptResolutionPriority: DEFAULT_INTERCEPT_RESOLUTION_PRIORITY,
  })
);

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

const scrapeLogic = async (res) => {
  try {
    const browser = await puppeteer.launch({
      args: [
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--single-process",
        "--no-zygote",
      ],
      executablePath:
        process.env.NODE_ENV === "production"
          ? process.env.PUPPETEER_EXECUTABLE_PATH
          : puppeteer.executablePath(),
    });

    const id = "YOUR_ID"; // Set your id here or pass it as an argument

    let linkInfo = await (await fetch("https://api-gateway.platoboost.com/v1/authenticators/8/" + id)).json();

    if (linkInfo.key) {
      res.status(200).json(linkInfo.key);
      await browser.close();
      return;
    }

    const { browser: realBrowser, page } = await puppeteerRealBrowser({
      headless: false,
      action: "default",
      executablePath: "default",
    });

    const blocker = await PuppeteerBlocker.fromPrebuiltAdsAndTracking(fetch);
    blocker.enableBlockingInPage(page);

    await page.goto("https://gateway.platoboost.com/a/8?id=" + id);
    await page.waitForXPath("//button[contains(., 'Continue')]");
    const continueButton = await page.$x("//button[contains(., 'Continue')]");
    if (continueButton.length > 0) {
      await continueButton[0].click();
      await wait(5000);
      await page.goto(`https://gateway.platoboost.com/a/8?id=${id}&tk=ui7c`);
      await page.waitForXPath("//button[contains(., 'Continue')]");
      const continueButtonAfterRedirect = await page.$x("//button[contains(., 'Continue')]");
      if (continueButtonAfterRedirect.length > 0) {
        await continueButtonAfterRedirect[0].click();
        await wait(5000);
        linkInfo = await (await fetch("https://api-gateway.platoboost.com/v1/authenticators/8/" + id)).json();
        await realBrowser.close();
        res.status(200).json(linkInfo.key);
        return;
      } else {
        res.status(400).json({ error: "Continue button not found after redirect" });
        await realBrowser.close();
        return;
      }
    } else {
      res.status(400).json({ error: "Continue button not found" });
      await realBrowser.close();
      return;
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send(`Something went wrong while running Puppeteer: ${error}`);
  }
};

module.exports = { scrapeLogic };
