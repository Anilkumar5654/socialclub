import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Eye,
  Clock,
  TrendingUp,
  Heart,
  MessageCircle,
  Share2,
  DollarSign,
  Users,
  Target,
  Globe,
  ArrowUp,
  ArrowDown,
} from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';

import Colors from '@/constants/colors';
import { api, MEDIA_BASE_URL } from '@/services/api';
import { formatTimeAgo } from '@/constants/timeFormat';

const { width } = Dimensions.get('window');

interface VideoAnalytics {
  video_id: string;
  title: string;
  thumbnail_url: string;
  total_views: number;
  total_watch_time: number;
  impressions: number;
  ctr: number;
  avg_view_duration: number;
  engagement_rate: number;
  likes: number;
  comments: number;
  shares: number;
  retention_data: { time: number; percentage: number }[];
  traffic_sources: { source: string; views: number; percentage: number }[];
  demographics: {
    age_groups: { age: string; percentage: number }[];
    top_countries: { country: string; percentage: number }[];
  };
  revenue: {
    estimated_revenue: number;
    rpm: number;
    cpm: number;
  };
  performance_comparison: {
    vs_last_video: { views: number; watch_time: number };
    vs_channel_avg: { views: number; watch_time: number };
  };
}

function MetricCard({
  icon,
  title,
  value,
  subtitle,
  trend,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle?: string;
  trend?: { value: number; label: string };
}) {
  const isPositive = trend && trend.value > 0;
  const isNegative = trend && trend.value < 0;

  return (
    <View style={styles.metricCard}>
      <View style={styles.metricHeader}>
        <View style={styles.metricIcon}>{icon}</View>
        <Text style={styles.metricTitle}>{title}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
      {trend && (
        <View style={styles.trendContainer}>
          {isPositive && <ArrowUp color={Colors.success} size={14} />}
          {isNegative && <ArrowDown color={Colors.error} size={14} />}
          <Text
            style={[
              styles.trendText,
              isPositive && styles.trendPositive,
              isNegative && styles.trendNegative,
            ]}
          >
            {trend.value > 0 ? '+' : ''}
            {trend.value}% {trend.label}
          </Text>
        </View>
      )}
    </View>
  );
}

function RetentionGraph({ data }: { data: { time: number; percentage: number }[] }) {
  const maxPercentage = Math.max(...data.map((d) => d.percentage), 100);
  const chartHeight = 150;
  const chartWidth = width - 48;

  return (
    <View style={styles.graphContainer}>
      <Text style={styles.graphTitle}>Audience Retention</Text>
      <Text style={styles.graphSubtitle}>Where viewers are dropping off</Text>
      <View style={styles.chartContainer}>
        <View style={styles.yAxis}>
          <Text style={styles.axisLabel}>100%</Text>
          <Text style={styles.axisLabel}>75%</Text>
          <Text style={styles.axisLabel}>50%</Text>
          <Text style={styles.axisLabel}>25%</Text>
          <Text style={styles.axisLabel}>0%</Text>
        </View>
        <View style={styles.chartArea}>
          <View style={[styles.chart, { height: chartHeight }]}>
            {data.map((point, index) => {
              const heightPercentage = (point.percentage / maxPercentage) * 100;
              const barHeight = (chartHeight * heightPercentage) / 100;
              const barWidth = chartWidth / data.length - 4;

              return (
                <View
                  key={index}
                  style={[
                    styles.retentionBar,
                    {
                      height: barHeight,
                      width: barWidth,
                    },
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.xAxis}>
            <Text style={styles.axisLabel}>0s</Text>
            <Text style={styles.axisLabel}>Middle</Text>
            <Text style={styles.axisLabel}>End</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function DataRow({
  label,
  value,
  percentage,
}: {
  label: string;
  value: string;
  percentage?: number;
}) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <View style={styles.dataRight}>
        {percentage !== undefined && (
          <View style={[styles.progressBar, { width: 100 }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${percentage}%`,
                },
              ]}
            />
          </View>
        )}
        <Text style={styles.dataValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function VideoAnalyticsScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<VideoAnalytics | null>(null);

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      console.log('[Video Analytics] Loading analytics for video:', videoId);
      const response = await api.creator.getVideoDetailedAnalytics(videoId || '');
      console.log('[Video Analytics] Analytics loaded:', response.analytics);
      setAnalytics(response.analytics);
    } catch (error: any) {
      console.error('[Video Analytics] Error loading analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getMediaUrl = (path: string | undefined) => {
    if (!path) return '';
    return path.startsWith('http') ? path : `${MEDIA_BASE_URL}/${path}`;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Stack.Screen
          options={{
            title: 'Video Analytics',
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.text,
            headerShadowVisible: false,
          }}
        />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  if (!analytics) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Stack.Screen
          options={{
            title: 'Video Analytics',
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.text,
            headerShadowVisible: false,
          }}
        />
        <Text style={styles.errorText}>Analytics not available</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Video Analytics',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.videoHeader}>
          <Image
            source={{ uri: getMediaUrl(analytics.thumbnail_url) }}
            style={styles.thumbnail}
            contentFit="cover"
          />
          <Text style={styles.videoTitle} numberOfLines={2}>
            {analytics.title}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.metricsGrid}>
            <MetricCard
              icon={<Eye color={Colors.primary} size={24} />}
              title="Views"
              value={formatNumber(analytics.total_views)}
              subtitle={`${formatNumber(analytics.impressions)} impressions`}
              trend={
                analytics.performance_comparison?.vs_last_video?.views !== undefined
                  ? {
                      value: analytics.performance_comparison.vs_last_video.views,
                      label: 'vs last video',
                    }
                  : undefined
              }
            />
            <MetricCard
              icon={<Clock color={Colors.success} size={24} />}
              title="Watch Time"
              value={formatDuration(analytics.total_watch_time)}
              subtitle={`${formatDuration(analytics.avg_view_duration)} avg`}
              trend={
                analytics.performance_comparison?.vs_last_video?.watch_time !== undefined
                  ? {
                      value: analytics.performance_comparison.vs_last_video.watch_time,
                      label: 'vs last video',
                    }
                  : undefined
              }
            />
            <MetricCard
              icon={<Target color={Colors.info} size={24} />}
              title="CTR"
              value={`${analytics.ctr.toFixed(1)}%`}
              subtitle="Click-through rate"
            />
            <MetricCard
              icon={<TrendingUp color={Colors.warning} size={24} />}
              title="Engagement"
              value={`${analytics.engagement_rate.toFixed(1)}%`}
              subtitle={`${formatNumber(analytics.likes + analytics.comments + analytics.shares)} interactions`}
            />
          </View>
        </View>

        <View style={styles.section}>
          <RetentionGraph data={analytics.retention_data} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Engagement</Text>
          <View style={styles.engagementRow}>
            <View style={styles.engagementItem}>
              <Heart color={Colors.error} size={20} />
              <Text style={styles.engagementValue}>{formatNumber(analytics.likes)}</Text>
              <Text style={styles.engagementLabel}>Likes</Text>
            </View>
            <View style={styles.engagementItem}>
              <MessageCircle color={Colors.primary} size={20} />
              <Text style={styles.engagementValue}>
                {formatNumber(analytics.comments)}
              </Text>
              <Text style={styles.engagementLabel}>Comments</Text>
            </View>
            <View style={styles.engagementItem}>
              <Share2 color={Colors.success} size={20} />
              <Text style={styles.engagementValue}>{formatNumber(analytics.shares)}</Text>
              <Text style={styles.engagementLabel}>Shares</Text>
            </View>
          </View>
        </View>

        {analytics.revenue && analytics.revenue.estimated_revenue > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Revenue</Text>
            <View style={styles.revenueCard}>
              <DollarSign color={Colors.success} size={32} />
              <Text style={styles.revenueAmount}>
                ${analytics.revenue.estimated_revenue.toFixed(2)}
              </Text>
              <Text style={styles.revenueLabel}>Estimated Revenue</Text>
            </View>
            <View style={styles.revenueDetails}>
              <DataRow label="RPM" value={`$${analytics.revenue.rpm.toFixed(2)}`} />
              <DataRow label="CPM" value={`$${analytics.revenue.cpm.toFixed(2)}`} />
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Traffic Sources</Text>
          <View style={styles.dataList}>
            {analytics.traffic_sources.map((source, index) => (
              <DataRow
                key={index}
                label={source.source}
                value={`${formatNumber(source.views)} (${source.percentage.toFixed(1)}%)`}
                percentage={source.percentage}
              />
            ))}
          </View>
        </View>

        {analytics.demographics && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Demographics</Text>
              <Text style={styles.subsectionTitle}>Age Groups</Text>
              <View style={styles.dataList}>
                {analytics.demographics.age_groups.map((group, index) => (
                  <DataRow
                    key={index}
                    label={group.age}
                    value={`${group.percentage.toFixed(1)}%`}
                    percentage={group.percentage}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.subsectionTitle}>Top Countries</Text>
              <View style={styles.dataList}>
                {analytics.demographics.top_countries.map((country, index) => (
                  <DataRow
                    key={index}
                    label={country.country}
                    value={`${country.percentage.toFixed(1)}%`}
                    percentage={country.percentage}
                  />
                ))}
              </View>
            </View>
          </>
        )}

        {analytics.performance_comparison && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance Comparison</Text>
            <View style={styles.comparisonCard}>
              <Text style={styles.comparisonTitle}>vs. Last Video</Text>
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonLabel}>Views:</Text>
                <Text
                  style={[
                    styles.comparisonValue,
                    analytics.performance_comparison.vs_last_video.views > 0
                      ? styles.comparisonPositive
                      : styles.comparisonNegative,
                  ]}
                >
                  {analytics.performance_comparison.vs_last_video.views > 0 ? '+' : ''}
                  {analytics.performance_comparison.vs_last_video.views}%
                </Text>
              </View>
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonLabel}>Watch Time:</Text>
                <Text
                  style={[
                    styles.comparisonValue,
                    analytics.performance_comparison.vs_last_video.watch_time > 0
                      ? styles.comparisonPositive
                      : styles.comparisonNegative,
                  ]}
                >
                  {analytics.performance_comparison.vs_last_video.watch_time > 0 ? '+' : ''}
                  {analytics.performance_comparison.vs_last_video.watch_time}%
                </Text>
              </View>
            </View>

            <View style={styles.comparisonCard}>
              <Text style={styles.comparisonTitle}>vs. Channel Average</Text>
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonLabel}>Views:</Text>
                <Text
                  style={[
                    styles.comparisonValue,
                    analytics.performance_comparison.vs_channel_avg.views > 0
                      ? styles.comparisonPositive
                      : styles.comparisonNegative,
                  ]}
                >
                  {analytics.performance_comparison.vs_channel_avg.views > 0 ? '+' : ''}
                  {analytics.performance_comparison.vs_channel_avg.views}%
                </Text>
              </View>
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonLabel}>Watch Time:</Text>
                <Text
                  style={[
                    styles.comparisonValue,
                    analytics.performance_comparison.vs_channel_avg.watch_time > 0
                      ? styles.comparisonPositive
                      : styles.comparisonNegative,
                  ]}
                >
                  {analytics.performance_comparison.vs_channel_avg.watch_time > 0 ? '+' : ''}
                  {analytics.performance_comparison.vs_channel_avg.watch_time}%
                </Text>
              </View>
            </View>
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  videoHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    marginBottom: 12,
  },
  videoTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    lineHeight: 24,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: (width - 48) / 2,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricIcon: {
    marginRight: 8,
  },
  metricTitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  metricSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  trendPositive: {
    color: Colors.success,
  },
  trendNegative: {
    color: Colors.error,
  },
  graphContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  graphTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  graphSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  yAxis: {
    justifyContent: 'space-between',
    width: 40,
  },
  chartArea: {
    flex: 1,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 8,
  },
  retentionBar: {
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  axisLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  engagementRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  engagementItem: {
    alignItems: 'center',
    gap: 8,
  },
  engagementValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  engagementLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  revenueCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  revenueAmount: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  revenueLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  revenueDetails: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dataList: {
    gap: 12,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dataLabel: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
    flex: 1,
  },
  dataRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dataValue: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
    minWidth: 60,
    textAlign: 'right',
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.background,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  comparisonCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  comparisonTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  comparisonLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  comparisonValue: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  comparisonPositive: {
    color: Colors.success,
  },
  comparisonNegative: {
    color: Colors.error,
  },
});
