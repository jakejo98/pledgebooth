export function formatDateDisplay(isoDate){
  if(!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${y}. ${m}. ${d}.`;
}
