// Renders the 1200x630 social preview card (dist/og.png) from the title screen.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(__dirname, '../dist/seal-the-deal.html'));
  await p.addStyleTag({ content: `.howto,.diffs,.fine{display:none!important}.title-card{padding-top:70px;gap:26px}
    .logo-1,.logo-3{font-size:84px!important}.logo-2{font-size:30px!important}.tagline{font-size:16px}
    #boss-title{width:192px;height:208px}.bubble-title{font-size:26px;max-width:380px}` });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(__dirname, '../og.png') });
  await b.close();
})();
