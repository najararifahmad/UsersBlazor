import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { InventoryItem, Category } from '../types';
import { RootStackParamList } from '../navigation/AppNavigator';
import { storageService } from '../services/storage';

type ItemDetailScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ItemDetail'
>;

type ItemDetailScreenRouteProp = RouteProp<RootStackParamList, 'ItemDetail'>;

interface Props {
  navigation: ItemDetailScreenNavigationProp;
  route: ItemDetailScreenRouteProp;
}

const ItemDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { itemId } = route.params;
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItem();
  }, [itemId]);

  const loadItem = async () => {
    try {
      setLoading(true);
      const [inventoryItem, categories] = await Promise.all([
        storageService.getInventoryItemById(itemId),
        storageService.getCategories(),
      ]);

      if (!inventoryItem) {
        Alert.alert('Error', 'Item not found', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
        return;
      }

      setItem(inventoryItem);
      const itemCategory = categories.find(cat => cat.id === inventoryItem.category);
      setCategory(itemCategory || null);
    } catch (error) {
      console.error('Error loading item:', error);
      Alert.alert('Error', 'Failed to load item details');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigation.navigate('EditItem', { itemId });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      ]
    );
  };

  const confirmDelete = async () => {
    try {
      await storageService.deleteInventoryItem(itemId);
      Alert.alert('Success', 'Item deleted successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error deleting item:', error);
      Alert.alert('Error', 'Failed to delete item');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading item details...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#DC2626" />
        <Text style={styles.errorText}>Item not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isLowStock = item.minimumStock && item.quantity <= item.minimumStock;
  const totalValue = item.quantity * item.unitPrice;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Item Image */}
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.itemImage} />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="image-outline" size={64} color="#9CA3AF" />
          </View>
        )}

        {/* Item Name and Category */}
        <View style={styles.header}>
          <Text style={styles.itemName}>{item.name}</Text>
          {category && (
            <View style={[styles.categoryBadge, { backgroundColor: category.color }]}>
              <Text style={styles.categoryText}>{category.name}</Text>
            </View>
          )}
        </View>

        {/* Stock Status */}
        {isLowStock && (
          <View style={styles.lowStockAlert}>
            <Ionicons name="warning" size={20} color="#DC2626" />
            <Text style={styles.lowStockText}>Low Stock Alert</Text>
          </View>
        )}

        {/* Description */}
        {item.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        )}

        {/* Details Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Item Details</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Quantity</Text>
              <Text style={styles.detailValue}>{item.quantity}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Unit Price</Text>
              <Text style={styles.detailValue}>${item.unitPrice.toFixed(2)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Total Value</Text>
              <Text style={styles.detailValue}>${totalValue.toFixed(2)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>{item.location}</Text>
            </View>
            {item.barcode && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Barcode</Text>
                <Text style={styles.detailValue}>{item.barcode}</Text>
              </View>
            )}
            {item.minimumStock && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Minimum Stock</Text>
                <Text style={styles.detailValue}>{item.minimumStock}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Timestamps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timestamps</Text>
          <View style={styles.timestampsContainer}>
            <Text style={styles.timestamp}>
              Created: {item.createdAt.toLocaleDateString()}
            </Text>
            <Text style={styles.timestamp}>
              Updated: {item.updatedAt.toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
            <Ionicons name="create-outline" size={20} color="#fff" />
            <Text style={styles.editButtonText}>Edit Item</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 16,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    color: '#374151',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  itemImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  placeholderImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  itemName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  lowStockAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  lowStockText: {
    color: '#DC2626',
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  detailsGrid: {
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },
  timestampsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
  },
  timestamp: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ItemDetailScreen;