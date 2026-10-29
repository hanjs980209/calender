(function (root) {
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function monthDays(year, month, monday = false) {
    const first = new Date(year, month, 1, 12);
    const offset = (first.getDay() + (monday ? 6 : 0)) % 7;
    return Array.from({length:42}, (_, i) => new Date(year, month, 1 - offset + i, 12));
  }
  function validData(data) {
    if (!data || data.version !== 1 || !data.notes || typeof data.notes !== 'object' || Array.isArray(data.notes)) return false;
    return Object.entries(data.notes).every(([key,value]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && Array.isArray(value) && value.length <= 1000 && value.every(n => n && typeof n.id === 'string' && typeof n.text === 'string' && n.text.length <= 10000 && typeof n.done === 'boolean' && ['mint','blue','rose','amber'].includes(n.color)));
  }
  const api = {dateKey, monthDays, validData};
  if (typeof module !== 'undefined') module.exports = api;
  else root.Calendar = api;
})(globalThis);
