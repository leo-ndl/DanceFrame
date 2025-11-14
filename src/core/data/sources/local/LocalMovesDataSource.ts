import { mmkvStorage } from '@/core/storage';

export interface ILocalDataSource<T> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  save(item: T): Promise<void>;
  saveAll(items: T[]): Promise<void>;
  delete(id: string): Promise<void>;
}

export class LocalDataSource<T extends { id: string }> implements ILocalDataSource<T> {
  constructor(private storageKey: string, private defaultData: T[] = []) {}

  async getAll(): Promise<T[]> {
    const cached = mmkvStorage.get<T[]>(this.storageKey);
    if (cached) {
      return cached;
    }
    
    if (this.defaultData.length > 0) {
      await this.saveAll(this.defaultData);
      return this.defaultData;
    }
    
    return [];
  }

  async getById(id: string): Promise<T | null> {
    const items = await this.getAll();
    return items.find(item => item.id === id) || null;
  }

  async save(item: T): Promise<void> {
    const items = await this.getAll();
    const index = items.findIndex(i => i.id === item.id);
    
    if (index >= 0) {
      items[index] = item;
    } else {
      items.push(item);
    }
    
    await this.saveAll(items);
  }

  async saveAll(items: T[]): Promise<void> {
    mmkvStorage.set(this.storageKey, items);
  }

  async delete(id: string): Promise<void> {
    const items = await this.getAll();
    const filtered = items.filter(item => item.id !== id);
    await this.saveAll(filtered);
  }
}