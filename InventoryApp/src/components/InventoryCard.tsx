import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InventoryItem } from '../types';
import { formatCurrency } from '../utils/helpers';

interface InventoryCardProps {
  item: InventoryItem;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const InventoryCard: React.FC<InventoryCardProps> = ({
  item,
  onPress,
  onEdit,
  onDelete,
}) => {
  const isLowStock = item.minimumStock && item.quantity <= item.minimumStock;
  const totalValue = item.quantity * item.unitPrice;

  const handleDelete = () => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.name}>{item.name}</Text>
          {isLowStock && (
            <View style={styles.lowStockBadge}>
              <Ionicons name="warning" size={12} color="#DC2626" />
              <Text style={styles.lowStockText}>Low Stock</Text>
            </View>
          )}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
            <Ionicons name="pencil" size={20} color="#4F46E5" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.actionButton}>
            <Ionicons name="trash" size={20} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Ionicons name="pricetag" size={16} color="#6B7280" />
          <Text style={styles.detailText}>{item.category}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={16} color="#6B7280" />
          <Text style={styles.detailText}>{item.location}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.quantityContainer}>
          <Text style={styles.quantityLabel}>Quantity:</Text>
          <Text style={[styles.quantity, isLowStock && styles.lowStockQuantity]}>
            {item.quantity}
          </Text>
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.unitPrice}>{formatCurrency(item.unitPrice)} each</Text>
          <Text style={styles.totalValue}>Total: {formatCurrency(totalValue)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  lowStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  lowStockText: {
    fontSize: 12,
    color: '#DC2626',
    marginLeft: 4,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  details: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 8,
  },
  quantity: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
  },
  lowStockQuantity: {
    color: '#DC2626',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  unitPrice: {
    fontSize: 14,
    color: '#6B7280',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
});

export default InventoryCard;