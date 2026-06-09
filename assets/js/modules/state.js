export const state = {
  query: "",
  continent: "Todas",
  category: "Todas",
  provider: "Todos",
  landscapeFirst: true,
  highPriorityOnly: false,
  selectedIndex: 0,
  rotationTimer: null,
  rotationInterval: 12000,
  filtered: []
};

export function stopRotation() {
  if (state.rotationTimer) {
    clearInterval(state.rotationTimer);
    state.rotationTimer = null;
  }
}

export function isRotationRunning() {
  return Boolean(state.rotationTimer);
}
