const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Wait for the app to load
  await page.goto('https://hk-digiverse-hub.lovable.app/b2b', { waitUntil: 'networkidle0' });
  
  // Look for any button that might be "Add" or "New"
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('Add') || text.includes('New')) {
      await btn.click();
      await new Promise(r => setTimeout(r, 1000));
      break;
    }
  }
  
  // Extract all labels in the dialog/modal
  const labels = await page.$$eval('dialog label, [role="dialog"] label, form label', els => els.map(el => el.textContent));
  console.log("B2B Form Labels:", labels);
  
  // Same for Franchise
  await page.goto('https://hk-digiverse-hub.lovable.app/franchise', { waitUntil: 'networkidle0' });
  const buttonsF = await page.$$('button');
  for (const btn of buttonsF) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('Add') || text.includes('New')) {
      await btn.click();
      await new Promise(r => setTimeout(r, 1000));
      break;
    }
  }
  const labelsF = await page.$$eval('dialog label, [role="dialog"] label, form label', els => els.map(el => el.textContent));
  console.log("Franchise Form Labels:", labelsF);

  // Same for Collaboration
  await page.goto('https://hk-digiverse-hub.lovable.app/collaboration', { waitUntil: 'networkidle0' });
  const buttonsC = await page.$$('button');
  for (const btn of buttonsC) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('Add') || text.includes('New')) {
      await btn.click();
      await new Promise(r => setTimeout(r, 1000));
      break;
    }
  }
  const labelsC = await page.$$eval('dialog label, [role="dialog"] label, form label', els => els.map(el => el.textContent));
  console.log("Collaboration Form Labels:", labelsC);

  await browser.close();
})();
