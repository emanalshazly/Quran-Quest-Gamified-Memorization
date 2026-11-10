import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../contexts/AppContext';
import { gamificationAPI } from '../../services/api';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const MEDALS = ['🥇', '🥈', '🥉'];

const LeaderboardScreen = () => {
  const { selectedKid } = useApp();
  const [type, setType] = useState('family');
  const [entries, setEntries] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData(type);
    }, [type, selectedKid])
  );

  const loadData = async (boardType) => {
    try {
      const res = await gamificationAPI.getLeaderboard(boardType, 10);
      if (res.success) setEntries(res.leaderboard || []);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const renderEntry = ({ item, index }) => {
    // family rows come raw (with kids join); global rows come sanitized
    const name = item.name || item.kids?.name || '—';
    const level = item.level || item.kids?.level || 1;
    const rank = item.rank || item.family_rank || index + 1;
    const isOwn = item.isOwnKid || item.kid_id === selectedKid?.id;

    return (
      <View style={[styles.row, isOwn && styles.rowOwn]}>
        <Text style={styles.rank}>{MEDALS[rank - 1] || `#${rank}`}</Text>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName}>
            {name} {isOwn ? '(أنت)' : ''}
          </Text>
          <Text style={styles.rowLevel}>المستوى {level}</Text>
        </View>
        <Text style={styles.rowPoints}>{item.total_points} نقطة</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, type === 'family' && styles.tabActive]}
          onPress={() => setType('family')}
        >
          <Text style={[styles.tabText, type === 'family' && styles.tabTextActive]}>
            👨‍👩‍👧‍👦 العائلة
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, type === 'global' && styles.tabActive]}
          onPress={() => setType('global')}
        >
          <Text style={[styles.tabText, type === 'global' && styles.tabTextActive]}>
            🌍 العالم
          </Text>
        </TouchableOpacity>
      </View>

      {type === 'global' && (
        <Text style={styles.privacyNote}>
          🔒 حمايةً للخصوصية، تظهر أسماء الأطفال الآخرين مجهّلة
        </Text>
      )}

      <FlatList
        data={entries}
        renderItem={renderEntry}
        keyExtractor={(item, index) => String(item.kid_id || item.rank || index)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(type); }}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>لا توجد نتائج بعد — ابدأ الحفظ لتتصدر! 🚀</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabs: {
    flexDirection: 'row',
    margin: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.xs,
    ...SHADOWS.small,
  },
  tab: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: COLORS.card,
  },
  privacyNote: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  list: {
    padding: SPACING.md,
    paddingTop: 0,
  },
  row: {
    backgroundColor: COLORS.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  rowOwn: {
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  rank: {
    fontSize: FONT_SIZES.xl,
    width: 48,
    textAlign: 'center',
  },
  rowInfo: {
    flex: 1,
    marginHorizontal: SPACING.sm,
  },
  rowName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  rowLevel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  rowPoints: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xl,
  },
});

export default LeaderboardScreen;
