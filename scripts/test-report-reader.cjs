const assert=require('node:assert/strict');
const {parse,subjects}=require('../report-reader.js');
const report=`SCHOOL REPORT 2026
English Home Language 78% 6
Afrikaans First Additional Language 72% 6
Mathematics 65% 5
Life Orientation 95% 7
Life Sciences 62% 5
Physical Sciences 59% 4
Accounting 71% 6`;
const rows=parse(report);
assert.equal(rows.length,7);
assert.deepEqual(rows.find(row=>row.subject==='mathematics'),{subject:'mathematics',mark:65});
assert.equal(rows.find(row=>row.subject==='life-orientation').mark,95);
assert.equal(parse('Mathematical Literacy 75 6')[0].subject,'mathematical-literacy');
assert.equal(parse('Technical Mathematics 70 6')[0].subject,'technical-mathematics');
assert.equal(parse('English,78\nMathematics,65').length,2);
assert.equal(parse('Student 12345678\nTotal 499\nClass 12A').length,0);
assert.equal(parse('English 78%\nEnglish 79%').length,1);
assert.equal(new Set(subjects.map(subject=>subject.id)).size,subjects.length);
console.log('Report parser tests passed: report rows, CSV, subject aliases, LO, duplicate rows and empty extraction.');
