import * as SQLite from 'expo-sqlite';
import { InventoryItem, Category, Order, Customer, OrderItem } from '../types';

// Database schema and queries
const DB_NAME = 'inventory.db';
const DB_VERSION = 1;

interface PaginationOptions {
  limit?: number;
  offset?: number;
}

interface SearchOptions {
  searchText?: string;
  category?: string;
  lowStock?: boolean;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

class DatabaseService {
  private db: SQLite.WebSQLDatabase | null = null;

  async init(): Promise<void> {
    try {
      this.db = SQLite.openDatabase(DB_NAME);
      await this.createTables();
      await this.insertDefaultCategories();
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  private createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(
        (tx) => {
          // Categories table
          tx.executeSql(`
            CREATE TABLE IF NOT EXISTS categories (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT,
              color TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
          `);

          // Inventory items table
          tx.executeSql(`
            CREATE TABLE IF NOT EXISTS inventory_items (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT,
              category_id TEXT,
              quantity INTEGER NOT NULL DEFAULT 0,
              unit_price REAL NOT NULL DEFAULT 0,
              location TEXT,
              barcode TEXT,
              image_uri TEXT,
              minimum_stock INTEGER,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (category_id) REFERENCES categories (id)
            );
          `);

          // Customers table
          tx.executeSql(`
            CREATE TABLE IF NOT EXISTS customers (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT,
              phone TEXT,
              address TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
          `);

          // Orders table
          tx.executeSql(`
            CREATE TABLE IF NOT EXISTS orders (
              id TEXT PRIMARY KEY,
              order_number TEXT UNIQUE NOT NULL,
              customer_id TEXT,
              customer_name TEXT NOT NULL,
              total_amount REAL NOT NULL,
              status TEXT NOT NULL DEFAULT 'pending',
              order_date DATETIME NOT NULL,
              expected_delivery_date DATETIME,
              notes TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (customer_id) REFERENCES customers (id)
            );
          `);

          // Order items table
          tx.executeSql(`
            CREATE TABLE IF NOT EXISTS order_items (
              id TEXT PRIMARY KEY,
              order_id TEXT NOT NULL,
              inventory_item_id TEXT NOT NULL,
              inventory_item_name TEXT NOT NULL,
              quantity INTEGER NOT NULL,
              unit_price REAL NOT NULL,
              total_price REAL NOT NULL,
              FOREIGN KEY (order_id) REFERENCES orders (id),
              FOREIGN KEY (inventory_item_id) REFERENCES inventory_items (id)
            );
          `);

          // Create indexes for better performance
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory_items (name);');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items (category_id);');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory_items (quantity);');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_orders_date ON orders (order_date);');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_id);');
        },
        (error) => reject(error),
        () => resolve()
      );
    });
  }

  private async insertDefaultCategories(): Promise<void> {
    const categories = [
      { id: '1', name: 'Electronics', color: '#4F46E5' },
      { id: '2', name: 'Office Supplies', color: '#059669' },
      { id: '3', name: 'Tools', color: '#DC2626' },
      { id: '4', name: 'Furniture', color: '#7C2D12' },
      { id: '5', name: 'Other', color: '#6B7280' },
    ];

    for (const category of categories) {
      await this.addCategory(category, true); // true = ignore if exists
    }
  }

  // Categories Methods
  async getCategories(): Promise<Category[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          'SELECT * FROM categories ORDER BY name',
          [],
          (_, result) => {
            const categories: Category[] = [];
            for (let i = 0; i < result.rows.length; i++) {
              const row = result.rows.item(i);
              categories.push({
                id: row.id,
                name: row.name,
                description: row.description,
                color: row.color,
              });
            }
            resolve(categories);
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  async addCategory(category: Category, ignoreIfExists = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = ignoreIfExists 
        ? 'INSERT OR IGNORE INTO categories (id, name, description, color) VALUES (?, ?, ?, ?)'
        : 'INSERT INTO categories (id, name, description, color) VALUES (?, ?, ?, ?)';

      this.db.transaction((tx) => {
        tx.executeSql(
          sql,
          [category.id, category.name, category.description || null, category.color],
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  // Inventory Items Methods
  async getInventoryItems(options: SearchOptions & PaginationOptions = {}): Promise<InventoryItem[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      let sql = `
        SELECT i.*, c.name as category_name 
        FROM inventory_items i 
        LEFT JOIN categories c ON i.category_id = c.id
      `;
      
      const params: any[] = [];
      const conditions: string[] = [];

      // Add search conditions
      if (options.searchText) {
        conditions.push(`(i.name LIKE ? OR i.description LIKE ? OR i.location LIKE ? OR i.barcode LIKE ?)`);
        const searchPattern = `%${options.searchText}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      if (options.category) {
        conditions.push('i.category_id = ?');
        params.push(options.category);
      }

      if (options.lowStock) {
        conditions.push('i.quantity <= i.minimum_stock AND i.minimum_stock IS NOT NULL');
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      // Add sorting
      const sortBy = options.sortBy || 'updated_at';
      const sortOrder = options.sortOrder || 'DESC';
      sql += ` ORDER BY i.${sortBy} ${sortOrder}`;

      // Add pagination
      if (options.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
        
        if (options.offset) {
          sql += ' OFFSET ?';
          params.push(options.offset);
        }
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          sql,
          params,
          (_, result) => {
            const items: InventoryItem[] = [];
            for (let i = 0; i < result.rows.length; i++) {
              const row = result.rows.item(i);
              items.push({
                id: row.id,
                name: row.name,
                description: row.description || '',
                category: row.category_name || 'Unknown',
                quantity: row.quantity,
                unitPrice: row.unit_price,
                location: row.location || '',
                barcode: row.barcode,
                imageUri: row.image_uri,
                minimumStock: row.minimum_stock,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at),
              });
            }
            resolve(items);
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  async getInventoryItemById(id: string): Promise<InventoryItem | null> {
    const items = await this.getInventoryItems({ searchText: undefined, limit: 1 });
    return items.find(item => item.id === id) || null;
  }

  async addInventoryItem(item: InventoryItem): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          `INSERT INTO inventory_items 
           (id, name, description, category_id, quantity, unit_price, location, barcode, image_uri, minimum_stock, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.name,
            item.description,
            item.category,
            item.quantity,
            item.unitPrice,
            item.location,
            item.barcode || null,
            item.imageUri || null,
            item.minimumStock || null,
            item.createdAt.toISOString(),
            item.updatedAt.toISOString(),
          ],
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  async updateInventoryItem(item: InventoryItem): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          `UPDATE inventory_items SET 
           name = ?, description = ?, category_id = ?, quantity = ?, unit_price = ?, 
           location = ?, barcode = ?, image_uri = ?, minimum_stock = ?, updated_at = ?
           WHERE id = ?`,
          [
            item.name,
            item.description,
            item.category,
            item.quantity,
            item.unitPrice,
            item.location,
            item.barcode || null,
            item.imageUri || null,
            item.minimumStock || null,
            new Date().toISOString(),
            item.id,
          ],
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  async deleteInventoryItem(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          'DELETE FROM inventory_items WHERE id = ?',
          [id],
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  // Orders Methods
  async getOrders(options: PaginationOptions = {}): Promise<Order[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      let sql = 'SELECT * FROM orders ORDER BY order_date DESC';
      const params: any[] = [];

      if (options.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
        
        if (options.offset) {
          sql += ' OFFSET ?';
          params.push(options.offset);
        }
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          sql,
          params,
          async (_, result) => {
            const orders: Order[] = [];
            
            for (let i = 0; i < result.rows.length; i++) {
              const row = result.rows.item(i);
              const orderItems = await this.getOrderItems(row.id);
              
              orders.push({
                id: row.id,
                orderNumber: row.order_number,
                customerId: row.customer_id,
                customerName: row.customer_name,
                items: orderItems,
                totalAmount: row.total_amount,
                status: row.status,
                orderDate: new Date(row.order_date),
                expectedDeliveryDate: row.expected_delivery_date ? new Date(row.expected_delivery_date) : undefined,
                notes: row.notes,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at),
              });
            }
            resolve(orders);
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  private async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          'SELECT * FROM order_items WHERE order_id = ?',
          [orderId],
          (_, result) => {
            const items: OrderItem[] = [];
            for (let i = 0; i < result.rows.length; i++) {
              const row = result.rows.item(i);
              items.push({
                id: row.id,
                inventoryItemId: row.inventory_item_id,
                inventoryItemName: row.inventory_item_name,
                quantity: row.quantity,
                unitPrice: row.unit_price,
                totalPrice: row.total_price,
              });
            }
            resolve(items);
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  async addOrder(order: Order): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(
        (tx) => {
          // Insert order
          tx.executeSql(
            `INSERT INTO orders 
             (id, order_number, customer_id, customer_name, total_amount, status, order_date, expected_delivery_date, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              order.id,
              order.orderNumber,
              order.customerId || null,
              order.customerName,
              order.totalAmount,
              order.status,
              order.orderDate.toISOString(),
              order.expectedDeliveryDate?.toISOString() || null,
              order.notes || null,
              order.createdAt.toISOString(),
              order.updatedAt.toISOString(),
            ]
          );

          // Insert order items
          for (const item of order.items) {
            tx.executeSql(
              `INSERT INTO order_items 
               (id, order_id, inventory_item_id, inventory_item_name, quantity, unit_price, total_price)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                item.id,
                order.id,
                item.inventoryItemId,
                item.inventoryItemName,
                item.quantity,
                item.unitPrice,
                item.totalPrice,
              ]
            );

            // Update inventory quantity
            tx.executeSql(
              'UPDATE inventory_items SET quantity = quantity - ?, updated_at = ? WHERE id = ?',
              [item.quantity, new Date().toISOString(), item.inventoryItemId]
            );
          }
        },
        (error) => reject(error),
        () => resolve()
      );
    });
  }

  // Statistics Methods
  async getInventoryStats(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          `SELECT 
            COUNT(*) as total_items,
            SUM(quantity * unit_price) as total_value,
            COUNT(CASE WHEN quantity <= minimum_stock AND minimum_stock IS NOT NULL THEN 1 END) as low_stock_items,
            COUNT(DISTINCT category_id) as categories
           FROM inventory_items`,
          [],
          (_, result) => {
            const row = result.rows.item(0);
            resolve({
              totalItems: row.total_items,
              totalValue: row.total_value || 0,
              lowStockItems: row.low_stock_items,
              categories: row.categories,
            });
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  // Utility Methods
  async clearAllData(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(
        (tx) => {
          tx.executeSql('DELETE FROM order_items');
          tx.executeSql('DELETE FROM orders');
          tx.executeSql('DELETE FROM customers');
          tx.executeSql('DELETE FROM inventory_items');
          tx.executeSql('DELETE FROM categories');
        },
        (error) => reject(error),
        () => resolve()
      );
    });
  }
}

export const databaseService = new DatabaseService();