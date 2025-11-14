import { MMKV, createMMKV } from "react-native-mmkv";

class MMKVStorage {
    private storage: MMKV;

    constructor() {
        this.storage = createMMKV({
            id: 'dance-frame-storage',
        });
    
    }

    set(key: string, value: any): void {
    this.storage.set(key, JSON.stringify(value));
    }

    get<T>(key: string): T | null {
        const value = this.storage.getString(key);
        return value ? JSON.parse(value) : null;
    }

    delete(key: string): void {
        this.storage.remove(key);
    }

    clear(): void {
        this.storage.clearAll();
    }

    getAllKeys(): string[] {
        return this.storage.getAllKeys();
    }
}

export const mmkvStorage = new MMKVStorage();