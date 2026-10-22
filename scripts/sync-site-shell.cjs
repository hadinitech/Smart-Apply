// The landing page is the source of truth for the static, shared site shell.
// Run after editing its header or footer; no runtime fetch or JavaScript is needed.
const fs = require('fs');
const home = fs.readFileSync('index.html', 'utf8');
const header = home.match(/<header\b[\s\S]*?<\/header>/)[0]
  .replace(/ class="active" aria-current="page"/g, '');
const footer = home.match(/<footer\b[\s\S]*?<\/footer>/)[0];
for (const file of fs.readdirSync('.').filter(file => file.endsWith('.html'))) {
  let navigation = header.replace(/<a href="([^"]+\.html)">/g, (tag, href) =>
    href === file ? `<a href="${href}" class="active" aria-current="page">` : tag);
  let html = fs.readFileSync(file, 'utf8')
    .replace(/<header\b[\s\S]*?<\/header>/, navigation)
    .replace(/<footer\b[\s\S]*?<\/footer>/, footer);
  if (!html.includes('href="site-shell.css"')) {
    html = html.replace('</head>', '<link rel="stylesheet" href="site-shell.css"></head>');
  }
  if (!html.includes('src="chatbot.js"')) {
    html = html.replace('</body>', '<script src="chatbot.js" defer></script></body>');
  }
  fs.writeFileSync(file, html);
}
console.log('Synchronized landing header and footer across all pages.');
