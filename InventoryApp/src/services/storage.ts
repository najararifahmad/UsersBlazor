import AsyncStorage from '@react-native-async-storage/async-storage';
import { InventoryItem, Category, Order, Customer } from '../types';

const STORAGE_KEYS = {
  INVENTORY_ITEMS: '@inventory_items',
  CATEGORIES: '@categories',
  ORDERS: '@orders',
  CUSTOMERS: '@customers',
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Electronics', color: '#4F46E5' },
  { id: '2', name: 'Office Supplies', color: '#059669' },
  { id: '3', name: 'Tools', color: '#DC2626' },
  { id: '4', name: 'Furniture', color: '#7C2D12' },
  { id: '5', name: 'Other', color: '#6B7280' },
];

class StorageService {
  // Inventory Items Methods
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

  async getInventoryItemById(id: string): Promise<InventoryItem | null> {
    const items = await this.getInventoryItems();
    return items.find(item => item.id === id) || null;
  }

  // Categories Methods
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

  // Orders Methods
  async getOrders(): Promise<Order[]> {
    try {
      const orders = await AsyncStorage.getItem(STORAGE_KEYS.ORDERS);
      return orders ? JSON.parse(orders).map((order: any) => ({
        ...order,
        orderDate: new Date(order.orderDate),
        expectedDeliveryDate: order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate) : undefined,
        createdAt: new Date(order.createdAt),
        updatedAt: new Date(order.updatedAt),
      })) : [];
    } catch (error) {
      console.error('Error loading orders:', error);
      return [];
    }
  }

  async saveOrders(orders: Order[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    } catch (error) {
      console.error('Error saving orders:', error);
      throw error;
    }
  }

  async addOrder(order: Order): Promise<void> {
    const orders = await this.getOrders();
    orders.push(order);
    await this.saveOrders(orders);
    
    // Update inventory quantities
    for (const orderItem of order.items) {
      const inventoryItem = await this.getInventoryItemById(orderItem.inventoryItemId);
      if (inventoryItem) {
        inventoryItem.quantity -= orderItem.quantity;
        inventoryItem.updatedAt = new Date();
        await this.updateInventoryItem(inventoryItem);
      }
    }
  }

  async updateOrder(updatedOrder: Order): Promise<void> {
    const orders = await this.getOrders();
    const index = orders.findIndex(order => order.id === updatedOrder.id);
    if (index !== -1) {
      orders[index] = updatedOrder;
      await this.saveOrders(orders);
    }
  }

  async deleteOrder(id: string): Promise<void> {
    const orders = await this.getOrders();
    const filteredOrders = orders.filter(order => order.id !== id);
    await this.saveOrders(filteredOrders);
  }

  async getOrderById(id: string): Promise<Order | null> {
    const orders = await this.getOrders();
    return orders.find(order => order.id === id) || null;
  }

  // Customers Methods
  async getCustomers(): Promise<Customer[]> {
    try {
      const customers = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      return customers ? JSON.parse(customers).map((customer: any) => ({
        ...customer,
        createdAt: new Date(customer.createdAt),
      })) : [];
    } catch (error) {
      console.error('Error loading customers:', error);
      return [];
    }
  }

  async saveCustomers(customers: Customer[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    } catch (error) {
      console.error('Error saving customers:', error);
      throw error;
    }
  }

  async addCustomer(customer: Customer): Promise<void> {
    const customers = await this.getCustomers();
    customers.push(customer);
    await this.saveCustomers(customers);
  }

  async updateCustomer(updatedCustomer: Customer): Promise<void> {
    const customers = await this.getCustomers();
    const index = customers.findIndex(customer => customer.id === updatedCustomer.id);
    if (index !== -1) {
      customers[index] = updatedCustomer;
      await this.saveCustomers(customers);
    }
  }

  async deleteCustomer(id: string): Promise<void> {
    const customers = await this.getCustomers();
    const filteredCustomers = customers.filter(customer => customer.id !== id);
    await this.saveCustomers(filteredCustomers);
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    const customers = await this.getCustomers();
    return customers.find(customer => customer.id === id) || null;
  }

  // Utility Methods
  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.INVENTORY_ITEMS, 
        STORAGE_KEYS.CATEGORIES,
        STORAGE_KEYS.ORDERS,
        STORAGE_KEYS.CUSTOMERS
      ]);
    } catch (error) {
      console.error('Error clearing data:', error);
      throw error;
    }
  }

  async exportData(): Promise<string> {
    try {
      const [items, categories, orders, customers] = await Promise.all([
        this.getInventoryItems(),
        this.getCategories(),
        this.getOrders(),
        this.getCustomers(),
      ]);

      const exportData = {
        inventory: items,
        categories,
        orders,
        customers,
        exportDate: new Date().toISOString(),
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.inventory) await this.saveInventoryItems(data.inventory);
      if (data.categories) await this.saveCategories(data.categories);
      if (data.orders) await this.saveOrders(data.orders);
      if (data.customers) await this.saveCustomers(data.customers);
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }
}

export const storageService = new StorageService();