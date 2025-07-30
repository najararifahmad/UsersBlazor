import { v4 as uuidv4 } from 'uuid';
import { InventoryItem, SearchFilters, Statistics } from '../types';

export const generateId = (): string => {
  return uuidv4();
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const filterAndSortItems = (
  items: InventoryItem[],
  filters: SearchFilters
): InventoryItem[] => {
  let filteredItems = [...items];

  // Filter by search text
  if (filters.searchText.trim()) {
    const searchLower = filters.searchText.toLowerCase();
    filteredItems = filteredItems.filter(item =>
      item.name.toLowerCase().includes(searchLower) ||
      item.description.toLowerCase().includes(searchLower) ||
      item.location.toLowerCase().includes(searchLower) ||
      item.barcode?.toLowerCase().includes(searchLower)
    );
  }

  // Filter by category
  if (filters.category && filters.category !== 'all') {
    filteredItems = filteredItems.filter(item => item.category === filters.category);
  }

  // Filter low stock items
  if (filters.lowStock) {
    filteredItems = filteredItems.filter(item => 
      item.minimumStock && item.quantity <= item.minimumStock
    );
  }

  // Sort items
  filteredItems.sort((a, b) => {
    let aValue: any, bValue: any;

    switch (filters.sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'quantity':
        aValue = a.quantity;
        bValue = b.quantity;
        break;
      case 'createdAt':
        aValue = a.createdAt.getTime();
        bValue = b.createdAt.getTime();
        break;
      case 'updatedAt':
        aValue = a.updatedAt.getTime();
        bValue = b.updatedAt.getTime();
        break;
      default:
        return 0;
    }

    if (filters.sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  return filteredItems;
};

export const calculateStatistics = (items: InventoryItem[]): Statistics => {
  const totalItems = items.length;
  const totalValue = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const lowStockItems = items.filter(item => 
    item.minimumStock && item.quantity <= item.minimumStock
  ).length;
  const categories = new Set(items.map(item => item.category)).size;

  return {
    totalItems,
    totalValue,
    lowStockItems,
    categories,
  };
};

export const validateInventoryItem = (item: Partial<InventoryItem>): string[] => {
  const errors: string[] = [];

  if (!item.name || item.name.trim().length === 0) {
    errors.push('Name is required');
  }

  if (!item.category || item.category.trim().length === 0) {
    errors.push('Category is required');
  }

  if (!item.location || item.location.trim().length === 0) {
    errors.push('Location is required');
  }

  if (item.quantity === undefined || item.quantity < 0) {
    errors.push('Quantity must be a non-negative number');
  }

  if (item.unitPrice === undefined || item.unitPrice < 0) {
    errors.push('Unit price must be a non-negative number');
  }

  if (item.minimumStock !== undefined && item.minimumStock < 0) {
    errors.push('Minimum stock must be a non-negative number');
  }

  return errors;
};