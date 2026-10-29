import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { ref, getDownloadURL } from 'firebase/storage';
import ConfirmModal from './ConfirmModal';
import DatePicker from './DatePicker';
import SelectField from './SelectField';
import AvatarImage from './AvatarImage';
import Toast from './Toast';
import { auth, storage } from '../firebase';
import api from '../api/client';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../hooks/useAuth';
import { useConfirm } from '../hooks/useConfirm';
import { useToast } from '../hooks/useToast';
import { radii, spacing } from '../theme';

const SELF_DESCRIBE = 'Self-describe';
const GENDER_OPTIONS = ['Woman', 'Man', 'Non-binary', 'Prefer not to say', SELF_DESCRIBE];
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const USERNAME_CHECK_DEBOUNCE_MS = 400;

/** Display name, profile photo, date of birth, phone, address, gender, and (email/password accounts only) a password-reset link. */
export default function EditProfileModal({ visible, onClose }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { user, updateDisplayName, updatePhotoURL, sendPasswordReset } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const { request, confirm, respond } = useConfirm();

  const [name, setName] = useState('');
  const [photoURL, setPhotoURL] = useState(null);
  const [username, setUsername] = useState('');
  const [originalUsername, setOriginalUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState('idle'); // idle | checking | available | taken | invalid
  const usernameDebounceRef = useRef(null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const isPasswordAccount = (user?.providerData || []).some((p) => p.providerId === 'password');

  // A fixed list covers the common cases via a dropdown, while "Self-describe"
  // falls back to free text — the backend column stays plain text regardless.
  const isCustomGender = !!gender && !GENDER_OPTIONS.slice(0, -1).includes(gender);
  const genderSelection = isCustomGender ? SELF_DESCRIBE : gender || null;

  useEffect(() => {
    if (!visible || !user) return;
    setName(user.displayName || '');
    setPhotoURL(user.photoURL || null);

    let cancelled = false;
    setLoadingProfile(true);
    api
      .getUserProfile()
      .then((profile) => {
        if (cancelled) return;
        setDateOfBirth(profile?.dateOfBirth || '');
        setPhoneNumber(profile?.phoneNumber || '');
        setAddress(profile?.address || '');
        setGender(profile?.gender || '');
        setUsername(profile?.username || '');
        setOriginalUsername(profile?.username || '');
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, user]);

  useEffect(() => {
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    const normalized = username.trim().toLowerCase();
    if (normalized === originalUsername) {
      setUsernameStatus('idle');
      return;
    }
    if (!normalized) {
      setUsernameStatus('invalid');
      return;
    }
    if (!USERNAME_PATTERN.test(normalized)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    usernameDebounceRef.current = setTimeout(async () => {
      try {
        const result = await api.getUsernameAvailable(normalized);
        setUsernameStatus(result?.available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, USERNAME_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(usernameDebounceRef.current);
  }, [username, originalUsername]);

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('Allow photo access to set a profile picture.', 'info');
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
      // Picked images can be HEIC or other formats that upload fine as raw
      // bytes (Storage never validates content) but that RN's <Image> can't
      // decode later. Force a re-encode to a standard JPEG first.
      const context = ImageManipulator.manipulate(result.assets[0].uri);
      const renderedImage = await context.renderAsync();
      const jpeg = await renderedImage.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

      // Both of Firebase's own upload entry points (uploadBytes, uploadString)
      // normalize their input through RN's Blob implementation, which either
      // throws outright on raw bytes or silently corrupts the bytes when built
      // via fetch().blob() (the "unknown image format" failure we kept hitting
      // downstream). Uploading directly against the Storage REST endpoint via
      // expo-file-system's native binary upload sidesteps the JS Blob layer
      // entirely — the file's bytes go straight from disk to the network.
      const objectPath = `profile-photos/${user.uid}.jpg`;
      const bucket = storage.app.options.storageBucket;
      const idToken = await auth.currentUser.getIdToken();
      const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(objectPath)}`;
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, jpeg.uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'image/jpeg',
        },
      });
      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`Upload failed (${uploadResult.status})`);
      }

      const photoRef = ref(storage, objectPath);
      const downloadUrl = await getDownloadURL(photoRef);
      setPhotoURL(downloadUrl);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't upload photo — something went wrong.", 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleResetPassword = async () => {
    const ok = await confirm({
      title: 'Reset password?',
      message: `We'll email a reset link to ${user?.email}.`,
      confirmLabel: 'Send email',
    });
    if (!ok) return;
    try {
      await sendPasswordReset();
      showToast('Check your inbox for the password reset link.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't send it — something went wrong.", 'error');
    }
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('Enter a display name first.', 'info');
      return;
    }
    const normalizedUsername = username.trim().toLowerCase();
    if (normalizedUsername !== originalUsername) {
      if (usernameStatus !== 'available') {
        showToast('Pick an available username before saving.', 'info');
        return;
      }
    }
    setSaving(true);
    try {
      if (trimmed !== (user?.displayName || '')) {
        await updateDisplayName(trimmed);
      }
      if (photoURL !== (user?.photoURL || null)) {
        await updatePhotoURL(photoURL);
      }
      if (normalizedUsername !== originalUsername) {
        await api.setUsername(normalizedUsername);
      }
      await api.updateUserProfile({
        dateOfBirth: dateOfBirth || null,
        phoneNumber: phoneNumber || null,
        address: address || null,
        gender: gender || null,
      });
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save — something went wrong.", 'error');
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
              <View style={styles.photoFallback}>
                <AvatarImage uri={photoURL} name={name} size={88} fontSize={26} />
              </View>
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

          <Text style={styles.label}>Username</Text>
          <View style={styles.usernameRow}>
            <Text style={styles.atSign}>@</Text>
            <TextInput
              style={styles.usernameInput}
              placeholder="yourname"
              placeholderTextColor={colors.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            {usernameStatus === 'checking' ? <ActivityIndicator size="small" color={colors.accent} /> : null}
            {usernameStatus === 'available' ? (
              <MaterialCommunityIcons name="check-circle" size={18} color={colors.safe} />
            ) : null}
            {usernameStatus === 'taken' || usernameStatus === 'invalid' ? (
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.atRisk} />
            ) : null}
          </View>
          {usernameStatus === 'taken' || usernameStatus === 'invalid' ? (
            <Text style={styles.usernameHintError}>
              {usernameStatus === 'taken' ? 'Already taken.' : 'Letters, numbers, underscore only — 3-20 characters.'}
            </Text>
          ) : null}

          <Text style={styles.label}>Date of birth</Text>
          {loadingProfile ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginBottom: spacing.lg }} />
          ) : (
            <DatePicker value={dateOfBirth} onChange={setDateOfBirth} maximumDate={new Date()} placeholder="Not set" />
          )}

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={styles.input}
            placeholder="Not set"
            placeholderTextColor={colors.textMuted}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            autoComplete="tel"
          />

          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Not set"
            placeholderTextColor={colors.textMuted}
            value={address}
            onChangeText={setAddress}
            autoComplete="street-address"
          />

          <Text style={styles.label}>Gender</Text>
          <View style={{ marginBottom: genderSelection === SELF_DESCRIBE ? spacing.sm : spacing.lg }}>
            <SelectField
              value={genderSelection}
              onChange={(option) => setGender(option === SELF_DESCRIBE ? '' : option)}
              options={GENDER_OPTIONS}
              placeholder="Not set"
              title="Gender"
            />
          </View>
          {genderSelection === SELF_DESCRIBE ? (
            <TextInput
              style={styles.input}
              placeholder="Describe how you identify"
              placeholderTextColor={colors.textMuted}
              value={gender}
              onChangeText={setGender}
            />
          ) : null}

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
      <Toast toast={toast} onHide={hideToast} />
      <ConfirmModal request={request} onRespond={respond} />
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
    photoFallback: {
      width: 88,
      height: 88,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentSoft,
    },
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
    usernameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      marginBottom: spacing.xs,
    },
    atSign: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
    usernameInput: { flex: 1, fontSize: 16, color: colors.textPrimary },
    usernameHintError: { ...typography.meta, color: colors.atRisk, marginBottom: spacing.lg },
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
