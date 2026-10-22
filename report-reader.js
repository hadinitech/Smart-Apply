/* Report parsing is local to the browser. PDF and OCR libraries load on demand. */
(function(root) {
  'use strict';
  const subjects = [
    ['english','English',['english']],['afrikaans','Afrikaans',['afrikaans']],
    ['isizulu','isiZulu',['isizulu','isi zulu','zulu']],['isixhosa','isiXhosa',['isixhosa','isi xhosa','xhosa']],
    ['sepedi','Sepedi',['sepedi','northern sotho']],['setswana','Setswana',['setswana']],['sesotho','Sesotho',['sesotho']],
    ['siswati','Siswati',['siswati']],['tshivenda','Tshivenda',['tshivenda']],['xitsonga','Xi'+'tsonga',['xitsonga','itsonga']],
    ['isindebele','isiNdebele',['isindebele','isi ndebele']],['sign-language','South African Sign Language',['south african sign language','sign language']],
    ['mathematical-literacy','Mathematical Literacy',['mathematical literacy','maths literacy','math literacy']],
    ['technical-mathematics','Technical Mathematics',['technical mathematics','technical maths']],
    ['mathematics','Mathematics',['mathematics','maths']],['life-orientation','Life Orientation',['life orientation']],
    ['life-sciences','Life Sciences',['life sciences','life science','biology']],
    ['physical-sciences','Physical Sciences',['physical sciences','physical science']],
    ['technical-sciences','Technical Sciences',['technical sciences']],['accounting','Accounting',['accounting']],
    ['business-studies','Business Studies',['business studies']],['economics','Economics',['economics']],
    ['geography','Geography',['geography']],['history','History',['history']],
    ['agricultural-sciences','Agricultural Sciences',['agricultural sciences']],
    ['agricultural-technology','Agricultural Technology',['agricultural technology']],
    ['agricultural-management','Agricultural Management Practices',['agricultural management practices']],
    ['cat','Computer Applications Technology',['computer applications technology','computer application technology','cat']],
    ['it','Information Technology',['information technology']],['consumer-studies','Consumer Studies',['consumer studies']],
    ['tourism','Tourism',['tourism']],['hospitality','Hospitality Studies',['hospitality studies']],
    ['visual-arts','Visual Arts',['visual arts']],['dramatic-arts','Dramatic Arts',['dramatic arts']],
    ['design','Design',['design']],['music','Music',['music']],['dance','Dance Studies',['dance studies']],
    ['religion','Religion Studies',['religion studies']],['egd','Engineering Graphics and Design',['engineering graphics and design','engineering graphics & design','egd']],
    ['civil-technology','Civil Technology',['civil technology']],['electrical-technology','Electrical Technology',['electrical technology']],
    ['mechanical-technology','Mechanical Technology',['mechanical technology']]
  ].map(([id,label,aliases]) => ({id,label,aliases}));
  function parse(text) {
    const found = new Map();
    for (const line of text.split(/[\r\n]+/)) {
      const normal = line.toLowerCase().replace(/[^a-z0-9%.]+/g,' ').trim();
      const matches = subjects.flatMap(subject => subject.aliases.map(alias => ({subject,alias}))).filter(({alias}) => new RegExp('\\b'+alias+'\\b').test(normal)).sort((a,b) => b.alias.length-a.alias.length);
      if (!matches.length) continue;
      const {subject,alias} = matches[0];
      const after = normal.slice(normal.indexOf(alias)+alias.length);
      const explicit = [...after.matchAll(/\b(100|\d{1,2})(?:\.\d+)?\s*%/g)];
      const numbers = [...after.matchAll(/\b(100|\d{1,2})(?:\.\d+)?\b/g)].map(match => Number(match[0]));
      // Percentages are preferred. For table text, take the final number above 7,
      // skipping NSC achievement levels. Every extracted value is reviewed in UI.
      const mark = explicit.length ? Number(explicit[explicit.length-1][0].replace('%','').trim()) : numbers.filter(number => number > 7 && number <= 100).at(-1) ?? numbers.at(0);
      if (mark !== undefined && Number.isFinite(mark) && mark >= 0 && mark <= 100) found.set(subject.id,{subject:subject.id,mark});
    }
    return [...found.values()];
  }
  let ocrLoader;
  function loadOCR() {
    if (root.Tesseract) return Promise.resolve(root.Tesseract);
    if (!ocrLoader) ocrLoader = new Promise((resolve,reject) => {
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';
      script.onload=()=>resolve(root.Tesseract);
      script.onerror=()=>{ocrLoader=null;script.remove();reject(new Error('The report reader could not load. Check your connection or enter your results manually.'));};
      document.head.append(script);
    });
    return ocrLoader;
  }
  async function read(file, notify=()=>{}) {
    if (!file || file.size===0) throw new Error('Choose a report that contains your subject results.');
    if (file.size > 15*1024*1024) throw new Error('Choose a report smaller than 15 MB.');
    const extension=file.name.split('.').pop().toLowerCase();
    if (['txt','csv'].includes(extension)) return file.text();
    let worker;
    let pdf;
    const recognize=async image=>{
      if (!worker) {
        notify('Preparing the report reader. Your report stays on this device.');
        const tesseract=await loadOCR();
        worker=await tesseract.createWorker('eng',1,{logger: message=>{if(message.status==='recognizing text')notify(`Reading your report: ${Math.round(message.progress*100)}%.`);}});
      }
      return (await worker.recognize(image)).data.text;
    };
    try {
      if (extension==='pdf') {
        notify('Opening your PDF report.');
        const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
        pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
        if(pdf.numPages>6)throw new Error('Choose a report with up to 6 pages, or enter your results manually.');
        const pages=[];
        for(let number=1;number<=pdf.numPages;number++) {
          notify(`Reading page ${number} of ${pdf.numPages}.`);
          const page=await pdf.getPage(number);
          const content=await page.getTextContent();
          const lines=new Map();
          for(const item of content.items){if(!item.str)continue;const y=Math.round(item.transform[5]/4)*4;lines.set(y,[...(lines.get(y)||[]),{x:item.transform[4],text:item.str}]);}
          let text=[...lines.entries()].sort((a,b)=>b[0]-a[0]).map(([,items])=>items.sort((a,b)=>a.x-b.x).map(item=>item.text).join(' ')).join('\n');
          if(parse(text).length<3){
            const viewport=page.getViewport({scale:Math.min(2,1800/page.getViewport({scale:1}).width)});
            const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
            await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
            text=await recognize(canvas);
            canvas.width=0;canvas.height=0;
          }
          pages.push(text);page.cleanup();
        }
        return pages.join('\n');
      }
      if (!['png','jpg','jpeg','webp'].includes(extension)) throw new Error('Choose a PDF, JPG, PNG, WebP, TXT or CSV report.');
      return await recognize(file);
    } finally {if(worker)await worker.terminate();if(pdf)await pdf.destroy();}
  }
  const api={subjects,parse,read};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.SmartApplyReports=api;
})(typeof window!=='undefined'?window:undefined);
