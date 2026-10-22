/* Rule profiles keep institution-specific scoring separate from form behavior.
   The default uses six NSC subjects, excludes LO, and totals the 1–7 scale.
   Source: University of Pretoria's published NSC APS guidance (linked in the UI). */
(function (root) {
  'use strict';
  const profiles = Object.freeze({
    'nsc-six': Object.freeze({
      max: 42, requiredSubjects: 6, excluded: ['life-orientation'],
      bands: Object.freeze([[80, 7], [70, 6], [60, 5], [50, 4], [40, 3], [30, 2], [0, 1]])
    })
  });
  function calculate(marks, profile = profiles['nsc-six']) {
    const subjects = Object.entries(marks).filter(([subject]) => !profile.excluded.includes(subject));
    if (subjects.length < profile.requiredSubjects) throw new Error(`Enter at least ${profile.requiredSubjects} academic subject marks.`);
    const breakdown = subjects.map(([subject, raw]) => {
      const mark = typeof raw === 'string' && raw.trim() === '' ? NaN : Number(raw);
      if (raw === null || raw === undefined || !Number.isFinite(mark) || mark < 0 || mark > 100) throw new Error('Enter a percentage from 0 to 100 for each academic subject.');
      return {subject, mark, points: profile.bands.find(([minimum]) => mark >= minimum)[1]};
    });
    const selected = breakdown.sort((a, b) => b.points - a.points || b.mark - a.mark).slice(0, profile.requiredSubjects);
    return {score: selected.reduce((sum, item) => sum + item.points, 0), max: profile.max, breakdown: selected};
  }
  const api = Object.freeze({profiles, calculate});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SmartApplyAPS = api;
})(typeof window !== 'undefined' ? window : undefined);
