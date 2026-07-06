const createMockStorage = () => {
  const store = new Map();
  return {
    set: (key, value) => store.set(key, value),
    getString: (key) => store.get(key),
    getNumber: (key) => store.get(key),
    getBoolean: (key) => store.get(key),
    contains: (key) => store.has(key),
    remove: (key) => store.delete(key),
    clearAll: () => store.clear(),
    getAllKeys: () => Array.from(store.keys()),
    addOnValueChangedListener: () => ({ remove: () => {} }),
  };
};

const mockInstance = createMockStorage();

module.exports = {
  MMKV: jest.fn(() => mockInstance),
  createMMKV: jest.fn(() => mockInstance),
};
