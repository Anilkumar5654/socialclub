import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import {
  Users,
  FileText,
  AlertTriangle,
  DollarSign,
  BarChart3,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  ChevronRight,
  Shield,
  Ban,
  CheckCircle,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Alert,
} from 'react-native';

import Colors from '@/constants/colors';
import { MOCK_USERS, MOCK_POSTS, MOCK_VIDEOS, MOCK_REELS } from '@/mocks/data';

const { width } = Dimensions.get('window');

interface AdminStats {
  totalUsers: number;
  totalPosts: number;
  totalVideos: number;
  totalReels: number;
  revenue: number;
  reportsCount: number;
}

const ADMIN_STATS: AdminStats = {
  totalUsers: 12543,
  totalPosts: 45678,
  totalVideos: 3456,
  totalReels: 8901,
  revenue: 45678.90,
  reportsCount: 23,
};

function StatCard({ icon, title, value, color }: { icon: React.ReactNode; title: string; value: string | number; color: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        {icon}
      </View>
      <View style={styles.statInfo}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </View>
  );
}

function UserManagementItem({ user }: { user: any }) {
  return (
    <View style={styles.managementItem}>
      <Image source={{ uri: user.avatar }} style={styles.managementAvatar} />
      <View style={styles.managementInfo}>
        <View style={styles.managementNameRow}>
          <Text style={styles.managementName}>{user.name}</Text>
          {user.isVerified && <CheckCircle color={Colors.info} size={16} />}
        </View>
        <Text style={styles.managementUsername}>@{user.username}</Text>
        <Text style={styles.managementStats}>
          {user.followersCount.toLocaleString()} followers · {user.postsCount} posts
        </Text>
      </View>
      <View style={styles.managementActions}>
        <TouchableOpacity
          style={[styles.managementButton, styles.banButton]}
          onPress={() => Alert.alert('Ban User', `Ban ${user.name}?`)}
        >
          <Ban color={Colors.error} size={16} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.managementButton, styles.verifyButton]}
          onPress={() => Alert.alert('Verify User', `Verify ${user.name}?`)}
        >
          <Shield color={Colors.success} size={16} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ContentModerationItem({ content, type }: { content: any; type: 'post' | 'video' | 'reel' }) {
  return (
    <View style={styles.contentItem}>
      <Image
        source={{ uri: content.thumbnailUrl || content.images?.[0] || content.user.avatar }}
        style={styles.contentThumbnail}
      />
      <View style={styles.contentInfo}>
        <Text style={styles.contentTitle} numberOfLines={2}>
          {type === 'video' ? content.title : content.content || content.caption || 'Content'}
        </Text>
        <Text style={styles.contentUser}>by @{content.user.username}</Text>
        <View style={styles.contentStats}>
          <View style={styles.contentStat}>
            <Eye color={Colors.textSecondary} size={14} />
            <Text style={styles.contentStatText}>
              {content.views ? `${(content.views / 1000).toFixed(1)}K` : `${content.likes}`}
            </Text>
          </View>
          <View style={styles.contentStat}>
            <Heart color={Colors.textSecondary} size={14} />
            <Text style={styles.contentStatText}>{content.likes}</Text>
          </View>
          <View style={styles.contentStat}>
            <MessageCircle color={Colors.textSecondary} size={14} />
            <Text style={styles.contentStatText}>{content.comments}</Text>
          </View>
        </View>
      </View>
      <View style={styles.contentActions}>
        <TouchableOpacity
          style={[styles.contentActionButton, styles.approveButton]}
          onPress={() => Alert.alert('Approve', 'Content approved')}
        >
          <CheckCircle color={Colors.success} size={18} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.contentActionButton, styles.deleteButton]}
          onPress={() => Alert.alert('Delete', 'Content deleted')}
        >
          <Ban color={Colors.error} size={18} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'content'>('dashboard');

  const allContent = [
    ...MOCK_POSTS.map(p => ({ ...p, contentType: 'post' as const })),
    ...MOCK_VIDEOS.map(v => ({ ...v, contentType: 'video' as const })),
    ...MOCK_REELS.map(r => ({ ...r, contentType: 'reel' as const })),
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Admin Panel',
          headerStyle: {
            backgroundColor: Colors.background,
          },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dashboard' && styles.tabActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          <BarChart3
            color={activeTab === 'dashboard' ? Colors.primary : Colors.textSecondary}
            size={20}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'dashboard' && styles.tabTextActive,
            ]}
          >
            Dashboard
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.tabActive]}
          onPress={() => setActiveTab('users')}
        >
          <Users
            color={activeTab === 'users' ? Colors.primary : Colors.textSecondary}
            size={20}
          />
          <Text
            style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}
          >
            Users
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'content' && styles.tabActive]}
          onPress={() => setActiveTab('content')}
        >
          <FileText
            color={activeTab === 'content' ? Colors.primary : Colors.textSecondary}
            size={20}
          />
          <Text
            style={[styles.tabText, activeTab === 'content' && styles.tabTextActive]}
          >
            Content
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'dashboard' && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Platform Overview</Text>
              <View style={styles.statsGrid}>
                <StatCard
                  icon={<Users color={Colors.primary} size={24} />}
                  title="Total Users"
                  value={ADMIN_STATS.totalUsers.toLocaleString()}
                  color={Colors.primary}
                />
                <StatCard
                  icon={<FileText color={Colors.success} size={24} />}
                  title="Total Posts"
                  value={ADMIN_STATS.totalPosts.toLocaleString()}
                  color={Colors.success}
                />
                <StatCard
                  icon={<Eye color={Colors.info} size={24} />}
                  title="Total Videos"
                  value={ADMIN_STATS.totalVideos.toLocaleString()}
                  color={Colors.info}
                />
                <StatCard
                  icon={<TrendingUp color={Colors.warning} size={24} />}
                  title="Total Reels"
                  value={ADMIN_STATS.totalReels.toLocaleString()}
                  color={Colors.warning}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Revenue & Reports</Text>
              <View style={styles.revenueCard}>
                <View style={styles.revenueItem}>
                  <DollarSign color={Colors.success} size={32} />
                  <View style={styles.revenueInfo}>
                    <Text style={styles.revenueLabel}>Total Revenue</Text>
                    <Text style={styles.revenueValue}>
                      ${ADMIN_STATS.revenue.toLocaleString()}
                    </Text>
                  </View>
                </View>
                <View style={styles.revenueItem}>
                  <AlertTriangle color={Colors.error} size={32} />
                  <View style={styles.revenueInfo}>
                    <Text style={styles.revenueLabel}>Pending Reports</Text>
                    <Text style={styles.revenueValue}>
                      {ADMIN_STATS.reportsCount}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <View style={styles.activityCard}>
                <Text style={styles.activityText}>
                  • New user registered: @{MOCK_USERS[4].username}
                </Text>
                <Text style={styles.activityText}>
                  • Video uploaded: {MOCK_VIDEOS[0].title}
                </Text>
                <Text style={styles.activityText}>
                  • Report filed: Spam content
                </Text>
                <Text style={styles.activityText}>
                  • User verified: @{MOCK_USERS[0].username}
                </Text>
              </View>
            </View>
          </>
        )}

        {activeTab === 'users' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>User Management</Text>
            <Text style={styles.sectionDescription}>
              Manage users, ban accounts, and verify profiles
            </Text>
            {MOCK_USERS.map((user) => (
              <UserManagementItem key={user.id} user={user} />
            ))}
          </View>
        )}

        {activeTab === 'content' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Content Moderation</Text>
            <Text style={styles.sectionDescription}>
              Review and moderate posts, videos, and reels
            </Text>
            {allContent.slice(0, 10).map((item, index) => (
              <ContentModerationItem
                key={index}
                content={item}
                type={item.contentType}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  statsGrid: {
    gap: 12,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  statIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statInfo: {
    flex: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  revenueCard: {
    gap: 12,
  },
  revenueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    gap: 16,
  },
  revenueInfo: {
    flex: 1,
  },
  revenueLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  revenueValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  activityCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  activityText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  managementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  managementAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  managementInfo: {
    flex: 1,
  },
  managementNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  managementName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  managementUsername: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  managementStats: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  managementActions: {
    flexDirection: 'row',
    gap: 8,
  },
  managementButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  banButton: {
    backgroundColor: Colors.error + '20',
  },
  verifyButton: {
    backgroundColor: Colors.success + '20',
  },
  contentItem: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  contentThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.overlay,
  },
  contentInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  contentTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 18,
    marginBottom: 4,
  },
  contentUser: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  contentStats: {
    flexDirection: 'row',
    gap: 12,
  },
  contentStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contentStatText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  contentActions: {
    justifyContent: 'center',
    gap: 8,
  },
  contentActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: Colors.success + '20',
  },
  deleteButton: {
    backgroundColor: Colors.error + '20',
  },
});
