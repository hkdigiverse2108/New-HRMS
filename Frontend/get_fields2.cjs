const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('https://hk-digiverse-hub.lovable.app/b2b', { waitUntil: 'networkidle0' });
  
  // click any button that has text "Add"
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const addBtn = btns.find(b => b.textContent.includes('Add'));
    if(addBtn) addBtn.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  
  const text = await page.evaluate(() => document.body.innerText);
  console.log("=== B2B PAGE BODY AFTER CLICK ===");
  // extract just the lines with 'Cancel' or 'Save' nearby (likely the modal)
  console.log(text.split('\n').filter(l => l.trim().length > 0).slice(-30).join('\n'));
  
  await browser.close();
})();
