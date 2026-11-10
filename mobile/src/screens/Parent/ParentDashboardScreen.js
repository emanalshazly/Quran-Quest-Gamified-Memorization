import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { parentAPI } from '../../services/api';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const ParentDashboardScreen = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  const loadDashboard = async () => {
    try {
      const res = await parentAPI.getDashboard();
      if (res.success) setDashboard(res);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const kidsData = dashboard?.dashboard || dashboard?.kids || [];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDashboard(); }} />
      }
    >
      <Text style={styles.title}>👨‍👩‍👧‍👦 متابعة تقدم الأطفال</Text>

      {kidsData.length === 0 ? (
        <Text style={styles.emptyText}>لا توجد بيانات بعد — أضف ملفات الأطفال وابدؤوا الحفظ</Text>
      ) : (
        kidsData.map((kid, i) => (
          <View key={kid.id || i} style={styles.kidCard}>
            <View style={styles.kidHeader}>
              <Text style={styles.kidAvatar}>
                {kid.avatar?.length <= 4 ? kid.avatar : '🧒'}
              </Text>
              <View style={styles.kidInfo}>
                <Text style={styles.kidName}>{kid.name}</Text>
                <Text style={styles.kidLevel}>
                  المستوى {kid.level || 1} • 🔥 {kid.streak_count || 0} يوم
                </Text>
              </View>
              <Text style={styles.kidPoints}>{kid.total_points || 0} نقطة</Text>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{kid.versesMemorized ?? kid.verses_memorized ?? '—'}</Text>
                <Text style={styles.metricLabel}>آية محفوظة</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{kid.averageAccuracy ?? kid.average_accuracy ?? '—'}</Text>
                <Text style={styles.metricLabel}>متوسط الدقة</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{kid.badgeCount ?? kid.badge_count ?? '—'}</Text>
                <Text style={styles.metricLabel}>شارة</Text>
              </View>
            </View>
          </View>
        ))
      )}

      <Text style={styles.note}>
        📈 الرسوم البيانية الشهرية والتقارير الأسبوعية بالبريد قيد التطوير
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xl,
  },
  kidCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  kidHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  kidAvatar: {
    fontSize: 32,
    marginRight: SPACING.md,
  },
  kidInfo: {
    flex: 1,
  },
  kidName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  kidLevel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  kidPoints: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.accent,
  },
  metricLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  note: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginVertical: SPACING.lg,
  },
});

export default ParentDashboardScreen;
