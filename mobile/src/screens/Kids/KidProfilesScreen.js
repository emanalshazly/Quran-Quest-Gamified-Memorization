import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useApp } from '../../contexts/AppContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const AVATAR_EMOJIS = ['🧒', '👦', '👧', '🧕', '👶', '🦸'];

const KidProfilesScreen = ({ navigation }) => {
  const { kids, selectedKid, selectKid, addKid, deleteKid } = useApp();
  const [showForm, setShowForm] = useState(kids.length === 0);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATAR_EMOJIS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!name.trim()) {
      setError('الرجاء إدخال اسم الطفل');
      return;
    }

    setSaving(true);
    setError('');

    const result = await addKid({ name: name.trim(), avatar });
    setSaving(false);

    if (result.success) {
      setName('');
      setShowForm(false);
    } else {
      setError(result.error || 'تعذر إضافة الطفل — تحقق من حد الباقة الحالية');
    }
  };

  const handleSelect = async (kid) => {
    await selectKid(kid);
    navigation.goBack();
  };

  const confirmDelete = (kid) => {
    Alert.alert('حذف الملف', `هل تريد حذف ملف ${kid.name}؟ سيُحذف كل تقدمه.`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: () => deleteKid(kid.id) },
    ]);
  };

  const renderKid = ({ item }) => {
    const isSelected = selectedKid?.id === item.id;
    return (
      <TouchableOpacity
        style={[styles.kidCard, isSelected && styles.kidCardSelected]}
        onPress={() => handleSelect(item)}
        onLongPress={() => confirmDelete(item)}
      >
        <Text style={styles.kidAvatar}>{item.avatar?.length <= 4 ? item.avatar : '🧒'}</Text>
        <View style={styles.kidInfo}>
          <Text style={styles.kidName}>{item.name}</Text>
          <Text style={styles.kidMeta}>
            المستوى {item.level || 1} • {item.total_points || 0} نقطة 🔥 {item.streak_count || 0}
          </Text>
        </View>
        {isSelected && <Text style={styles.selectedMark}>✓</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={kids}
        renderItem={renderKid}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>لا توجد ملفات أطفال بعد — أضف أول بطل! 🌟</Text>
        }
        ListHeaderComponent={
          <Text style={styles.hint}>اضغط لاختيار الملف، واضغط مطولاً للحذف</Text>
        }
      />

      {showForm ? (
        <View style={styles.form}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="اسم الطفل"
            value={name}
            onChangeText={setName}
          />

          <View style={styles.avatarRow}>
            {AVATAR_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[styles.avatarOption, avatar === emoji && styles.avatarSelected]}
                onPress={() => setAvatar(emoji)}
              >
                <Text style={styles.avatarEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleAdd}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.card} />
            ) : (
              <Text style={styles.buttonText}>حفظ الملف</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
          <Text style={styles.addButtonText}>+ إضافة طفل</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  list: {
    padding: SPACING.md,
  },
  hint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xl,
  },
  kidCard: {
    backgroundColor: COLORS.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.transparent,
    ...SHADOWS.small,
  },
  kidCardSelected: {
    borderColor: COLORS.primary,
  },
  kidAvatar: {
    fontSize: 36,
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
  kidMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  selectedMark: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  form: {
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    ...SHADOWS.large,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  avatarOption: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.transparent,
  },
  avatarSelected: {
    borderColor: COLORS.secondary,
    backgroundColor: COLORS.secondaryLight,
  },
  avatarEmoji: {
    fontSize: 28,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.card,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: COLORS.primary,
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  addButtonText: {
    color: COLORS.card,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
});

export default KidProfilesScreen;
