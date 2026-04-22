// Cores do Projeto Apê Patinhas (extraídas do PDF)
export const colors = {
  damasco: '#E8C9B5',     // Coral/Damasco - Tinta Seda
  sonhoAnjo: '#F2F1EC',   // Off-white - Tinta Sonho de Anjo
  carvalhoDian: '#D6BC9D', // Madeira - MDF Duratex
  azulAstral: '#8FA9B8',  // Azul - MDF Duratex
  tomilhoSeco: '#94A684', // Verde - Parede Varanda
} as const;

export type RoomId = 'entrada' | 'sala' | 'escritorio' | 'varanda';

export const INVENTORY_KEYS = ['Afeto', 'Intuição', 'Lógica'] as const;
export type InventoryKey = (typeof INVENTORY_KEYS)[number];
