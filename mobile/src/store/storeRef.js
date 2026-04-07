let storeRef = null;

export function setStore(store) {
  storeRef = store;
}

export function getStore() {
  return storeRef;
}
