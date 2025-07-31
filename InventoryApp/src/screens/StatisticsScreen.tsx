import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { InventoryItem, Category, Statistics } from '../types';
import { storageService } from '../services/storage';

interface StatCard {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  backgroundColor: string;
}

const StatisticsScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statistics, setStatistics] = useState<Statistics>({
    totalItems: 0,
    totalValue: 0,
    lowStockItems: 0,
    categories: 0,
  });
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const loadData = async () => {
    try {
      const [inventoryItems, categoryList] = await Promise.all([
        storageService.getInventoryItems(),
        storageService.getCategories(),
      ]);

      setItems(inventoryItems);
      setCategories(categoryList);
      calculateStatistics(inventoryItems, categoryList);
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateStatistics = (items: InventoryItem[], categories: Category[]) => {
    const totalItems = items.length;
    const totalValue = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const lowStockItems = items.filter(item => 
      item.minimumStock && item.quantity <= item.minimumStock
    ).length;

    setStatistics({
      totalItems,
      totalValue,
      lowStockItems,
      categories: categories.length,
    });
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

  const getCategoryStats = () => {
    return categories.map(category => {
      const categoryItems = items.filter(item => item.category === category.id);
      const categoryValue = categoryItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      
      return {
        name: category.name,
        color: category.color,
        itemCount: categoryItems.length,
        totalValue: categoryValue,
      };
    }).sort((a, b) => b.totalValue - a.totalValue);
  };

  const getTopValueItems = () => {
    return items
      .map(item => ({
        ...item,
        totalValue: item.quantity * item.unitPrice,
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 5);
  };

  const getLowStockItems = () => {
    return items.filter(item => 
      item.minimumStock && item.quantity <= item.minimumStock
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading statistics...</Text>
      </View>
    );
  }

  const statCards: StatCard[] = [
    {
      title: 'Total Items',
      value: statistics.totalItems.toString(),
      icon: 'cube-outline',
      color: '#4F46E5',
      backgroundColor: '#EEF2FF',
    },
    {
      title: 'Total Value',
      value: `$${statistics.totalValue.toFixed(2)}`,
      icon: 'cash-outline',
      color: '#059669',
      backgroundColor: '#ECFDF5',
    },
    {
      title: 'Low Stock',
      value: statistics.lowStockItems.toString(),
      icon: 'warning-outline',
      color: '#DC2626',
      backgroundColor: '#FEF2F2',
    },
    {
      title: 'Categories',
      value: statistics.categories.toString(),
      icon: 'folder-outline',
      color: '#7C2D12',
      backgroundColor: '#FEF7ED',
    },
  ];

  const categoryStats = getCategoryStats();
  const topValueItems = getTopValueItems();
  const lowStockItems = getLowStockItems();

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Overview Cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          {statCards.map((card, index) => (
            <View key={index} style={[styles.statCard, { backgroundColor: card.backgroundColor }]}>
              <View style={styles.statHeader}>
                <Ionicons name={card.icon} size={24} color={card.color} />
                <Text style={[styles.statValue, { color: card.color }]}>{card.value}</Text>
              </View>
              <Text style={styles.statTitle}>{card.title}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Category Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Category Breakdown</Text>
        {categoryStats.length > 0 ? (
          <View style={styles.categoryContainer}>
            {categoryStats.map((category, index) => (
              <View key={category.name} style={styles.categoryItem}>
                <View style={styles.categoryHeader}>
                  <View style={[styles.categoryColor, { backgroundColor: category.color }]} />
                  <Text style={styles.categoryName}>{category.name}</Text>
                </View>
                <View style={styles.categoryStats}>
                  <Text style={styles.categoryCount}>{category.itemCount} items</Text>
                  <Text style={styles.categoryValue}>${category.totalValue.toFixed(2)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No categories found</Text>
          </View>
        )}
      </View>

      {/* Top Value Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Value Items</Text>
        {topValueItems.length > 0 ? (
          <View style={styles.itemsList}>
            {topValueItems.map((item, index) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemRank}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemDetails}>
                    {item.quantity} × ${item.unitPrice.toFixed(2)}
                  </Text>
                </View>
                <Text style={styles.itemValue}>${item.totalValue.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No items found</Text>
          </View>
        )}
      </View>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Low Stock Alert</Text>
          <View style={styles.alertContainer}>
            {lowStockItems.map(item => (
              <View key={item.id} style={styles.alertItem}>
                <Ionicons name="warning" size={20} color="#DC2626" />
                <View style={styles.alertInfo}>
                  <Text style={styles.alertItemName}>{item.name}</Text>
                  <Text style={styles.alertItemStock}>
                    {item.quantity} / {item.minimumStock} minimum
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
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
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statTitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  categoryContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  categoryStats: {
    alignItems: 'flex-end',
  },
  categoryCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  categoryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  itemsList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  itemDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  itemValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  alertContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertInfo: {
    marginLeft: 12,
    flex: 1,
  },
  alertItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#DC2626',
  },
  alertItemStock: {
    fontSize: 14,
    color: '#B91C1C',
    marginTop: 2,
  },
  emptyState: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});

export default StatisticsScreen;