import { router } from 'expo-router';
import {
  ArrowLeft,
  User,
  Lock,
  Bell,
  Shield,
  Globe,
  HelpCircle,
  LogOut,
  ChevronRight,
  Bug,
} from 'lucide-react-native';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

type IconComponent = React.ComponentType<{ color?: string; size?: number }>;

interface SettingItemProps {
  icon: IconComponent;
  title: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
  iconColor?: string;
  iconSize?: number;
  isLoading?: boolean;
}

function SettingItem({ 
  icon: IconComponent, 
  title, 
  subtitle, 
  onPress, 
  danger, 
  iconColor, 
  iconSize,
  isLoading,
}: SettingItemProps) {
  return (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      disabled={isLoading}
    >
      <View style={styles.settingIcon}>
        {isLoading ? (
          <ActivityIndicator size="small" color={iconColor ?? Colors.text} />
        ) : (
          <IconComponent color={iconColor ?? Colors.text} size={iconSize ?? 22} />
        )}
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, danger && styles.settingTitleDanger]}>
          {title}
        </Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {!danger && !isLoading && <ChevronRight color={Colors.textMuted} size={20} />}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { logout, isAuthenticated } = useAuth();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      Alert.alert('Logged Out', 'You have been logged out successfully', [
        {
          text: 'OK',
          onPress: () => {
            router.replace('/auth/login');
          },
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to logout. But logged out locally.');
      router.replace('/auth/login');
    },
  });

  const handleLogout = () => {
    if (!isAuthenticated) {
      Alert.alert('Info', 'You are not logged in');
      router.push('/auth/login');
      return;
    }

    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          logoutMutation.mutate();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <SettingItem
            icon={User}
            title="Edit Profile"
            subtitle="Update your profile information"
            onPress={() => router.push('/edit-profile')}
          />
          <SettingItem
            icon={Lock}
            title="Change Password"
            subtitle="Update your password"
            onPress={() => Alert.alert('Change Password', 'Coming soon!')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Security</Text>
          <SettingItem
            icon={Shield}
            title="Privacy Settings"
            subtitle="Control who can see your content"
            onPress={() => Alert.alert('Privacy Settings', 'Coming soon!')}
          />
          <SettingItem
            icon={Bell}
            title="Notifications"
            subtitle="Manage notification preferences"
            onPress={() => router.push('/notifications')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          <SettingItem
            icon={Globe}
            title="Language"
            subtitle="English"
            onPress={() => Alert.alert('Language', 'Coming soon!')}
          />
          <SettingItem
            icon={HelpCircle}
            title="Help & Support"
            subtitle="Get help and support"
            onPress={() => Alert.alert('Help & Support', 'Coming soon!')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Developer</Text>
          <SettingItem
            icon={Bug}
            title="API Debug Console"
            subtitle="View API requests and responses"
            onPress={() => router.push('/api-debug')}
          />
        </View>

        <View style={styles.section}>
          <SettingItem
            icon={LogOut}
            title={logoutMutation.isPending ? 'Logging out...' : 'Logout'}
            onPress={handleLogout}
            danger
            iconColor={Colors.error}
            isLoading={logoutMutation.isPending}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingVertical: 8,
    borderBottomWidth: 8,
    borderBottomColor: Colors.surface,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 12,
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  settingIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  settingTitleDanger: {
    color: Colors.error,
  },
  settingSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
