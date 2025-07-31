import { databaseService, SyncStatus } from './database';
import { InventoryItem, Category, Order, Customer } from '../types';
import { generateId } from '../utils/helpers';

// Sync configuration interface
interface SyncConfig {
  apiBaseUrl: string;
  apiKey: string;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  conflictResolution: 'client_wins' | 'server_wins' | 'newest_wins';
}

// API response interfaces
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  version?: number;
}

interface SyncResult {
  success: boolean;
  totalSynced: number;
  errors: string[];
  conflicts: ConflictItem[];
}

interface ConflictItem {
  entityType: string;
  localId: string;
  localVersion: number;
  remoteVersion: number;
  localData: any;
  remoteData: any;
}

class SyncService {
  private syncConfig: SyncConfig | null = null;
  private syncInProgress = false;
  private lastSyncTime: Date | null = null;

  async initializeSync(): Promise<void> {
    try {
      const configStr = await databaseService.getSetting('sync_config');
      if (configStr) {
        this.syncConfig = JSON.parse(configStr);
      }

      const lastSyncStr = await databaseService.getSetting('last_sync_time');
      if (lastSyncStr) {
        this.lastSyncTime = new Date(lastSyncStr);
      }

      // Initialize auto-sync if enabled
      if (this.syncConfig?.autoSyncEnabled) {
        this.startAutoSync();
      }
    } catch (error) {
      console.error('Error initializing sync service:', error);
    }
  }

  async configureSyncSettings(config: SyncConfig): Promise<void> {
    this.syncConfig = config;
    await databaseService.setSetting('sync_config', JSON.stringify(config));

    if (config.autoSyncEnabled) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  async getSyncConfiguration(): Promise<SyncConfig | null> {
    return this.syncConfig;
  }

  private autoSyncInterval: NodeJS.Timeout | null = null;

  private startAutoSync(): void {
    this.stopAutoSync(); // Clear any existing interval

    if (this.syncConfig?.syncIntervalMinutes) {
      this.autoSyncInterval = setInterval(() => {
        if (!this.syncInProgress) {
          this.performFullSync().catch(console.error);
        }
      }, this.syncConfig.syncIntervalMinutes * 60 * 1000);
    }
  }

  private stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  }

  async performFullSync(): Promise<SyncResult> {
    if (!this.syncConfig) {
      throw new Error('Sync not configured. Please configure sync settings first.');
    }

    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;
    const result: SyncResult = {
      success: true,
      totalSynced: 0,
      errors: [],
      conflicts: []
    };

    try {
      // First, pull updates from server
      await this.pullFromServer(result);

      // Then, push local changes to server
      await this.pushToServer(result);

      // Update last sync time
      this.lastSyncTime = new Date();
      await databaseService.setSetting('last_sync_time', this.lastSyncTime.toISOString());

      result.success = result.errors.length === 0;
    } catch (error) {
      console.error('Sync error:', error);
      result.success = false;
      result.errors.push(`Sync failed: ${error.message}`);
    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  private async pullFromServer(result: SyncResult): Promise<void> {
    if (!this.syncConfig) return;

    try {
      // Pull categories
      await this.pullCategories(result);

      // Pull inventory items
      await this.pullInventoryItems(result);

      // Pull customers
      await this.pullCustomers(result);

      // Pull orders
      await this.pullOrders(result);

    } catch (error) {
      result.errors.push(`Pull error: ${error.message}`);
    }
  }

  private async pullCategories(result: SyncResult): Promise<void> {
    try {
      const response = await this.apiRequest<Category[]>('GET', '/categories');
      if (response.success && response.data) {
        for (const remoteCategory of response.data) {
          await this.handleRemoteCategory(remoteCategory, result);
        }
      }
    } catch (error) {
      result.errors.push(`Categories pull error: ${error.message}`);
    }
  }

  private async pullInventoryItems(result: SyncResult): Promise<void> {
    try {
      const lastSync = this.lastSyncTime?.toISOString() || '1970-01-01T00:00:00.000Z';
      const response = await this.apiRequest<InventoryItem[]>('GET', `/inventory?since=${lastSync}`);
      
      if (response.success && response.data) {
        for (const remoteItem of response.data) {
          await this.handleRemoteInventoryItem(remoteItem, result);
        }
      }
    } catch (error) {
      result.errors.push(`Inventory pull error: ${error.message}`);
    }
  }

  private async pullCustomers(result: SyncResult): Promise<void> {
    try {
      const lastSync = this.lastSyncTime?.toISOString() || '1970-01-01T00:00:00.000Z';
      const response = await this.apiRequest<Customer[]>('GET', `/customers?since=${lastSync}`);
      
      if (response.success && response.data) {
        for (const remoteCustomer of response.data) {
          await this.handleRemoteCustomer(remoteCustomer, result);
        }
      }
    } catch (error) {
      result.errors.push(`Customers pull error: ${error.message}`);
    }
  }

  private async pullOrders(result: SyncResult): Promise<void> {
    try {
      const lastSync = this.lastSyncTime?.toISOString() || '1970-01-01T00:00:00.000Z';
      const response = await this.apiRequest<Order[]>('GET', `/orders?since=${lastSync}`);
      
      if (response.success && response.data) {
        for (const remoteOrder of response.data) {
          await this.handleRemoteOrder(remoteOrder, result);
        }
      }
    } catch (error) {
      result.errors.push(`Orders pull error: ${error.message}`);
    }
  }

  private async pushToServer(result: SyncResult): Promise<void> {
    if (!this.syncConfig) return;

    try {
      // Push categories
      await this.pushPendingItems('categories', result);

      // Push inventory items
      await this.pushPendingItems('inventory_items', result);

      // Push customers
      await this.pushPendingItems('customers', result);

      // Push orders
      await this.pushPendingItems('orders', result);

    } catch (error) {
      result.errors.push(`Push error: ${error.message}`);
    }
  }

  private async pushPendingItems(entityType: string, result: SyncResult): Promise<void> {
    try {
      const pendingItems = await databaseService.getPendingSyncItems(entityType, 100);
      
      for (const item of pendingItems) {
        try {
          const endpoint = this.getEntityEndpoint(entityType);
          let response: ApiResponse<any>;

          if (item.remote_id) {
            // Update existing item
            response = await this.apiRequest('PUT', `${endpoint}/${item.remote_id}`, item);
          } else {
            // Create new item
            response = await this.apiRequest('POST', endpoint, item);
          }

          if (response.success && response.data) {
            await databaseService.markItemSynced(entityType, item.id, response.data.id || item.remote_id);
            result.totalSynced++;
          } else {
            await databaseService.markItemSyncFailed(entityType, item.id, response.error || 'Unknown error');
            result.errors.push(`Failed to sync ${entityType} ${item.id}: ${response.error}`);
          }
        } catch (error) {
          await databaseService.markItemSyncFailed(entityType, item.id, error.message);
          result.errors.push(`Error syncing ${entityType} ${item.id}: ${error.message}`);
        }
      }
    } catch (error) {
      result.errors.push(`Push ${entityType} error: ${error.message}`);
    }
  }

  private async handleRemoteCategory(remoteCategory: any, result: SyncResult): Promise<void> {
    // Check if category exists locally
    const localCategories = await databaseService.getCategories();
    const localCategory = localCategories.find(c => c.id === remoteCategory.id);

    if (!localCategory) {
      // New category from server - add it locally
      await databaseService.addCategory(remoteCategory, true);
      await databaseService.markItemSynced('categories', remoteCategory.id, remoteCategory.id);
      result.totalSynced++;
    } else {
      // Handle potential conflict
      await this.handleDataConflict('categories', localCategory, remoteCategory, result);
    }
  }

  private async handleRemoteInventoryItem(remoteItem: any, result: SyncResult): Promise<void> {
    const localItem = await databaseService.getInventoryItemById(remoteItem.id);

    if (!localItem) {
      // New item from server
      const newItem: InventoryItem = {
        id: remoteItem.id,
        name: remoteItem.name,
        description: remoteItem.description || '',
        category: remoteItem.category_id,
        quantity: remoteItem.quantity,
        unitPrice: remoteItem.unit_price,
        location: remoteItem.location || '',
        barcode: remoteItem.barcode,
        imageUri: remoteItem.image_uri,
        minimumStock: remoteItem.minimum_stock,
        createdAt: new Date(remoteItem.created_at),
        updatedAt: new Date(remoteItem.updated_at),
      };

      await databaseService.addInventoryItem(newItem);
      await databaseService.markItemSynced('inventory_items', newItem.id, remoteItem.id);
      result.totalSynced++;
    } else {
      // Handle potential conflict
      await this.handleDataConflict('inventory_items', localItem, remoteItem, result);
    }
  }

  private async handleRemoteCustomer(remoteCustomer: any, result: SyncResult): Promise<void> {
    // Similar implementation for customers
    // ... (implement based on customer data structure)
  }

  private async handleRemoteOrder(remoteOrder: any, result: SyncResult): Promise<void> {
    // Similar implementation for orders
    // ... (implement based on order data structure)
  }

  private async handleDataConflict(entityType: string, localData: any, remoteData: any, result: SyncResult): Promise<void> {
    if (!this.syncConfig) return;

    const localVersion = localData.version || 1;
    const remoteVersion = remoteData.version || 1;

    // Create conflict item for reporting
    const conflict: ConflictItem = {
      entityType,
      localId: localData.id,
      localVersion,
      remoteVersion,
      localData,
      remoteData
    };

    // Apply conflict resolution strategy
    let shouldUseRemote = false;

    switch (this.syncConfig.conflictResolution) {
      case 'server_wins':
        shouldUseRemote = true;
        break;
      case 'client_wins':
        shouldUseRemote = false;
        break;
      case 'newest_wins':
        const localUpdated = new Date(localData.updated_at);
        const remoteUpdated = new Date(remoteData.updated_at);
        shouldUseRemote = remoteUpdated > localUpdated;
        break;
    }

    if (shouldUseRemote) {
      // Update local data with remote data
      if (entityType === 'inventory_items') {
        const updatedItem: InventoryItem = {
          ...localData,
          name: remoteData.name,
          description: remoteData.description || '',
          category: remoteData.category_id,
          quantity: remoteData.quantity,
          unitPrice: remoteData.unit_price,
          location: remoteData.location || '',
          barcode: remoteData.barcode,
          imageUri: remoteData.image_uri,
          minimumStock: remoteData.minimum_stock,
          updatedAt: new Date(remoteData.updated_at),
        };
        await databaseService.updateInventoryItem(updatedItem);
      }
      // Handle other entity types...

      await databaseService.markItemSynced(entityType, localData.id, remoteData.id);
      result.totalSynced++;
    } else {
      // Keep local data, but mark the conflict
      result.conflicts.push(conflict);
    }
  }

  private getEntityEndpoint(entityType: string): string {
    const endpoints = {
      'categories': '/categories',
      'inventory_items': '/inventory',
      'customers': '/customers',
      'orders': '/orders'
    };
    return endpoints[entityType] || `/${entityType}`;
  }

  private async apiRequest<T>(method: string, endpoint: string, data?: any): Promise<ApiResponse<T>> {
    if (!this.syncConfig) {
      throw new Error('Sync not configured');
    }

    const url = `${this.syncConfig.apiBaseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.syncConfig.apiKey}`,
    };

    try {
      const config: RequestInit = {
        method,
        headers,
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        config.body = JSON.stringify(data);
      }

      const response = await fetch(url, config);
      const responseData = await response.json();

      if (response.ok) {
        return {
          success: true,
          data: responseData,
          version: responseData.version
        };
      } else {
        return {
          success: false,
          error: responseData.message || `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Network error: ${error.message}`
      };
    }
  }

  // Public methods for manual sync operations
  async syncSingleItem(entityType: string, itemId: string): Promise<boolean> {
    if (!this.syncConfig) {
      throw new Error('Sync not configured');
    }

    try {
      const pendingItems = await databaseService.getPendingSyncItems(entityType, 1000);
      const item = pendingItems.find(i => i.id === itemId);

      if (!item) {
        return false; // Item not found or already synced
      }

      const endpoint = this.getEntityEndpoint(entityType);
      let response: ApiResponse<any>;

      if (item.remote_id) {
        response = await this.apiRequest('PUT', `${endpoint}/${item.remote_id}`, item);
      } else {
        response = await this.apiRequest('POST', endpoint, item);
      }

      if (response.success && response.data) {
        await databaseService.markItemSynced(entityType, item.id, response.data.id || item.remote_id);
        return true;
      } else {
        await databaseService.markItemSyncFailed(entityType, item.id, response.error || 'Unknown error');
        return false;
      }
    } catch (error) {
      await databaseService.markItemSyncFailed(entityType, itemId, error.message);
      return false;
    }
  }

  async getSyncStatus(): Promise<{
    isConfigured: boolean;
    lastSyncTime: Date | null;
    syncInProgress: boolean;
    pendingItems: number;
    failedItems: number;
    syncedItems: number;
  }> {
    const stats = await databaseService.getSyncStats();
    
    return {
      isConfigured: this.syncConfig !== null,
      lastSyncTime: this.lastSyncTime,
      syncInProgress: this.syncInProgress,
      pendingItems: stats.pending,
      failedItems: stats.failed,
      syncedItems: stats.synced,
    };
  }

  async resetSyncStatus(): Promise<void> {
    // Mark all items as pending sync
    // This is useful when changing sync configurations or after errors
    // Implementation would reset sync_status for all entities
  }

  async exportForBackup(): Promise<string> {
    return await databaseService.exportData();
  }

  async importFromBackup(jsonData: string): Promise<void> {
    await databaseService.importData(jsonData);
  }
}

export const syncService = new SyncService();