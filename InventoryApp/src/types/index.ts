export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  location: string;
  barcode?: string;
  imageUri?: string;
  createdAt: Date;
  updatedAt: Date;
  minimumStock?: number;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
}

export interface SearchFilters {
  searchText: string;
  category?: string;
  lowStock?: boolean;
  sortBy: 'name' | 'quantity' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
}

export interface Statistics {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  categories: number;
}