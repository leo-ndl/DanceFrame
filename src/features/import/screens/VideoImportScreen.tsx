import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { videoPoseExtractor } from '../services/VideoPoseExtractor';

// ── Design tokens (matching TikTok import mockup) ─────────────────────────────
const C = {
  bg: '#0A0E0E',
  surface: '#141B1B',
  surface2: '#1B2424',
  text: '#ECEFEE',
  textDim: '#69767A',
  accent: '#1FE0C9',
  accentSoft: 'rgba(31,224,201,0.16)',
  warn: '#FF6B4A',
  border: 'rgba(236,239,238,0.08)',
  accentBorder: 'rgba(31,224,201,0.3)',
};

interface Props {
  navigation: any;
}

export const VideoImportScreen: React.FC<Props> = ({ navigation }) => {
  const [isPicking, setIsPicking] = useState(false);
  const [linkText, setLinkText] = useState('');

  const handlePickVideo = async () => {
    if (!videoPoseExtractor.isAvailable()) {
      Alert.alert('Not Available', 'Video import is not supported on this device.');
      return;
    }
    setIsPicking(true);
    try {
      const videoUri = await videoPoseExtractor.pickVideo();
      navigation.navigate('VideoProcessing', { videoUri });
    } catch (err: any) {
      if (err?.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('Error', err?.message ?? 'Failed to pick video');
      }
    } finally {
      setIsPicking(false);
    }
  };

  const handlePasteLink = () => {
    Alert.alert(
      'Coming Soon',
      'Direct TikTok link import will be available in a future update. For now, save the video to your Photos and pick it from the gallery.',
      [{ text: 'Got it' }],
    );
  };

  const handleShareHint = () => {
    Alert.alert(
      'Share from TikTok',
      'In TikTok, tap Share → find this app in the share sheet. This feature is coming soon.',
      [{ text: 'Got it' }],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Import Move</Text>
        <View style={styles.topSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>From TikTok</Text>
          <Text style={styles.title}>Turn any clip into a drill</Text>
          <Text style={styles.subtitle}>
            Paste a TikTok link and we'll pull out the move so you can practice it with live feedback.
          </Text>
        </View>

        {/* Link paste card */}
        <TouchableOpacity style={styles.inputCard} onPress={handlePasteLink} activeOpacity={0.8}>
          <LinkIcon />
          <TextInput
            style={styles.inputField}
            placeholder="Paste TikTok link here"
            placeholderTextColor={C.textDim}
            value={linkText}
            onChangeText={setLinkText}
            editable={false}
            pointerEvents="none"
          />
          <TouchableOpacity style={styles.pasteBtn} onPress={handlePasteLink}>
            <Text style={styles.pasteBtnText}>Paste</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* OR divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Share hint card */}
        <TouchableOpacity style={styles.shareCard} onPress={handleShareHint} activeOpacity={0.8}>
          <View style={styles.shareIcon}>
            <Text style={styles.shareEmoji}>📲</Text>
          </View>
          <View style={styles.shareTextBlock}>
            <Text style={styles.shareTitle}>Share directly from TikTok</Text>
            <Text style={styles.shareSub}>Tap Share → choose this app in the sheet</Text>
          </View>
        </TouchableOpacity>

        {/* How it works */}
        <View style={styles.stepsSection}>
          <Text style={styles.sectionLabel}>How it works</Text>
          {[
            { icon: '🎬', text: 'Save the TikTok video to your Photos' },
            { icon: '📂', text: 'Pick it from your gallery below' },
            { icon: '🤖', text: 'AI extracts only the key poses from each frame' },
            { icon: '🕺', text: 'Practice with real-time stickman coaching' },
          ].map((step, i) => (
            <View key={i} style={styles.step}>
              <Text style={styles.stepEmoji}>{step.icon}</Text>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Gallery CTA pinned at bottom */}
      <View style={styles.ctaWrap}>
        <TouchableOpacity
          style={[styles.galleryBtn, isPicking && styles.galleryBtnDisabled]}
          onPress={handlePickVideo}
          disabled={isPicking}
          activeOpacity={0.85}
        >
          <Text style={styles.galleryBtnText}>
            {isPicking ? 'Opening Gallery…' : '📂  Pick Video from Gallery'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ── Small link icon ───────────────────────────────────────────────────────────

function LinkIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07L11.5 4.5"
        stroke={C.textDim}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M14 11a5 5 0 00-7.07 0L4.1 13.83a5 5 0 007.07 7.07L12.5 19.5"
        stroke={C.textDim}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  backChevron: { color: C.text, fontSize: 22, lineHeight: 26, marginTop: -2 },
  topTitle: { color: C.text, fontSize: 14, fontWeight: '800', letterSpacing: -0.1 },
  topSpacer: { width: 34 },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  header: { paddingHorizontal: 20, paddingTop: 8 },
  eyebrow: {
    fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
    color: C.accent, fontWeight: '800', marginBottom: 6,
  },
  title: {
    fontSize: 24, fontWeight: '900', letterSpacing: -0.5,
    color: C.text, lineHeight: 29, marginBottom: 8,
  },
  subtitle: { fontSize: 13, color: C.textDim, fontWeight: '500', lineHeight: 20 },

  inputCard: {
    marginHorizontal: 20, marginTop: 22,
    backgroundColor: C.surface,
    borderWidth: 1.5, borderColor: C.accentBorder,
    borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  inputField: {
    flex: 1, fontSize: 13.5, color: C.textDim, fontWeight: '500',
  },
  pasteBtn: {
    backgroundColor: C.accentSoft,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 9,
  },
  pasteBtnText: { fontSize: 12, fontWeight: '800', color: C.accent },

  divider: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginTop: 18,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: {
    fontSize: 11, color: C.textDim, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
  },

  shareCard: {
    marginHorizontal: 20, marginTop: 18,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 14,
  },
  shareIcon: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: C.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  shareEmoji: { fontSize: 18 },
  shareTextBlock: { flex: 1 },
  shareTitle: { fontSize: 13, fontWeight: '700', color: C.text },
  shareSub: { fontSize: 11, color: C.textDim, marginTop: 2 },

  stepsSection: { marginTop: 30, paddingHorizontal: 20 },
  sectionLabel: {
    fontSize: 12, letterSpacing: 1, textTransform: 'uppercase',
    color: C.textDim, fontWeight: '700', marginBottom: 12,
  },
  step: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 8,
  },
  stepEmoji: { fontSize: 20, marginRight: 12 },
  stepText: { color: C.text, fontSize: 13, flex: 1, fontWeight: '500' },

  spacer: { height: 90 },

  ctaWrap: {
    position: 'absolute', bottom: 32, left: 20, right: 20,
  },
  galleryBtn: {
    backgroundColor: C.accent,
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center',
  },
  galleryBtnDisabled: { opacity: 0.6 },
  galleryBtnText: {
    color: '#06201D', fontSize: 15, fontWeight: '800',
  },
});
