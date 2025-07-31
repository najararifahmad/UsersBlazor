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

// New Order-related types
export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: Date;
}

export interface OrderItem {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  orderDate: Date;
  expectedDeliveryDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderFilters {
  searchText: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy: 'orderDate' | 'totalAmount' | 'status' | 'customerName';
  sortOrder: 'asc' | 'desc';
}