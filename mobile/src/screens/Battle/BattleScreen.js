import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../contexts/AppContext';
import { battleAPI, memorizationAPI } from '../../services/api';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

/**
 * Battle Mode: challenge a sibling (another kid on the same family account)
 * to recite a random verse from the memorized surahs. Highest score wins;
 * ties are broken by the fastest time.
 */
const BattleScreen = () => {
  const { selectedKid, kids } = useApp();
  const [battles, setBattles] = useState([]);
  const [history, setHistory] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  const siblings = kids.filter(k => k.id !== selectedKid?.id);

  useFocusEffect(
    useCallback(() => {
      if (selectedKid) loadData();
    }, [selectedKid])
  );

  const loadData = async () => {
    try {
      const [pendingRes, historyRes] = await Promise.all([
        battleAPI.getPendingBattles(selectedKid.id),
        battleAPI.getBattleHistory(selectedKid.id),
      ]);
      if (pendingRes.success) setBattles(pendingRes.battles || []);
      if (historyRes.success) setHistory(historyRes.stats);
    } catch (error) {
      console.error('Error loading battles:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const createChallenge = async (opponent) => {
    setCreating(true);
    try {
      // Pick a random verse from the kid's memorized verses
      const dueRes = await memorizationAPI.getStats(selectedKid.id);
      if (!dueRes.success || dueRes.stats.totalMemorized === 0) {
        Alert.alert('لا يمكن بدء التحدي', 'احفظ آية واحدة على الأقل أولاً!');
        return;
      }

      const historyRes = await memorizationAPI.getDueVerses(selectedKid.id);
      // Use any memorized verse; fall back to due list
      const pool = historyRes.verses || [];
      const verseId = pool.length > 0
        ? pool[Math.floor(Math.random() * pool.length)].verse_id
        : null;

      if (!verseId) {
        Alert.alert('لا يمكن بدء التحدي', 'لا توجد آيات متاحة للتحدي حالياً');
        return;
      }

      const res = await battleAPI.createChallenge({
        challenger_id: selectedKid.id,
        opponent_id: opponent.id,
        verse_id: verseId,
      });

      if (res.success) {
        Alert.alert('تم إرسال التحدي! ⚔️', `بانتظار قبول ${opponent.name}`);
        loadData();
      }
    } catch (error) {
      Alert.alert('خطأ', 'تعذر إنشاء التحدي');
    } finally {
      setCreating(false);
    }
  };

  const acceptBattle = async (battle) => {
    try {
      const res = await battleAPI.acceptChallenge(battle.id);
      if (res.success) {
        Alert.alert('قبلت التحدي! 🔥', 'سجّل تلاوتك للآية من شاشة الاختبار ثم أرسل نتيجتك');
        loadData();
      }
    } catch (error) {
      Alert.alert('خطأ', 'تعذر قبول التحدي');
    }
  };

  const renderBattle = ({ item }) => {
    const isChallenger = item.challenger_id === selectedKid?.id;
    const other = isChallenger ? item.opponent : item.challenger;

    return (
      <View style={styles.battleCard}>
        <View style={styles.battleHeader}>
          <Text style={styles.battleVs}>
            ⚔️ {isChallenger ? `أنت ضد ${other?.name}` : `${other?.name} يتحداك!`}
          </Text>
          <Text style={styles.battleStatus}>
            {item.status === 'pending' ? '⏳ بانتظار القبول' : '🔥 جارٍ'}
          </Text>
        </View>
        <Text style={styles.battleVerse} numberOfLines={2}>
          {item.verses?.surahs?.name_ar} — آية {item.verses?.verse_number}
        </Text>
        {!isChallenger && item.status === 'pending' && (
          <TouchableOpacity style={styles.acceptButton} onPress={() => acceptBattle(item)}>
            <Text style={styles.acceptButtonText}>قبول التحدي ⚔️</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (!selectedKid) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>اختر ملف طفل أولاً</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={battles}
      renderItem={renderBattle}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
      }
      ListHeaderComponent={
        <>
          {history && (
            <View style={styles.statsCard}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{history.wins}</Text>
                <Text style={styles.statLabel}>فوز 🏆</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{history.losses}</Text>
                <Text style={styles.statLabel}>خسارة</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{history.total}</Text>
                <Text style={styles.statLabel}>إجمالي</Text>
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>تحدَّ أحد إخوتك:</Text>
          {siblings.length === 0 ? (
            <Text style={styles.noSiblings}>
              أضف أخاً أو أختاً من ملفات الأطفال لبدء التحديات! 👨‍👩‍👧‍👦
            </Text>
          ) : (
            <View style={styles.siblingsRow}>
              {siblings.map(sibling => (
                <TouchableOpacity
                  key={sibling.id}
                  style={styles.siblingCard}
                  onPress={() => createChallenge(sibling)}
                  disabled={creating}
                >
                  <Text style={styles.siblingAvatar}>
                    {sibling.avatar?.length <= 4 ? sibling.avatar : '🧒'}
                  </Text>
                  <Text style={styles.siblingName}>{sibling.name}</Text>
                  <Text style={styles.challengeText}>تحدَّ ⚔️</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {battles.length > 0 && <Text style={styles.sectionTitle}>التحديات الجارية:</Text>}
        </>
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>لا توجد تحديات جارية</Text>
      }
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  list: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
  statsCard: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.md,
    ...SHADOWS.medium,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.card,
  },
  statLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.card,
    opacity: 0.8,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginVertical: SPACING.md,
  },
  noSiblings: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  siblingsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  siblingCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    minWidth: 100,
    ...SHADOWS.small,
  },
  siblingAvatar: {
    fontSize: 36,
  },
  siblingName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
    marginVertical: SPACING.xs,
  },
  challengeText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    fontWeight: 'bold',
  },
  battleCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  battleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  battleVs: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  battleStatus: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  battleVerse: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  acceptButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  acceptButtonText: {
    color: COLORS.card,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
});

export default BattleScreen;
