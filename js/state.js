// ═══════════════════════════════════════════
// state.js — Estado global compartido
// Soluciona los imports circulares: todos los
// módulos que necesiten CU lo importan de aquí.
// ═══════════════════════════════════════════

export const state = {
  CU: null,        // Usuario actual
};

// Getter y setter para mantener reactividad
export function getCU()      { return state.CU; }
export function setCUState(user) { state.CU = user; }
