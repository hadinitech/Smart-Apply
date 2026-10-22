/* One card presentation for the directory, featured list and landing page. */
(() => {
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const icon = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const building = icon('<rect x="8" y="3" width="12" height="18" rx="1.5"/><path d="M8 9H3v12h17M12 7h4m-4 4h4m-4 4h4M6 13v1m0 3v1m6 3v-3h4v3"/>');
  const pin = icon('<path d="M18 10c0 5-6 11-6 11S6 15 6 10a6 6 0 1 1 12 0Z"/><circle cx="12" cy="9" r="2"/>');
  const arrow = icon('<path d="M5 12h14m-6-6 6 6-6 6"/>');
  window.SmartApplyCards = {
    render(item, {className = '', index} = {}) {
      const name = escape(item.name);
      const abbreviation = item.name.match(/\(([^)]+)\)$/)?.[1] || item.name.split(' ').filter(word => !['of','the','and'].includes(word.toLowerCase())).map(word => word[0]).join('');
      const state = window.SmartApplyData.applicationState(item);
      const fee = item.fee === 0 ? 'Free' : item.fee == null ? 'Check institution' : `R${item.fee}`;
      const action = index === undefined
        ? `<a class="institution-view" href="institutions.html?q=${encodeURIComponent(item.name)}" aria-label="View ${name}"><span>View institution</span><span class="institution-arrow">${arrow}</span></a>`
        : `<button type="button" class="institution-view" onclick="openModal(${index})" aria-label="View ${name}"><span>View institution</span><span class="institution-arrow">${arrow}</span></button>`;
      return `<article class="institution-card ${className}">
        <div class="institution-card-top"><span class="institution-building">${building}</span></div>
        <p class="institution-code">${escape(abbreviation)}</p>
        <h3 class="institution-title">${name.replace(/ \([^)]+\)$/, '')}</h3>
        <p class="institution-location">${pin}<span>${escape(item.province)}</span></p>
        <span class="institution-type">${escape(item.type)}</span>
        <div class="institution-facts"><div><span>Application fee</span><p>${escape(fee)}</p></div><div><span>Applications</span><p>${escape(state.label)}</p></div></div>
        <p class="institution-source">Closes: ${escape(item.closing)}</p>
        <div class="inst-actions">${action}</div>
      </article>`;
    }
  };
})();
