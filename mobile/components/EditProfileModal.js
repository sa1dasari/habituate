import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import DatePicker from './DatePicker';
import { storage } from '../firebase';
import api from '../api/client';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../hooks/useAuth';
import { radii, spacing } from '../theme';

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/** Display name, profile photo, date of birth, and (email/password accounts only) a password-reset link. */
export default function EditProfileModal({ visible, onClose }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { user, updateDisplayName, updatePhotoURL, sendPasswordReset } = useAuth();

  const [name, setName] = useState('');
  const [photoURL, setPhotoURL] = useState(null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const isPasswordAccount = (user?.providerData || []).some((p) => p.providerId === 'password');

  useEffect(() => {
    if (!visible || !user) return;
    setName(user.displayName || '');
    setPhotoURL(user.photoURL || null);

    let cancelled = false;
    setLoadingProfile(true);
    api
      .getUserProfile()
      .then((profile) => {
        if (!cancelled) setDateOfBirth(profile?.dateOfBirth || '');
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, user]);

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setUploadingPhoto(true);
    try {
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const photoRef = ref(storage, `profile-photos/${user.uid}.jpg`);
      await uploadBytes(photoRef, blob);
      const downloadUrl = await getDownloadURL(photoRef);
      setPhotoURL(downloadUrl);
    } catch (err) {
      Alert.alert("Couldn't upload photo", err instanceof Error ? err.message : 'Something went wrong — try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleResetPassword = () => {
    Alert.alert('Reset password?', `We'll email a reset link to ${user?.email}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send email',
        onPress: async () => {
          try {
            await sendPasswordReset();
            Alert.alert('Email sent', 'Check your inbox for the password reset link.');
          } catch (err) {
            Alert.alert("Couldn't send it", err instanceof Error ? err.message : 'Something went wrong — try again.');
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name it', 'Enter a display name.');
      return;
    }
    setSaving(true);
    try {
      if (trimmed !== (user?.displayName || '')) {
        await updateDisplayName(trimmed);
      }
      if (photoURL !== (user?.photoURL || null)) {
        await updatePhotoURL(photoURL);
      }
      await api.updateUserProfile({ dateOfBirth: dateOfBirth || null });
      onClose();
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof Error ? err.message : 'Something went wrong — try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.photoSection}>
            <Pressable
              style={styles.photoWrap}
              onPress={handlePickPhoto}
              disabled={uploadingPhoto}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
            >
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.photo} />
              ) : (
                <View style={styles.photoFallback}>
                  <Text style={styles.photoFallbackText}>{initials(name)}</Text>
                </View>
              )}
              <View style={styles.photoEditBadge}>
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialCommunityIcons name="camera-outline" size={14} color="#FFFFFF" />
                )}
              </View>
            </Pressable>
            <Text style={styles.photoHint}>Tap to change photo</Text>
          </View>

          <Text style={styles.label}>Display name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Date of birth</Text>
          {loadingProfile ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginBottom: spacing.lg }} />
          ) : (
            <DatePicker value={dateOfBirth} onChange={setDateOfBirth} maximumDate={new Date()} placeholder="Not set" />
          )}

          {isPasswordAccount ? (
            <Pressable style={styles.secondaryButton} onPress={handleResetPassword}>
              <MaterialCommunityIcons name="lock-reset" size={16} color={colors.textSecondary} />
              <Text style={styles.secondaryButtonText}>Reset password</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
            disabled={saving}
            onPress={handleSave}
          >
            <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { ...typography.sectionTitle },
    closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    photoSection: { alignItems: 'center', marginBottom: spacing.xl },
    photoWrap: { width: 88, height: 88 },
    photo: { width: 88, height: 88, borderRadius: radii.pill },
    photoFallback: {
      width: 88,
      height: 88,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentSoft,
    },
    photoFallbackText: { fontSize: 26, fontWeight: '700', color: colors.accent },
    photoEditBadge: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 28,
      height: 28,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      borderWidth: 2,
      borderColor: colors.background,
    },
    photoHint: { ...typography.meta, marginTop: spacing.sm },
    label: { ...typography.label, marginBottom: spacing.sm },
    input: {
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: spacing.lg,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.background,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm + 2,
      marginBottom: spacing.lg,
    },
    secondaryButtonText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm + 2,
      alignItems: 'center',
    },
    primaryButtonDisabled: { opacity: 0.6 },
    primaryButtonText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  });
}
