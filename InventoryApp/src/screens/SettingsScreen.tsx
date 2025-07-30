import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { syncService } from '../services/syncService';
import { databaseService } from '../services/database';

interface SyncConfig {
  apiBaseUrl: string;
  apiKey: string;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  conflictResolution: 'client_wins' | 'server_wins' | 'newest_wins';
}

const SettingsScreen: React.FC = () => {
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    apiBaseUrl: '',
    apiKey: '',
    autoSyncEnabled: false,
    syncIntervalMinutes: 30,
    conflictResolution: 'newest_wins',
  });

  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(false);

  useEffect(() => {
    loadSettings();
    loadSyncStatus();
  }, []);

  const loadSettings = async () => {
    try {
      const config = await syncService.getSyncConfiguration();
      if (config) {
        setSyncConfig(config);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const status = await syncService.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  };

  const saveSyncSettings = async () => {
    try {
      setLoading(true);
      await syncService.configureSyncSettings(syncConfig);
      await syncService.initializeSync();
      Alert.alert('Success', 'Sync settings saved successfully');
      await loadSyncStatus();
    } catch (error) {
      Alert.alert('Error', `Failed to save settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const performManualSync = async () => {
    if (!syncStatus?.isConfigured) {
      Alert.alert('Error', 'Please configure sync settings first');
      return;
    }

    try {
      setSyncInProgress(true);
      const result = await syncService.performFullSync();
      
      if (result.success) {
        Alert.alert(
          'Sync Complete',
          `Successfully synced ${result.totalSynced} items${
            result.conflicts.length > 0 ? `\n${result.conflicts.length} conflicts detected` : ''
          }`
        );
      } else {
        Alert.alert(
          'Sync Failed',
          `Errors: ${result.errors.join('\n')}`
        );
      }
      
      await loadSyncStatus();
    } catch (error) {
      Alert.alert('Error', `Sync failed: ${error.message}`);
    } finally {
      setSyncInProgress(false);
    }
  };

  const testConnection = async () => {
    if (!syncConfig.apiBaseUrl || !syncConfig.apiKey) {
      Alert.alert('Error', 'Please enter API URL and key first');
      return;
    }

    setLoading(true);
    try {
      // Test the connection by trying to fetch categories
      const response = await fetch(`${syncConfig.apiBaseUrl}/categories`, {
        headers: {
          'Authorization': `Bearer ${syncConfig.apiKey}`,
        },
      });

      if (response.ok) {
        Alert.alert('Success', 'Connection test successful!');
      } else {
        Alert.alert('Error', `Connection failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      Alert.alert('Error', `Connection failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearAllData = async () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all inventory data. This action cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await databaseService.clearAllData();
              Alert.alert('Success', 'All data cleared successfully');
              await loadSyncStatus();
            } catch (error) {
              Alert.alert('Error', `Failed to clear data: ${error.message}`);
            }
          },
        },
      ]
    );
  };

  const exportData = async () => {
    try {
      setLoading(true);
      const exportData = await syncService.exportForBackup();
      // In a real app, you would save this to file system or share it
      Alert.alert(
        'Export Complete',
        'Data exported successfully. In a production app, this would be saved to a file.',
        [
          { text: 'OK' },
          {
            text: 'Copy to Clipboard',
            onPress: () => {
              // In React Native, you would use @react-native-clipboard/clipboard
              console.log('Export data:', exportData);
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', `Failed to export data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatLastSyncTime = (time: Date | null): string => {
    if (!time) return 'Never';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(time);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Sync Status Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sync Status</Text>
        {syncStatus && (
          <View style={styles.statusContainer}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Configuration:</Text>
              <View style={[styles.statusBadge, syncStatus.isConfigured ? styles.statusSuccess : styles.statusError]}>
                <Text style={[styles.statusBadgeText, syncStatus.isConfigured ? styles.statusSuccessText : styles.statusErrorText]}>
                  {syncStatus.isConfigured ? 'Configured' : 'Not Configured'}
                </Text>
              </View>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Last Sync:</Text>
              <Text style={styles.statusValue}>{formatLastSyncTime(syncStatus.lastSyncTime)}</Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Pending:</Text>
              <Text style={styles.statusValue}>{syncStatus.pendingItems} items</Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Failed:</Text>
              <Text style={styles.statusValue}>{syncStatus.failedItems} items</Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Synced:</Text>
              <Text style={styles.statusValue}>{syncStatus.syncedItems} items</Text>
            </View>
          </View>
        )}
        
        <TouchableOpacity
          style={[styles.syncButton, syncInProgress && styles.syncButtonDisabled]}
          onPress={performManualSync}
          disabled={syncInProgress || !syncStatus?.isConfigured}
        >
          {syncInProgress ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="sync" size={20} color="#fff" />
          )}
          <Text style={styles.syncButtonText}>
            {syncInProgress ? 'Syncing...' : 'Sync Now'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sync Configuration */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cloud Sync Configuration</Text>
        
        <Text style={styles.label}>API Base URL</Text>
        <TextInput
          style={styles.input}
          value={syncConfig.apiBaseUrl}
          onChangeText={(text) => setSyncConfig(prev => ({ ...prev, apiBaseUrl: text }))}
          placeholder="https://your-api.com/api/v1"
          keyboardType="url"
          autoCapitalize="none"
        />
        
        <Text style={styles.label}>API Key</Text>
        <TextInput
          style={styles.input}
          value={syncConfig.apiKey}
          onChangeText={(text) => setSyncConfig(prev => ({ ...prev, apiKey: text }))}
          placeholder="Your API key"
          secureTextEntry
          autoCapitalize="none"
        />
        
        <TouchableOpacity style={styles.testButton} onPress={testConnection} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#4F46E5" />
          ) : (
            <Ionicons name="wifi" size={16} color="#4F46E5" />
          )}
          <Text style={styles.testButtonText}>Test Connection</Text>
        </TouchableOpacity>
        
        <View style={styles.switchContainer}>
          <Text style={styles.label}>Enable Auto Sync</Text>
          <Switch
            value={syncConfig.autoSyncEnabled}
            onValueChange={(value) => setSyncConfig(prev => ({ ...prev, autoSyncEnabled: value }))}
            trackColor={{ false: '#767577', true: '#4F46E5' }}
            thumbColor={syncConfig.autoSyncEnabled ? '#fff' : '#f4f3f4'}
          />
        </View>
        
        {syncConfig.autoSyncEnabled && (
          <>
            <Text style={styles.label}>Sync Interval (minutes)</Text>
            <TextInput
              style={styles.input}
              value={syncConfig.syncIntervalMinutes.toString()}
              onChangeText={(text) => setSyncConfig(prev => ({ 
                ...prev, 
                syncIntervalMinutes: parseInt(text) || 30 
              }))}
              placeholder="30"
              keyboardType="numeric"
            />
          </>
        )}
        
        <Text style={styles.label}>Conflict Resolution</Text>
        <View style={styles.radioGroup}>
          {[
            { value: 'newest_wins', label: 'Newest Wins (Recommended)' },
            { value: 'client_wins', label: 'Local Changes Win' },
            { value: 'server_wins', label: 'Server Changes Win' },
          ].map((option) => (
            <TouchableOpacity
              key={option.value}
              style={styles.radioOption}
              onPress={() => setSyncConfig(prev => ({ 
                ...prev, 
                conflictResolution: option.value as any 
              }))}
            >
              <Ionicons
                name={syncConfig.conflictResolution === option.value ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color="#4F46E5"
              />
              <Text style={styles.radioLabel}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <TouchableOpacity style={styles.saveButton} onPress={saveSyncSettings} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="save" size={16} color="#fff" />
          )}
          <Text style={styles.saveButtonText}>Save Sync Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Data Management */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Data Management</Text>
        
        <TouchableOpacity style={styles.actionButton} onPress={exportData} disabled={loading}>
          <Ionicons name="download" size={20} color="#059669" />
          <Text style={styles.actionButtonText}>Export Data</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={() => {
          Alert.alert('Import Data', 'Data import functionality would be implemented here');
        }}>
          <Ionicons name="cloud-upload" size={20} color="#0EA5E9" />
          <Text style={styles.actionButtonText}>Import Data</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={clearAllData}>
          <Ionicons name="trash" size={20} color="#DC2626" />
          <Text style={[styles.actionButtonText, styles.dangerButtonText]}>Clear All Data</Text>
        </TouchableOpacity>
      </View>

      {/* App Information */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>App Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version:</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Database:</Text>
          <Text style={styles.infoValue}>SQLite with Sync</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Platform:</Text>
          <Text style={styles.infoValue}>Cross-Platform (Expo)</Text>
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
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  statusContainer: {
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusSuccess: {
    backgroundColor: '#D1FAE5',
  },
  statusError: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusSuccessText: {
    color: '#059669',
  },
  statusErrorText: {
    color: '#DC2626',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  radioGroup: {
    marginTop: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  radioLabel: {
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#4F46E5',
    borderRadius: 8,
    marginTop: 8,
  },
  testButtonText: {
    marginLeft: 8,
    color: '#4F46E5',
    fontWeight: '500',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  saveButtonText: {
    marginLeft: 8,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  syncButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  syncButtonText: {
    marginLeft: 8,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  dangerButton: {
    borderColor: '#DC2626',
  },
  actionButtonText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#374151',
  },
  dangerButtonText: {
    color: '#DC2626',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
});

export default SettingsScreen;