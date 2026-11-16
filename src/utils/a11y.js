/**
 * Props para que un elemento que no es <button> (tarjeta, ítem de lista) se pueda usar con teclado:
 * entra en el orden de tabulación, se anuncia como botón y se activa con Enter o Espacio.
 * Usa el onClick que ya tenga el elemento.
 */
export const pressable = {
  role: 'button',
  tabIndex: 0,
  onKeyDown: (e) => {
    // Solo cuando el foco está en la tarjeta misma, no en un botón dentro de ella
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.currentTarget.click();
    }
  },
};
