import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { InventoryItem, Category } from '../types';
import { RootStackParamList } from '../navigation/AppNavigator';
import { storageService } from '../services/storage';

type EditItemScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'EditItem'
>;

type EditItemScreenRouteProp = RouteProp<RootStackParamList, 'EditItem'>;

interface Props {
  navigation: EditItemScreenNavigationProp;
  route: EditItemScreenRouteProp;
}

const EditItemScreen: React.FC<Props> = ({ navigation, route }) => {
  const { itemId } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    name: '',
    description: '',
    category: '',
    quantity: 0,
    unitPrice: 0,
    location: '',
    barcode: '',
    imageUri: '',
    minimumStock: 0,
  });

  useEffect(() => {
    loadData();
  }, [itemId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [item, categoryList] = await Promise.all([
        storageService.getInventoryItemById(itemId),
        storageService.getCategories(),
      ]);

      if (!item) {
        Alert.alert('Error', 'Item not found', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
        return;
      }

      setFormData({
        name: item.name,
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        location: item.location,
        barcode: item.barcode || '',
        imageUri: item.imageUri || '',
        minimumStock: item.minimumStock || 0,
      });
      setCategories(categoryList);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load item data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof InventoryItem, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      handleInputChange('imageUri', result.assets[0].uri);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.name?.trim()) {
      Alert.alert('Validation Error', 'Please enter an item name');
      return false;
    }
    if (!formData.category) {
      Alert.alert('Validation Error', 'Please select a category');
      return false;
    }
    if (!formData.quantity || formData.quantity < 0) {
      Alert.alert('Validation Error', 'Please enter a valid quantity');
      return false;
    }
    if (!formData.unitPrice || formData.unitPrice < 0) {
      Alert.alert('Validation Error', 'Please enter a valid unit price');
      return false;
    }
    if (!formData.location?.trim()) {
      Alert.alert('Validation Error', 'Please enter a location');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      
      const updatedItem: InventoryItem = {
        id: itemId,
        name: formData.name!.trim(),
        description: formData.description?.trim() || '',
        category: formData.category!,
        quantity: Number(formData.quantity),
        unitPrice: Number(formData.unitPrice),
        location: formData.location!.trim(),
        barcode: formData.barcode?.trim(),
        imageUri: formData.imageUri?.trim(),
        minimumStock: Number(formData.minimumStock) || 0,
        createdAt: new Date(), // This will be preserved by the storage service
        updatedAt: new Date(),
      };

      await storageService.updateInventoryItem(updatedItem);
      
      Alert.alert(
        'Success', 
        'Item updated successfully!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error saving item:', error);
      Alert.alert('Error', 'Failed to update item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Discard Changes',
      'Are you sure you want to discard your changes?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading item...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.form}>
        {/* Item Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Item Name *</Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(value) => handleInputChange('name', value)}
            placeholder="Enter item name"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(value) => handleInputChange('description', value)}
            placeholder="Enter item description"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Category */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Category *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.category}
              onValueChange={(value) => handleInputChange('category', value)}
              style={styles.picker}
            >
              <Picker.Item label="Select a category..." value="" />
              {categories.map(category => (
                <Picker.Item 
                  key={category.id} 
                  label={category.name} 
                  value={category.id} 
                />
              ))}
            </Picker>
          </View>
        </View>

        {/* Quantity and Unit Price Row */}
        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Quantity *</Text>
            <TextInput
              style={styles.input}
              value={String(formData.quantity)}
              onChangeText={(value) => handleInputChange('quantity', parseInt(value) || 0)}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
          </View>

          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Unit Price *</Text>
            <TextInput
              style={styles.input}
              value={String(formData.unitPrice)}
              onChangeText={(value) => handleInputChange('unitPrice', parseFloat(value) || 0)}
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Location */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Location *</Text>
          <TextInput
            style={styles.input}
            value={formData.location}
            onChangeText={(value) => handleInputChange('location', value)}
            placeholder="Enter storage location"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Barcode and Minimum Stock Row */}
        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Barcode</Text>
            <TextInput
              style={styles.input}
              value={formData.barcode}
              onChangeText={(value) => handleInputChange('barcode', value)}
              placeholder="Scan or enter barcode"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Minimum Stock</Text>
            <TextInput
              style={styles.input}
              value={String(formData.minimumStock)}
              onChangeText={(value) => handleInputChange('minimumStock', parseInt(value) || 0)}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Image */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Item Image</Text>
          <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
            {formData.imageUri ? (
              <Image source={{ uri: formData.imageUri }} style={styles.imagePreview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera-outline" size={32} color="#9CA3AF" />
                <Text style={styles.imageButtonText}>Tap to add image</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.cancelButton]} 
            onPress={handleCancel}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.saveButton]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Update Item</Text>
              </>
            )}
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
  contentContainer: {
    paddingBottom: 20,
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
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
  },
  picker: {
    height: 50,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    flex: 0.48,
  },
  imageButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imageButtonText: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    backgroundColor: '#4F46E5',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});

export default EditItemScreen;