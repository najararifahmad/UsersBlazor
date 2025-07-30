import AsyncStorage from '@react-native-async-storage/async-storage';
import { InventoryItem, Category } from '../types';

const STORAGE_KEYS = {
  INVENTORY_ITEMS: '@inventory_items',
  CATEGORIES: '@categories',
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Electronics', color: '#4F46E5' },
  { id: '2', name: 'Office Supplies', color: '#059669' },
  { id: '3', name: 'Tools', color: '#DC2626' },
  { id: '4', name: 'Furniture', color: '#7C2D12' },
  { id: '5', name: 'Other', color: '#6B7280' },
];

class StorageService {
  async getInventoryItems(): Promise<InventoryItem[]> {
    try {
      const items = await AsyncStorage.getItem(STORAGE_KEYS.INVENTORY_ITEMS);
      return items ? JSON.parse(items).map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      })) : [];
    } catch (error) {
      console.error('Error loading inventory items:', error);
      return [];
    }
  }

  async saveInventoryItems(items: InventoryItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.INVENTORY_ITEMS, JSON.stringify(items));
    } catch (error) {
      console.error('Error saving inventory items:', error);
      throw error;
    }
  }

  async addInventoryItem(item: InventoryItem): Promise<void> {
    const items = await this.getInventoryItems();
    items.push(item);
    await this.saveInventoryItems(items);
  }

  async updateInventoryItem(updatedItem: InventoryItem): Promise<void> {
    const items = await this.getInventoryItems();
    const index = items.findIndex(item => item.id === updatedItem.id);
    if (index !== -1) {
      items[index] = updatedItem;
      await this.saveInventoryItems(items);
    }
  }

  async deleteInventoryItem(id: string): Promise<void> {
    const items = await this.getInventoryItems();
    const filteredItems = items.filter(item => item.id !== id);
    await this.saveInventoryItems(filteredItems);
  }

  async getCategories(): Promise<Category[]> {
    try {
      const categories = await AsyncStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (categories) {
        return JSON.parse(categories);
      } else {
        // Initialize with default categories
        await this.saveCategories(DEFAULT_CATEGORIES);
        return DEFAULT_CATEGORIES;
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      return DEFAULT_CATEGORIES;
    }
  }

  async saveCategories(categories: Category[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    } catch (error) {
      console.error('Error saving categories:', error);
      throw error;
    }
  }

  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([STORAGE_KEYS.INVENTORY_ITEMS, STORAGE_KEYS.CATEGORIES]);
    } catch (error) {
      console.error('Error clearing data:', error);
      throw error;
    }
  }
}

export const storageService = new StorageService();