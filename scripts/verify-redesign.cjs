const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const {spawn} = require('child_process');
const root = process.cwd();
const requested = process.argv.slice(2);
const pages = fs.readdirSync(root).filter(f => f.endsWith('.html') && (!requested.length || requested.includes(f)));
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1], {filename:page});
  if (!html.includes('design-system.css') || !html.includes('site-ui.js')) throw Error('Missing shared system: ' + page);
}
new vm.Script(fs.readFileSync('site-ui.js','utf8'));
const server = http.createServer((req,res) => {
  const name = decodeURIComponent(req.url.split('?')[0]);
  const target = path.join(root, name === '/' ? 'index.html' : name);
  if (!target.startsWith(root) || !fs.existsSync(target)) {res.writeHead(404);res.end();return;}
  const type = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.mjs':'text/javascript'}[path.extname(target)] || 'application/octet-stream';
  res.setHeader('Content-Type',type);res.end(fs.readFileSync(target));
});
const sleep = ms => new Promise(r => setTimeout(r,ms));
(async () => {
  await new Promise(r => server.listen(4173,'127.0.0.1',r));
  fs.mkdirSync('.qa',{recursive:true});
  const browser = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--no-first-run','--no-default-browser-check','--disable-gpu','--remote-debugging-port=9223',`--user-data-dir=${path.join(root,'.qa','chrome-profile')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
  let ws;
  try {
    let targets;
    for (let i=0;i<40;i++) {try {targets = await (await fetch('http://127.0.0.1:9223/json')).json();break;} catch {await sleep(250);}}
    if (!targets) throw Error('Browser debugging unavailable');
    ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open',r,{once:true}));
    let id=0; const pending = new Map();
    ws.addEventListener('message',e => {const msg=JSON.parse(e.data);if(pending.has(msg.id)){pending.get(msg.id)(msg);pending.delete(msg.id);}});
    const call=(method,params={}) => new Promise((resolve,reject) => {const key=++id;pending.set(key,msg=>msg.error?reject(Error(JSON.stringify(msg.error))):resolve(msg.result));ws.send(JSON.stringify({id:key,method,params}));});
    const evaluate = async expression => {const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
    await call('Page.enable');
    await call('Runtime.enable');
    const report=[];
    for (const width of [1440,390,768,1024]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<680});
      for (const page of pages) {
        await call('Page.navigate',{url:`http://127.0.0.1:4173/${page}`});
        await sleep(550);
        await evaluate('Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,3000))]).then(()=>Promise.all([...document.images].map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r})))).then(()=>true)');
        const state=await evaluate(`({page:location.pathname,width:innerWidth,scroll:document.documentElement.scrollWidth,nav:document.querySelector('header').getBoundingClientRect().width,cards:document.querySelectorAll('.inst-card').length,broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)})`);
        if(state.scroll>width+1) throw Error('Horizontal overflow '+JSON.stringify(state));
        if(state.broken.length) throw Error('Broken images '+JSON.stringify(state));
        const hasDash=await evaluate(`/[\\p{Pd}\\u2212]/u.test(document.body.innerText)`);
        if(hasDash)throw Error('Visible copy still contains a dash on '+page);
        if(page==='index.html' || (width===390 && ['documents.html','institutions.html','howitworks.html'].includes(page))) {
          const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
          fs.writeFileSync(`.qa/${page.replace('.html','')}-${width}.png`,Buffer.from(shot.data,'base64'));
        }
        if(width===390){
          const menu=await evaluate(`(()=>{const b=document.querySelector('.burger,.menu');b.click();const open=b.getAttribute('aria-expanded')==='true'&&getComputedStyle(document.querySelector('.nav-links')).display!=='none';b.click();return open;})()`);
          if(!menu) throw Error('Menu failed '+page);
        }
        if(page==='institutions.html') {
          const filtering = await evaluate(`(()=>{const input=document.getElementById('searchInput');input.value='Cape Town';input.dispatchEvent(new Event('input'));return {count:document.querySelectorAll('.inst-card').length,text:document.getElementById('instGrid').textContent};})()`);
          if(!filtering.count || !filtering.text.includes('Cape Town')) throw Error('Search failed');
          const modal=await evaluate(`(()=>{document.querySelector('.inst-actions button').click();return document.getElementById('modalOverlay').classList.contains('open');})()`);
          if(!modal)throw Error('Modal failed');
          await evaluate(`document.getElementById('modalClose').click()`);
          await call('Page.navigate',{url:'http://127.0.0.1:4173/institutions.html?q=Johannesburg&sort=closing&status=closing-soon'});
          await sleep(550);
          const deepLink=await evaluate(`({query:document.getElementById('searchInput').value,sort:document.getElementById('filterSort').value,status:document.getElementById('filterStatus').value,text:document.getElementById('instGrid').textContent})`);
          if(deepLink.query!=='Johannesburg'||deepLink.sort!=='closing'||deepLink.status!=='closing-soon')throw Error('Directory deep-link controls failed');
        }
        if(page==='documents.html') {
          const progress=await evaluate(`(()=>{const c=document.querySelector('[data-document]');c.checked=false;c.dispatchEvent(new Event('change'));c.click();return document.getElementById('document-count').textContent;})()`);
          if(!progress.startsWith('1 of'))throw Error('Document progress failed '+progress);
          await evaluate(`localStorage.removeItem('smartapply-documents')`);
        }
        if(page==='faq.html') {
          const faq=await evaluate(`(()=>{const q=document.querySelector('.faq-q');const before=q.closest('.faq-item').classList.contains('open');q.click();const after=q.closest('.faq-item').classList.contains('open');return before!==after&&q.getAttribute('aria-expanded')===String(after);})()`);
          if(!faq)throw Error('FAQ failed '+page);
        }
        if(page==='index.html') {
          const headings=await evaluate(`document.querySelectorAll('h1').length`);
          if(headings!==1)throw Error('Homepage needs exactly one H1');
          const dimensions=await evaluate(`({hero:document.querySelector('.sa-hero').getBoundingClientRect().height,discover:document.querySelector('.sa-discover').getBoundingClientRect().height,viewport:innerHeight,header:document.querySelector('header').getBoundingClientRect().height})`);
          if(Math.abs(dimensions.hero-dimensions.viewport)>2||Math.abs(dimensions.discover-dimensions.viewport)>2)throw Error('Viewport sections failed '+JSON.stringify(dimensions));
          if(dimensions.header>65)throw Error('Header is too tall '+dimensions.header);
          const aps=await evaluate(`(()=>{document.querySelector('[data-aps-mode="manual"]').click();const subjects=['english','afrikaans','mathematics','life-sciences','physical-sciences','accounting'];document.querySelectorAll('.aps-subject-row').forEach((row,index)=>{row.querySelector('select').value=subjects[index];row.querySelector('input').value='80';});document.getElementById('aps-form').requestSubmit();return document.getElementById('aps-score').value;})()`);
          if(String(aps)!=='42')throw Error('APS maximum failed '+aps);
          const panelFixed=await evaluate(`(()=>{const before=document.querySelector('.sa-aps-result').getBoundingClientRect();document.getElementById('aps-add-subject').click();const after=document.querySelector('.sa-aps-result').getBoundingClientRect();const last=document.querySelector('.aps-subject-rows').lastElementChild;last.querySelector('select').value='geography';last.querySelector('input').value=90;document.getElementById('aps-form').requestSubmit();return Math.abs(before.x-after.x)<1&&Math.abs(before.y-after.y)<1&&document.getElementById('aps-score').value==='42';})()`);
          if(!panelFixed)throw Error('APS result panel moved when adding a subject');
          const invalid=await evaluate(`(()=>{const i=document.querySelector('.aps-subject-mark');i.value='101';document.getElementById('aps-form').dispatchEvent(new Event('submit',{cancelable:true}));return document.getElementById('aps-error').textContent;})()`);
          if(!invalid.includes('0 to 100'))throw Error('APS validation failed');
          const duplicate=await evaluate(`(()=>{document.querySelector('.aps-subject-mark').value=80;document.querySelectorAll('.aps-subject-select')[1].value='english';document.getElementById('aps-form').requestSubmit();return document.getElementById('aps-error').textContent;})()`);
          if(!duplicate.includes('once'))throw Error('APS duplicate subject validation failed');
          const upload=await evaluate(`(async()=>{document.querySelector('[data-aps-mode="upload"]').click();const transfer=new DataTransfer();transfer.items.add(new File(['English 80%\\nAfrikaans 80%\\nMathematics 80%\\nLife Sciences 80%\\nPhysical Sciences 80%\\nAccounting 80%\\nLife Orientation 50%'],'report.txt',{type:'text/plain'}));const input=document.getElementById('aps-report-file');input.files=transfer.files;input.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,100));document.getElementById('aps-form').requestSubmit();return {rows:document.querySelectorAll('.aps-subject-row').length,score:document.getElementById('aps-score').value};})()`);
          if(upload.rows!==7||upload.score!=='42')throw Error('Report upload review flow failed '+JSON.stringify(upload));
          if(width===1440 && process.env.SMARTAPPLY_CHECK_OCR==='1') {
            const textResult=await evaluate(`(async()=>{const lines=['English 82%','Afrikaans 75%','Mathematics 69%','Life Sciences 73%','Physical Sciences 65%','Accounting 78%','Life Orientation 90%'];const canvas=document.createElement('canvas');canvas.width=1300;canvas.height=650;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1300,650);ctx.fillStyle='black';ctx.font='36px Arial';lines.forEach((line,index)=>ctx.fillText(line,65,70+index*75));const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));const text=await SmartApplyReports.read(new File([blob],'report.png',{type:'image/png'}));return SmartApplyReports.parse(text);})()`);
            if(textResult.length!==7||textResult.find(row=>row.subject==='mathematics')?.mark!==69)throw Error('Photo OCR failed '+JSON.stringify(textResult));
            console.log('Real report photo OCR passed.');
            const pdfResult=await evaluate(`(async()=>{const lines=['English 82%','Afrikaans 75%','Mathematics 69%','Life Sciences 73%','Physical Sciences 65%','Accounting 78%'];const stream='BT /F1 18 Tf '+lines.map((line,index)=>'1 0 0 1 50 '+(760-index*50)+' Tm ('+line+') Tj').join(' ')+' ET';const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+stream.length+' >>\\nstream\\n'+stream+'\\nendstream'];let pdf='%PDF-1.4\\n';const offsets=[0];objects.forEach((object,index)=>{offsets.push(pdf.length);pdf+=(index+1)+' 0 obj\\n'+object+'\\nendobj\\n';});const start=pdf.length;pdf+='xref\\n0 6\\n0000000000 65535 f \\n'+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \\n').join('')+'trailer\\n<< /Size 6 /Root 1 0 R >>\\nstartxref\\n'+start+'\\n%%EOF';const text=await SmartApplyReports.read(new File([pdf],'report.pdf',{type:'application/pdf'}));return SmartApplyReports.parse(text);})()`);
            if(pdfResult.length!==6||pdfResult.find(row=>row.subject==='english')?.mark!==82)throw Error('PDF report extraction failed '+JSON.stringify(pdfResult));
            console.log('Real PDF report extraction passed.');
          }
          const searched=await evaluate(`(()=>{const i=document.getElementById('institution-search');i.value='Cape Town';i.dispatchEvent(new Event('input'));return document.getElementById('homepage-institutions').textContent;})()`);
          if(!searched.includes('Cape Town'))throw Error('Homepage search failed');
          const empty=await evaluate(`(()=>{const i=document.getElementById('institution-search');i.value='zzzz-nonexistent';i.dispatchEvent(new Event('input'));return document.querySelector('.sa-preview-empty')?.textContent;})()`);
          if(!empty)throw Error('Homepage search empty state failed');
          await evaluate(`document.getElementById('institution-search').value='';document.getElementById('institution-search').dispatchEvent(new Event('input'))`);
          await evaluate(`document.getElementById('aps-form').reset();document.getElementById('aps-subject-rows').replaceChildren();document.getElementById('aps-manual-panel').hidden=true;document.getElementById('aps-upload-panel').hidden=true;document.querySelectorAll('[data-aps-mode]').forEach(b=>b.setAttribute('aria-pressed','false'));document.getElementById('aps-score').value='0';document.querySelector('.sa-score-ring').style.setProperty('--score-progress','0deg');document.getElementById('aps-error').textContent='';document.activeElement.blur();window.scrollTo(0,0)`);
          await sleep(100);
          const dims=await call('Page.getLayoutMetrics');
          const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:dims.cssContentSize.height,scale:1}});
          fs.writeFileSync(`.qa/homepage-full-${width}.png`,Buffer.from(shot.data,'base64'));
        }
        report.push(`${page} @ ${width}: layout, assets and interactions OK`);
      }
    }
    fs.writeFileSync('.qa/results.txt', report.join('\n'));
    console.log(report.join('\n'));
    await call('Browser.close');
  } finally {ws?.close();browser.kill();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
