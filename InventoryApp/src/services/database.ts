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

// Sync status enum
export enum SyncStatus {
  SYNCED = 'synced',
  PENDING = 'pending',
  FAILED = 'failed',
  CONFLICT = 'conflict'
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
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              sync_status TEXT DEFAULT 'pending',
              last_synced_at DATETIME,
              remote_id TEXT,
              version INTEGER DEFAULT 1
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
              sync_status TEXT DEFAULT 'pending',
              last_synced_at DATETIME,
              remote_id TEXT,
              version INTEGER DEFAULT 1,
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
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              sync_status TEXT DEFAULT 'pending',
              last_synced_at DATETIME,
              remote_id TEXT,
              version INTEGER DEFAULT 1
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
              sync_status TEXT DEFAULT 'pending',
              last_synced_at DATETIME,
              remote_id TEXT,
              version INTEGER DEFAULT 1,
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
              sync_status TEXT DEFAULT 'pending',
              last_synced_at DATETIME,
              remote_id TEXT,
              version INTEGER DEFAULT 1,
              FOREIGN KEY (order_id) REFERENCES orders (id),
              FOREIGN KEY (inventory_item_id) REFERENCES inventory_items (id)
            );
          `);

          // Sync log table for tracking sync operations
          tx.executeSql(`
            CREATE TABLE IF NOT EXISTS sync_log (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              entity_type TEXT NOT NULL,
              entity_id TEXT NOT NULL,
              operation TEXT NOT NULL,
              sync_status TEXT NOT NULL,
              error_message TEXT,
              attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              completed_at DATETIME
            );
          `);

          // App settings table for sync configuration
          tx.executeSql(`
            CREATE TABLE IF NOT EXISTS app_settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
          `);

          // Create indexes for better performance
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory_items (name);');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items (category_id);');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory_items (quantity);');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_inventory_sync ON inventory_items (sync_status);');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_orders_date ON orders (order_date);');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_id);');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_orders_sync ON orders (sync_status);');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_sync_log_entity ON sync_log (entity_type, entity_id);');
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
        ? 'INSERT OR IGNORE INTO categories (id, name, description, color, sync_status, version) VALUES (?, ?, ?, ?, ?, ?)'
        : 'INSERT INTO categories (id, name, description, color, sync_status, version) VALUES (?, ?, ?, ?, ?, ?)';

      this.db.transaction((tx) => {
        tx.executeSql(
          sql,
          [category.id, category.name, category.description || null, category.color, SyncStatus.PENDING, 1],
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  // Inventory Items Methods with Sync Support
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

  async addInventoryItem(item: InventoryItem): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          `INSERT INTO inventory_items 
           (id, name, description, category_id, quantity, unit_price, location, barcode, image_uri, minimum_stock, created_at, updated_at, sync_status, version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            SyncStatus.PENDING,
            1
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
           location = ?, barcode = ?, image_uri = ?, minimum_stock = ?, updated_at = ?,
           sync_status = ?, version = version + 1
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
            SyncStatus.PENDING,
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

  // Sync-related methods
  async getPendingSyncItems(entityType: string, limit: number = 50): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          `SELECT * FROM ${entityType} WHERE sync_status = ? LIMIT ?`,
          [SyncStatus.PENDING, limit],
          (_, result) => {
            const items: any[] = [];
            for (let i = 0; i < result.rows.length; i++) {
              items.push(result.rows.item(i));
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

  async markItemSynced(entityType: string, localId: string, remoteId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          `UPDATE ${entityType} SET sync_status = ?, last_synced_at = ?, remote_id = ? WHERE id = ?`,
          [SyncStatus.SYNCED, new Date().toISOString(), remoteId, localId],
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  async markItemSyncFailed(entityType: string, localId: string, errorMessage: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          `UPDATE ${entityType} SET sync_status = ? WHERE id = ?`,
          [SyncStatus.FAILED, localId],
          () => {
            // Log the sync failure
            tx.executeSql(
              `INSERT INTO sync_log (entity_type, entity_id, operation, sync_status, error_message, completed_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [entityType, localId, 'sync', SyncStatus.FAILED, errorMessage, new Date().toISOString()]
            );
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  async getSyncStats(): Promise<{pending: number, failed: number, synced: number}> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          `SELECT 
            COUNT(CASE WHEN sync_status = 'pending' THEN 1 END) as pending,
            COUNT(CASE WHEN sync_status = 'failed' THEN 1 END) as failed,
            COUNT(CASE WHEN sync_status = 'synced' THEN 1 END) as synced
           FROM (
             SELECT sync_status FROM inventory_items
             UNION ALL
             SELECT sync_status FROM orders
             UNION ALL
             SELECT sync_status FROM customers
             UNION ALL
             SELECT sync_status FROM categories
           )`,
          [],
          (_, result) => {
            const row = result.rows.item(0);
            resolve({
              pending: row.pending || 0,
              failed: row.failed || 0,
              synced: row.synced || 0,
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

  // App Settings for Sync Configuration
  async getSetting(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          'SELECT value FROM app_settings WHERE key = ?',
          [key],
          (_, result) => {
            if (result.rows.length > 0) {
              resolve(result.rows.item(0).value);
            } else {
              resolve(null);
            }
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  async setSetting(key: string, value: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
          [key, value, new Date().toISOString()],
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  // Keep other methods from previous implementation...
  async getInventoryItemById(id: string): Promise<InventoryItem | null> {
    const items = await this.getInventoryItems({ searchText: undefined, limit: 1 });
    return items.find(item => item.id === id) || null;
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
          tx.executeSql('DELETE FROM sync_log');
        },
        (error) => reject(error),
        () => resolve()
      );
    });
  }
}

export const databaseService = new DatabaseService();