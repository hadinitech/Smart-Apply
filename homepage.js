(() => {
  'use strict';
  const data = window.SmartApplyData;
  const preview = document.getElementById('homepage-institutions');
  const search = document.getElementById('institution-search');
  const selectedNames = ['University of Johannesburg (UJ)', 'Tshwane University of Technology (TUT)', 'Rosebank College'];
  function renderInstitutions(query = '') {
    const q = query.trim().toLowerCase();
    const matches = q ? data.institutions.filter(item => `${item.name} ${item.province} ${item.type} ${item.area}`.toLowerCase().includes(q)).slice(0, 3) : selectedNames.map(name => data.institutions.find(item => item.name === name)).filter(Boolean);
    preview.replaceChildren();
    matches.forEach(item => {
      preview.insertAdjacentHTML('beforeend', SmartApplyCards.render(item, {className:'sa-institution'}));
    });
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.className = 'sa-preview-empty';
      empty.textContent = 'No matching institutions. Try a name, province or institution type.';
      preview.append(empty);
    }
    document.getElementById('search-result-count').textContent = q ? `${matches.length} preview result${matches.length === 1 ? '' : 's'}. Search the full directory for more.` : '';
  }
  if (preview && data) {
    renderInstitutions();
    search.addEventListener('input', () => renderInstitutions(search.value));
  }
  const form = document.getElementById('aps-form');
  const rows = document.getElementById('aps-subject-rows');
  const manualPanel = document.getElementById('aps-manual-panel');
  const uploadPanel = document.getElementById('aps-upload-panel');
  const fileInput = document.getElementById('aps-report-file');
  const uploadStatus = document.getElementById('aps-upload-status');
  const reportReader = window.SmartApplyReports;
  const score = document.getElementById('aps-score');
  const error = document.getElementById('aps-error');
  const scoreRing = document.querySelector('.sa-score-ring');
  let rowId = 0;
  let readRequest = 0;
  function resetScore() {
    score.value = '0';
    scoreRing.style.setProperty('--score-progress', '0deg');
    error.textContent = '';
    document.getElementById('aps-result-note').textContent = 'Choose a report or enter your results to calculate an estimate. Admission requirements vary by institution.';
  }
  function addSubject(subject = '', mark = '') {
    const row = document.createElement('div');
    const id = ++rowId;
    row.className = 'aps-subject-row';
    const select = document.createElement('select');
    select.id = `aps-subject-${id}`;
    select.className = 'aps-subject-select';
    select.setAttribute('aria-label', `Subject ${id}`);
    select.add(new Option('Choose subject', ''));
    reportReader.subjects.forEach(item => select.add(new Option(item.label,item.id)));
    select.value = subject;
    const input = document.createElement('input');
    input.className = 'aps-subject-mark';
    input.id = `aps-mark-${id}`;
    input.type = 'number';input.min = '0';input.max = '100';input.step = '1';input.inputMode = 'numeric';
    input.placeholder = '%';input.value = mark;
    input.setAttribute('aria-label', `Mark for subject ${id}, percentage`);
    const remove = document.createElement('button');
    remove.type = 'button';remove.className = 'aps-remove-subject';remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove subject ${id}`);
    remove.addEventListener('click', () => {row.remove();resetScore();(rows.lastElementChild?.querySelector('select') || document.getElementById('aps-add-subject')).focus({preventScroll:true});});
    select.addEventListener('change', () => {input.setAttribute('aria-label', `Mark for ${select.selectedOptions[0].textContent}, percentage`);resetScore();});
    input.addEventListener('input',resetScore);
    row.append(select,input,remove);rows.append(row);
    return select;
  }
  function setMode(mode) {
    readRequest++;
    document.getElementById('aps-entry-intro').hidden=true;
    uploadPanel.hidden = mode !== 'upload';
    manualPanel.hidden = mode !== 'manual';
    document.querySelectorAll('[data-aps-mode]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.apsMode === mode)));
    if (mode === 'manual' && !rows.children.length) for (let i=0;i<6;i++) addSubject();
    if (mode === 'manual') document.getElementById('aps-review-note').textContent='Choose your subjects and enter a percentage for each.';
    resetScore();
  }
  document.querySelectorAll('[data-aps-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.apsMode)));
  document.getElementById('aps-add-subject').addEventListener('click', () => {
    const select = addSubject();resetScore();select.focus({preventScroll:true});rows.scrollTop=rows.scrollHeight;
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const request = ++readRequest;
    fileInput.disabled = true;
    uploadStatus.textContent = 'Reading your report.';
    uploadPanel.setAttribute('aria-busy','true');
    try {
      const text = await reportReader.read(file, message => {if(request===readRequest)uploadStatus.textContent=message;});
      if(request !== readRequest)return;
      const results = reportReader.parse(text);
      if (!results.length) throw new Error('No subject marks were found. Try a clearer report or enter your results manually.');
      rows.replaceChildren();
      results.forEach(item => addSubject(item.subject,item.mark));
      uploadPanel.hidden = true;manualPanel.hidden = false;
      document.getElementById('aps-review-note').textContent = `Found ${results.length} subjects. Review each subject and mark, add anything missing, then calculate.`;
      uploadStatus.textContent = 'Your report has been read. Review the extracted results.';
      resetScore();
      rows.querySelector('select').focus({preventScroll:true});
    } catch (e) {if(request===readRequest)uploadStatus.textContent=e.message || 'The report could not be read. Try again or enter your results manually.';}
    finally {fileInput.disabled=false;uploadPanel.removeAttribute('aria-busy');fileInput.value='';}
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    resetScore();
    const marks = {};
    const entries = [...rows.children];
    try {
      for (const row of entries) {
        const select = row.querySelector('select');
        const input = row.querySelector('input');
        select.removeAttribute('aria-invalid');input.removeAttribute('aria-invalid');
        if(!select.value){select.setAttribute('aria-invalid','true');select.focus({preventScroll:true});throw new Error('Choose a subject for every row, or remove any unused rows.');}
        if(Object.hasOwn(marks,select.value)){select.setAttribute('aria-invalid','true');select.focus({preventScroll:true});throw new Error('Each subject can only be included once. Remove the duplicate subject.');}
        if(input.value.trim()==='' || !input.validity.valid){input.setAttribute('aria-invalid','true');input.focus({preventScroll:true});throw new Error('Enter a percentage from 0 to 100 for every subject.');}
        marks[select.value]=input.value;
      }
      const result = window.SmartApplyAPS.calculate(marks);
      score.value = result.score;
      scoreRing.style.setProperty('--score-progress', `${result.score / result.max * 360}deg`);
      error.textContent = '';
      document.getElementById('aps-result-note').textContent = 'Estimated from your best six academic subjects. Life Orientation is excluded. Check subject and programme requirements with your institution. Admission is not guaranteed.';
    } catch (e) { error.textContent = e.message; }
  });
  document.querySelector('[href="#aps-form"]').addEventListener('click', () => { setTimeout(() => document.querySelector('[data-aps-mode]').focus({preventScroll:true}),50); });
})();
