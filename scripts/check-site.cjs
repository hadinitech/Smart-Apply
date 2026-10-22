const fs=require('fs');
const vm=require('vm');
const files=fs.readdirSync('.').filter(file=>file.endsWith('.html'));
const issues=[];
for(const file of files){
 const html=fs.readFileSync(file,'utf8');
 for(const [,href] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
  if(/^(https?:|mailto:|tel:|data:|javascript:)/.test(href)||href.includes('${'))continue;
  const [destination,fragment]=href.split('#');
  const target=(destination||file).split('?')[0];
  if(!fs.existsSync(target)){issues.push(`${file}: missing ${href}`);continue;}
  if(fragment&&target.endsWith('.html')&&!fs.readFileSync(target,'utf8').includes(`id="${fragment}"`))issues.push(`${file}: missing anchor ${href}`);
 }
 for(const [,script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script,{filename:file});
}
for(const file of fs.readdirSync('.').filter(file=>file.endsWith('.js')))new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});
const home=fs.readFileSync('index.html','utf8');
for(const old of ['R100','R200','R350','Your journey starts before matric','Need help getting started','One account. Your whole journey.'])if(home.includes(old))issues.push(`Homepage still contains ${old}`);
if((home.match(/<h1\b/g)||[]).length!==1)issues.push('Homepage must have one H1');
const sections=[...home.matchAll(/<section class="([^"]+)"/g)].map(match=>match[1]);
if(sections.join(',')!=='sa-hero,sa-options,sa-discover,sa-aps,sa-assistance,sa-final')issues.push('Unexpected homepage section order: '+sections.join(','));
if(issues.length){console.error(issues.join('\n'));process.exit(1);}
console.log(`Checked ${files.length} pages: local links/assets/anchors, JavaScript syntax, homepage structure and removed pricing OK.`);
