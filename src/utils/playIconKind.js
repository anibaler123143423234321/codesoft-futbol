// Tipo de ícono (ver components/SportIcon) para una jugada de ESPN.
export function playIconKind(category, typeText = '') {
  if (category === 'card') {
    if (/second yellow/i.test(typeText)) return 'second-yellow';
    return /red/i.test(typeText) ? 'red' : 'yellow';
  }
  return category || null;
}
