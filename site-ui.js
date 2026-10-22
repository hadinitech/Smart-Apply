/* Progressive enhancements shared by the existing static pages. */
(() => {
  // Format prose without changing URLs, dataset keys, identifiers or input values.
  const plainCopy = text => text.replace(/(\d)\s*[\u2013\u2014-]\s*(?=\d)/g, '$1 to ').replace(/\s*[\p{Pd}\u2212]+\s*/gu, ' ');
  const cleanCopy = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.parentElement?.closest('script,style,textarea')) {
        const cleaned = plainCopy(node.nodeValue);
        if (cleaned !== node.nodeValue) node.nodeValue = cleaned;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.matches('script,style,textarea')) return;
      ['placeholder','aria-label','title'].forEach(attribute => {
        const value=node.getAttribute(attribute);
        if(value && plainCopy(value)!==value)node.setAttribute(attribute,plainCopy(value));
      });
      node.childNodes.forEach(cleanCopy);
    }
  };
  cleanCopy(document.body);
  new MutationObserver(records => records.forEach(record => {
    if(record.type==='childList')record.addedNodes.forEach(cleanCopy);
    else if(record.type==='characterData')cleanCopy(record.target);
    else if(record.type==='attributes'){
      const value=record.target.getAttribute(record.attributeName);
      if(value && plainCopy(value)!==value)record.target.setAttribute(record.attributeName,plainCopy(value));
    }
  })).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});
  const navigation = document.querySelector('header .nav-links');
  const toggle = document.querySelector('header .menu, header .burger');
  if (navigation && toggle) {
    if (document.querySelector('header.site-header')) {
      toggle.addEventListener('click', () => {
        const open = navigation.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
      });
    }
    navigation.id = 'primary-navigation';
    toggle.setAttribute('aria-controls', navigation.id);
    const close = () => { navigation.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); };
    navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', close));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') { close(); } });
    document.addEventListener('click', event => { if (!event.target.closest('header')) close(); });
  }
  document.querySelectorAll('.faq-q').forEach((button, index) => {
    const answer = button.closest('.faq-item').querySelector('.faq-a');
    if (!answer) return;
    answer.id = `faq-answer-${index}`;
    button.setAttribute('aria-controls', answer.id);
    const sync = () => document.querySelectorAll('.faq-q').forEach(item => item.setAttribute('aria-expanded', String(item.closest('.faq-item').classList.contains('open'))));
    sync();
    button.addEventListener('click', sync);
  });
  const checks = [...document.querySelectorAll('[data-document]')];
  if (checks.length) {
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem('smartapply-documents') || '[]'); } catch {}
    if (!Array.isArray(saved)) saved = [];
    checks.forEach(check => { check.checked = saved.includes(check.dataset.document); });
    const update = () => {
      const ready = checks.filter(check => check.checked);
      document.getElementById('document-count').textContent = `${ready.length} of ${checks.length} ready`;
      document.getElementById('document-progress').value = ready.length;
      try { localStorage.setItem('smartapply-documents', JSON.stringify(ready.map(check => check.dataset.document))); } catch {}
    };
    checks.forEach(check => check.addEventListener('change', update));
    update();
  }
  const overlay = document.getElementById('modalOverlay');
  if (overlay) {
    const dialog = overlay.querySelector('.modal');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'modalName');
    let previousFocus;
    new MutationObserver(() => {
      if (overlay.classList.contains('open')) { previousFocus = document.activeElement; document.getElementById('modalClose').focus(); }
      else previousFocus?.focus();
    }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
    overlay.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const targets = [...dialog.querySelectorAll('button, a[href], input, select, [tabindex="0"]')].filter(el => el.getClientRects().length);
      const first = targets[0], last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }
})();
