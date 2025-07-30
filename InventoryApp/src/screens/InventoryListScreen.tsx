import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { InventoryItem, SearchFilters, Category } from '../types';
import { RootStackParamList } from '../navigation/AppNavigator';
import { storageService } from '../services/storage';
import { filterAndSortItems } from '../utils/helpers';
import InventoryCard from '../components/InventoryCard';

type InventoryListScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'MainTabs'
>;

interface Props {
  navigation: InventoryListScreenNavigationProp;
}

const InventoryListScreen: React.FC<Props> = ({ navigation }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    searchText: '',
    category: undefined,
    lowStock: false,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  const loadData = async () => {
    try {
      const [inventoryItems, categoryList] = await Promise.all([
        storageService.getInventoryItems(),
        storageService.getCategories(),
      ]);
      setItems(inventoryItems);
      setCategories(categoryList);
    } catch (error) {
      Alert.alert('Error', 'Failed to load inventory data');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    const filtered = filterAndSortItems(items, filters);
    setFilteredItems(filtered);
  }, [items, filters]);

  const handleSearch = (text: string) => {
    setFilters(prev => ({ ...prev, searchText: text }));
  };

  const toggleLowStockFilter = () => {
    setFilters(prev => ({ ...prev, lowStock: !prev.lowStock }));
  };

  const handleCategoryFilter = (categoryId: string) => {
    setFilters(prev => ({
      ...prev,
      category: categoryId === 'all' ? undefined : categoryId,
    }));
  };

  const handleSort = (sortBy: SearchFilters['sortBy']) => {
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleItemPress = (item: InventoryItem) => {
    navigation.navigate('ItemDetail', { itemId: item.id });
  };

  const handleEditItem = (item: InventoryItem) => {
    navigation.navigate('EditItem', { itemId: item.id });
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    try {
      await storageService.deleteInventoryItem(item.id);
      await loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete item');
      console.error('Error deleting item:', error);
    }
  };

  const renderItem = ({ item }: { item: InventoryItem }) => (
    <InventoryCard
      item={item}
      onPress={() => handleItemPress(item)}
      onEdit={() => handleEditItem(item)}
      onDelete={() => handleDeleteItem(item)}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="archive-outline" size={64} color="#9CA3AF" />
      <Text style={styles.emptyStateTitle}>No Items Found</Text>
      <Text style={styles.emptyStateText}>
        {filters.searchText || filters.category || filters.lowStock
          ? 'Try adjusting your search filters'
          : 'Start by adding your first inventory item'}
      </Text>
      {!filters.searchText && !filters.category && !filters.lowStock && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddItem')}
        >
          <Text style={styles.addButtonText}>Add First Item</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items..."
            value={filters.searchText}
            onChangeText={handleSearch}
          />
        </View>
      </View>

      {/* Filter Controls */}
      <View style={styles.filtersContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filters.lowStock && styles.filterButtonActive]}
          onPress={toggleLowStockFilter}
        >
          <Ionicons 
            name={filters.lowStock ? "warning" : "warning-outline"} 
            size={16} 
            color={filters.lowStock ? "#fff" : "#DC2626"} 
          />
          <Text style={[styles.filterButtonText, filters.lowStock && styles.filterButtonTextActive]}>
            Low Stock
          </Text>
        </TouchableOpacity>

        {/* Category Picker */}
        <View style={styles.categoryContainer}>
          <TouchableOpacity
            style={[styles.categoryButton, !filters.category && styles.categoryButtonActive]}
            onPress={() => handleCategoryFilter('all')}
          >
            <Text style={[styles.categoryButtonText, !filters.category && styles.categoryButtonTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {categories.map(category => (
            <TouchableOpacity
              key={category.id}
              style={[styles.categoryButton, filters.category === category.id && styles.categoryButtonActive]}
              onPress={() => handleCategoryFilter(category.id)}
            >
              <Text style={[styles.categoryButtonText, filters.category === category.id && styles.categoryButtonTextActive]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Sort Controls */}
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        {[
          { key: 'name', label: 'Name' },
          { key: 'quantity', label: 'Quantity' },
          { key: 'updatedAt', label: 'Updated' },
        ].map(sort => (
          <TouchableOpacity
            key={sort.key}
            style={[styles.sortButton, filters.sortBy === sort.key && styles.sortButtonActive]}
            onPress={() => handleSort(sort.key as SearchFilters['sortBy'])}
          >
            <Text style={[styles.sortButtonText, filters.sortBy === sort.key && styles.sortButtonTextActive]}>
              {sort.label}
            </Text>
            {filters.sortBy === sort.key && (
              <Ionicons 
                name={filters.sortOrder === 'asc' ? 'chevron-up' : 'chevron-down'} 
                size={16} 
                color="#fff" 
              />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Items List */}
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddItem')}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  filtersContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DC2626',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#DC2626',
  },
  filterButtonText: {
    marginLeft: 4,
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  categoryContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
  },
  categoryButtonActive: {
    backgroundColor: '#4F46E5',
  },
  categoryButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sortLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 12,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
  },
  sortButtonActive: {
    backgroundColor: '#4F46E5',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  sortButtonTextActive: {
    color: '#fff',
  },
  listContainer: {
    paddingBottom: 80,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 64,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default InventoryListScreen;