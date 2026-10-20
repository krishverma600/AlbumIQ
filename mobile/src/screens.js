import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';

import { useApp } from './context/AppContext';
import { Card, HeroCard, Input, Label, PrimaryButton, Screen, SecondaryButton, Subtitle, Title } from './components/UI';
import { createEvent, getEventByCode, listEvents } from './services/events';
import { getProfile, login, logout, registerPhotographer, requestPasswordReset, resetPassword, updateProfile } from './services/auth';
import { getUploadStatus, importDrivePhotos, uploadPhotos } from './services/photos';
import { searchPhotos } from './services/search';
import { saveSession } from './lib/session';
import { theme } from './theme';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
}

async function pickImages({ multiple = false }) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission required', 'Please allow photo library access.');
    return [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: multiple,
    quality: 0.9,
  });
  if (result.canceled) return [];
  return result.assets || [];
}

export function HomeScreen({ navigation }) {
  return (
    <Screen>
      <StatusBar style="dark" />
      <HeroCard>
        <Text style={styles.pill}>FindMyShaadi Pics</Text>
        <Title style={{ marginTop: 14 }}>Wedding memories, found faster on mobile.</Title>
        <Subtitle style={{ marginTop: 10 }}>
          Guests enter the event code, upload one selfie, and receive a personal event gallery. Photographers manage events, uploads, QR sharing, and profile settings from the same app.
        </Subtitle>
        <View style={styles.rowGap}>
          <PrimaryButton label="Start guest flow" onPress={() => navigation.navigate('GuestEventAccess')} />
          <SecondaryButton label="Photographer login" onPress={() => navigation.navigate('AdminLogin')} />
        </View>
      </HeroCard>

      <Card>
        <Title style={{ fontSize: 22, lineHeight: 28 }}>Guest flow</Title>
        <Subtitle style={{ marginTop: 8 }}>Event code → selfie → AI search → gallery results.</Subtitle>
      </Card>

      <Card>
        <Title style={{ fontSize: 22, lineHeight: 28 }}>Photographer flow</Title>
        <Subtitle style={{ marginTop: 8 }}>Register → create event → upload photos → share QR and event code.</Subtitle>
      </Card>
    </Screen>
  );
}

export function GuestEventAccessScreen({ navigation }) {
  const { setGuestEvent } = useApp();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  async function continueFlow() {
    if (!code.trim()) {
      Alert.alert('Missing code', 'Please enter the event code first.');
      return;
    }
    try {
      setLoading(true);
      const event = await getEventByCode(code.trim().toUpperCase());
      setPreview(event);
      setGuestEvent(code.trim().toUpperCase(), event);
      navigation.navigate('GuestSelfie');
    } catch (_error) {
      Alert.alert('Event not found', 'Please check the event code and try again.');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <HeroCard>
        <Text style={styles.pill}>Guest step 1</Text>
        <Title style={{ marginTop: 14 }}>Enter the event code.</Title>
        <Subtitle style={{ marginTop: 10 }}>
          Use the code shared by the photographer. Once verified, you can upload a selfie and open your personalized gallery.
        </Subtitle>
      </HeroCard>

      <Card>
        <Label>Wedding event code</Label>
        <Input autoCapitalize="characters" placeholder="WED-3PPG" value={code} onChangeText={setCode} />
        <PrimaryButton label="Continue" loading={loading} onPress={continueFlow} style={{ marginTop: 14 }} />
      </Card>

      <Card>
        <Title style={{ fontSize: 22, lineHeight: 28 }}>Preview</Title>
        <Subtitle style={{ marginTop: 8 }}>
          {preview ? `${preview.event_name} · ${formatDate(preview.event_date)}` : 'Event preview will appear here after validation.'}
        </Subtitle>
      </Card>
    </Screen>
  );
}

export function GuestSelfieScreen({ navigation }) {
  const { guestState, setGuestSelfie } = useApp();
  const [selecting, setSelecting] = useState(false);

  async function chooseSelfie() {
    try {
      setSelecting(true);
      const assets = await pickImages({ multiple: false });
      if (assets[0]) setGuestSelfie(assets[0]);
    } catch (_error) {
      Alert.alert('Photo unavailable', 'Please choose another photo and try again.');
    } finally {
      setSelecting(false);
    }
  }

  async function takeSelfie() {
    try {
      setSelecting(true);
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera permission needed', 'Allow camera access in settings or choose a photo from your gallery.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'], cameraType: ImagePicker.CameraType.front, quality: 1,
      });
      if (!result.canceled && result.assets?.[0]) setGuestSelfie(result.assets[0]);
    } catch (_error) {
      Alert.alert('Camera unavailable', 'Check that your camera is available, or choose a photo from your gallery.');
    } finally {
      setSelecting(false);
    }
  }

  return (
    <Screen>
      <HeroCard>
        <Text style={styles.pill}>Guest step 2</Text>
        <Title style={{ marginTop: 14 }}>Upload one clear selfie.</Title>
        <Subtitle style={{ marginTop: 10 }}>
          Event {guestState.eventCode || '-'} is active. Use a front-facing photo for better matching.
        </Subtitle>
      </HeroCard>

      <Card>
        <PrimaryButton label="Take a live selfie" loading={selecting} onPress={takeSelfie} />
        <PrimaryButton label="Choose selfie from gallery" disabled={selecting} onPress={chooseSelfie} style={{ marginTop: 12 }} />
        {guestState.selfie ? (
          <Image source={{ uri: guestState.selfie.uri }} style={styles.previewImage} />
        ) : (
          <Subtitle style={{ marginTop: 14 }}>Your selected selfie preview will appear here.</Subtitle>
        )}
      </Card>

      <PrimaryButton
        label="Find my photos"
        disabled={!guestState.selfie}
        onPress={() => navigation.navigate('GuestGallery')}
      />
    </Screen>
  );
}

export function GuestGalleryScreen({ navigation }) {
  const { guestState, setGuestResults } = useApp();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!guestState.selfie || guestState.matches.length) return;
      try {
        setLoading(true);
        const data = await searchPhotos({ eventCode: guestState.eventCode, selfie: guestState.selfie });
        if (!mounted) return;
        setGuestResults({
          matches: data.matched_images || [],
          matchedCount: data.matched_count || 0,
          searchId: data.search_id || '',
          albumStatus: data.album_status || null,
          searchError: '',
        });
      } catch (error) {
        if (!mounted) return;
        setGuestResults({
          matches: [],
          matchedCount: 0,
          searchId: '',
          searchError: error?.response?.data?.detail || 'Search failed.',
        });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [guestState.eventCode, guestState.matches.length, guestState.selfie, setGuestResults]);

  return (
    <Screen>
      <HeroCard>
        <Text style={styles.pill}>Guest step 3</Text>
        <Title style={{ marginTop: 14 }}>Your photo search results.</Title>
        <Subtitle style={{ marginTop: 10 }}>
          {loading
            ? 'Searching the wedding album now...'
            : `${guestState.matchedCount || guestState.matches.length} match(es) found for ${guestState.eventCode || '-'}.`}
        </Subtitle>
      </HeroCard>

      {guestState.searchError ? (
        <Card>
          <Title style={{ fontSize: 22, lineHeight: 28 }}>Search issue</Title>
          <Subtitle style={{ marginTop: 8 }}>{guestState.searchError}</Subtitle>
        </Card>
      ) : null}

      {!loading && !guestState.matches.length && !guestState.searchError ? (
        <Card>
          <Subtitle>No matching face was found in this event's searchable photos.</Subtitle>
          {guestState.albumStatus ? <Subtitle>{guestState.albumStatus.searchable} of {guestState.albumStatus.total} photos have searchable faces; {guestState.albumStatus.no_faces} have no detected faces and {guestState.albumStatus.pending} are still processing.</Subtitle> : null}
          <Subtitle>The person must appear in the photographer's album. The reference selfie is not added to the album.</Subtitle>
        </Card>
      ) : null}

      <SecondaryButton label="Choose another selfie" onPress={() => navigation.navigate('GuestSelfie')} />

      <FlatList
        data={guestState.matches}
        keyExtractor={(item, index) => String(item.photo_id || index)}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 14 }}>
            <Image source={{ uri: item.image_url }} style={styles.galleryImage} />
            <Subtitle style={{ marginTop: 10 }}>
              Matching face found
            </Subtitle>
          </Card>
        )}
      />
    </Screen>
  );
}

export function AdminLoginScreen() {
  const { setSession } = useApp();
  const [form, setForm] = useState({ email: 'admin@example.com', password: 'password123' });
  const [loading, setLoading] = useState(false);

  async function submit() {
    try {
      setLoading(true);
      const payload = await login(form);
      await saveSession(payload);
      setSession(payload);
    } catch (error) {
      Alert.alert('Login failed', error?.response?.data?.detail || 'Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <HeroCard>
        <Text style={styles.pill}>Photographer login</Text>
        <Title style={{ marginTop: 14 }}>Sign in to the studio dashboard.</Title>
      </HeroCard>
      <Card>
        <Label>Email</Label>
        <Input autoCapitalize="none" value={form.email} onChangeText={(email) => setForm((c) => ({ ...c, email }))} />
        <Label style={styles.spacer}>Password</Label>
        <Input secureTextEntry value={form.password} onChangeText={(password) => setForm((c) => ({ ...c, password }))} />
        <PrimaryButton label="Login" loading={loading} onPress={submit} style={{ marginTop: 14 }} />
      </Card>
    </Screen>
  );
}

export function AdminRegisterScreen() {
  const { setSession } = useApp();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    password: '',
    confirm_password: '',
  });

  async function submit() {
    try {
      setLoading(true);
      const payload = await registerPhotographer(form);
      await saveSession(payload);
      setSession(payload);
    } catch (error) {
      Alert.alert('Registration failed', JSON.stringify(error?.response?.data || 'Unable to register.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <HeroCard>
        <Text style={styles.pill}>Photographer registration</Text>
        <Title style={{ marginTop: 14 }}>Create a new studio account.</Title>
      </HeroCard>
      <Card>
        {['full_name', 'phone_number', 'email', 'password', 'confirm_password'].map((key) => (
          <View key={key} style={{ marginBottom: 12 }}>
            <Label>{key.replaceAll('_', ' ')}</Label>
            <Input
              autoCapitalize={key === 'email' ? 'none' : 'sentences'}
              secureTextEntry={key.includes('password')}
              value={form[key]}
              onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))}
            />
          </View>
        ))}
        <PrimaryButton label="Create account" loading={loading} onPress={submit} />
      </Card>
    </Screen>
  );
}

export function AdminForgotPasswordScreen() {
  const [requesting, setRequesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [email, setEmail] = useState('');
  const [resetData, setResetData] = useState({
    email: '',
    otp_code: '',
    new_password: '',
    confirm_password: '',
  });

  async function sendCode() {
    try {
      setRequesting(true);
      const payload = await requestPasswordReset({ email });
      setResetData((current) => ({
        ...current,
        email,
        otp_code: payload.debug_code || '',
      }));
      Alert.alert('Reset code processed', payload.delivery_detail || payload.message);
    } catch (error) {
      Alert.alert('Request failed', error?.response?.data?.detail || 'Unable to send reset code.');
    } finally {
      setRequesting(false);
    }
  }

  async function submitReset() {
    try {
      setResetting(true);
      const payload = await resetPassword(resetData);
      Alert.alert('Password updated', payload.message);
    } catch (error) {
      Alert.alert('Reset failed', error?.response?.data?.detail || 'Unable to reset password.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <Screen>
      <HeroCard>
        <Text style={styles.pill}>Password recovery</Text>
        <Title style={{ marginTop: 14 }}>Reset by SMS OTP.</Title>
      </HeroCard>
      <Card>
        <Label>Photographer email</Label>
        <Input autoCapitalize="none" value={email} onChangeText={setEmail} />
        <PrimaryButton label="Send code" loading={requesting} onPress={sendCode} style={{ marginTop: 14 }} />
      </Card>
      <Card>
        {['email', 'otp_code', 'new_password', 'confirm_password'].map((key) => (
          <View key={key} style={{ marginBottom: 12 }}>
            <Label>{key.replaceAll('_', ' ')}</Label>
            <Input
              autoCapitalize="none"
              secureTextEntry={key.includes('password')}
              value={resetData[key]}
              onChangeText={(value) => setResetData((current) => ({ ...current, [key]: value }))}
            />
          </View>
        ))}
        <PrimaryButton label="Update password" loading={resetting} onPress={submitReset} />
      </Card>
    </Screen>
  );
}

export function AdminDashboardScreen({ navigation }) {
  const { session, setSession } = useApp();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await listEvents();
        if (mounted) setEvents(data);
      } catch (_error) {
        if (mounted) Alert.alert('Unable to load events');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const totalUploads = useMemo(
    () => events.reduce((sum, event) => sum + Number(event.photo_count || 0), 0),
    [events]
  );

  return (
    <Screen>
      <HeroCard>
        <Text style={styles.pill}>Studio dashboard</Text>
        <Title style={{ marginTop: 14 }}>{session?.user?.full_name || session?.user?.email}</Title>
        <Subtitle style={{ marginTop: 10 }}>
          {loading ? 'Loading events...' : `${events.length} event(s) · ${totalUploads} uploaded photo(s)`}
        </Subtitle>
      </HeroCard>

      <Card>
        <PrimaryButton label="Create new event" onPress={() => navigation.navigate('AdminCreateEvent')} />
        <SecondaryButton label="Upload event photos" onPress={() => navigation.navigate('AdminUploadPhotos')} style={{ marginTop: 12 }} />
        <SecondaryButton label="Studio profile" onPress={() => navigation.navigate('AdminProfile')} style={{ marginTop: 12 }} />
        <SecondaryButton
          label="Logout"
          onPress={async () => {
            await logout();
            setSession(null);
          }}
          style={{ marginTop: 12 }}
        />
      </Card>

      {events.map((event) => (
        <Card key={event.id}>
          <Title style={{ fontSize: 22, lineHeight: 28 }}>{event.event_name}</Title>
          <Subtitle style={{ marginTop: 8 }}>
            {event.event_code} · {formatDate(event.event_date)} · {event.photo_count || 0} photos
          </Subtitle>
        </Card>
      ))}
    </Screen>
  );
}

export function AdminCreateEventScreen() {
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const [form, setForm] = useState({
    event_name: 'Aarav & Siya',
    event_date: '2026-12-12',
  });

  async function submit() {
    try {
      setLoading(true);
      const payload = await createEvent(form);
      setCreated(payload);
      Alert.alert('Event created', `${payload.event_code}`);
    } catch (error) {
      Alert.alert('Create failed', error?.response?.data?.detail || 'Unable to create event.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <HeroCard>
        <Text style={styles.pill}>Create wedding</Text>
        <Title style={{ marginTop: 14 }}>Generate event code and QR.</Title>
      </HeroCard>
      <Card>
        <Label>Event name</Label>
        <Input value={form.event_name} onChangeText={(event_name) => setForm((c) => ({ ...c, event_name }))} />
        <Label style={styles.spacer}>Event date</Label>
        <Input value={form.event_date} onChangeText={(event_date) => setForm((c) => ({ ...c, event_date }))} />
        <PrimaryButton label="Create event" loading={loading} onPress={submit} style={{ marginTop: 14 }} />
      </Card>
      {created ? (
        <Card>
          <Title style={{ fontSize: 22, lineHeight: 28 }}>{created.event_code}</Title>
          <Subtitle style={{ marginTop: 8 }}>{created.guest_portal_url}</Subtitle>
          {created.qr_url ? <Image source={{ uri: created.qr_url }} style={styles.qrImage} /> : null}
          <Subtitle style={{ marginTop: 8 }}>
            SMS: {created.sms_notification?.sent ? 'sent' : created.sms_notification?.detail || 'not sent'}
          </Subtitle>
        </Card>
      ) : null}
    </Screen>
  );
}

export function AdminUploadPhotosScreen() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [files, setFiles] = useState([]);
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [driveLinks, setDriveLinks] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await listEvents();
        if (!mounted) return;
        setEvents(data);
        setSelectedEvent(data[0] || null);
      } catch (_error) {
        if (mounted) Alert.alert('Unable to load events.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadStatus() {
      if (!selectedEvent?.id) return;
      try {
        const data = await getUploadStatus(selectedEvent.id);
        if (mounted) setStatusData(data);
      } catch (_error) {
        if (mounted) setStatusData(null);
      }
    }
    loadStatus();
    const timer = setInterval(loadStatus, 5000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [selectedEvent]);

  async function importFromDrive() {
    const links = driveLinks.split(/\r?\n/).map((link) => link.trim()).filter(Boolean);
    if (!selectedEvent || !links.length || links.length > 20) {
      Alert.alert('Check photo links', 'Select a wedding and paste 1 to 20 individual Google Drive photo links.');
      return;
    }
    try {
      setImporting(true);
      const data = await importDrivePhotos({ eventCode: selectedEvent.event_code, links });
      if (data.queued) setDriveLinks('');
      Alert.alert('Drive import', `${data.queued} photo(s) queued for import. ${data.failed} could not start. Follow progress below.`);
    } catch (error) {
      Alert.alert('Import failed', error?.response?.data?.detail || error?.response?.data?.links?.[0] || 'Unable to start the Drive import.');
    } finally {
      setImporting(false);
    }
  }

  async function chooseFiles() {
    const assets = await pickImages({ multiple: true });
    setFiles(assets);
  }

  async function submit() {
    if (!selectedEvent || !files.length) {
      Alert.alert('Missing data', 'Select an event and choose photos first.');
      return;
    }
    try {
      setUploading(true);
      const uploaded = await uploadPhotos({ eventCode: selectedEvent.event_code, files });
      if (uploaded.failed) {
        Alert.alert("Processing unavailable", `${uploaded.failed} photo(s) could not be queued. Check the worker connection.`);
        return;
      }
      const refreshed = await getUploadStatus(selectedEvent.id).catch(() => null);
      setStatusData(refreshed);
      setFiles([]);
      Alert.alert('Upload complete', `Uploaded photos for ${selectedEvent.event_code}`);
    } catch (error) {
      Alert.alert('Upload failed', error?.response?.data?.detail || 'Unable to upload photos.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Screen>
      <HeroCard>
        <Text style={styles.pill}>Upload photos</Text>
        <Title style={{ marginTop: 14 }}>Upload to a specific wedding.</Title>
        <Subtitle style={{ marginTop: 10 }}>
          {loading ? 'Loading events...' : selectedEvent ? `${selectedEvent.event_name} · ${selectedEvent.event_code}` : 'No events available yet.'}
        </Subtitle>
      </HeroCard>

      <FlatList
        horizontal
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 12 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelectedEvent(item)}
            style={[
              styles.eventChip,
              selectedEvent?.id === item.id ? styles.eventChipActive : null,
            ]}
          >
            <Text style={styles.eventChipTitle}>{item.event_code}</Text>
            <Text style={styles.eventChipText}>{item.event_name}</Text>
          </Pressable>
        )}
      />

      <Card>
        <Title style={{ fontSize: 22, lineHeight: 28 }}>Import from Google Drive</Title>
        <Subtitle style={{ marginTop: 10 }}>Share each photo with “Anyone with the link” and allow downloads. Paste one photo link per line. Up to 20 photos, 20 MB each. Folder links are not supported.</Subtitle>
        <Input multiline numberOfLines={4} autoCapitalize="none" autoCorrect={false}
          placeholder="https://drive.google.com/file/d/.../view"
          accessibilityLabel="Google Drive photo links"
          value={driveLinks} onChangeText={setDriveLinks} editable={!importing} />
        <PrimaryButton label="Import photos from Drive" loading={importing}
          disabled={!selectedEvent || !driveLinks.trim()} onPress={importFromDrive} style={{ marginTop: 14 }} />
      </Card>

      <Card>
        <PrimaryButton label="Choose event photos" onPress={chooseFiles} />
        <Subtitle style={{ marginTop: 12 }}>{files.length ? `${files.length} file(s) selected` : 'No files selected yet.'}</Subtitle>
        <PrimaryButton label="Upload photos" loading={uploading} onPress={submit} style={{ marginTop: 14 }} />
      </Card>

      {statusData?.photos?.map((photo) => (
        <Card key={photo.id}>
          <Subtitle>{photo.original_filename}</Subtitle>
          <Subtitle style={{ marginTop: 6 }}>Status: {photo.processing_status}</Subtitle>
          {photo.processing_error ? <Subtitle style={{ marginTop: 6 }}>{photo.processing_error}</Subtitle> : null}
        </Card>
      ))}
    </Screen>
  );
}

export function AdminProfileScreen() {
  const { session, setSession } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone_number: '',
    first_name: '',
    last_name: '',
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const profile = await getProfile();
        if (!mounted) return;
        setForm({
          full_name: profile.full_name || '',
          phone_number: profile.phone_number || '',
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
        });
      } catch (_error) {
        if (mounted) Alert.alert('Unable to load profile.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function submit() {
    try {
      setSaving(true);
      const profile = await updateProfile(form);
      const nextSession = { ...session, user: profile };
      await saveSession(nextSession);
      setSession(nextSession);
      Alert.alert('Profile updated');
    } catch (error) {
      Alert.alert('Update failed', error?.response?.data?.detail || 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <HeroCard>
        <Text style={styles.pill}>Studio profile</Text>
        <Title style={{ marginTop: 14 }}>{loading ? 'Loading...' : session?.user?.email}</Title>
      </HeroCard>
      <Card>
        {['full_name', 'phone_number', 'first_name', 'last_name'].map((key) => (
          <View key={key} style={{ marginBottom: 12 }}>
            <Label>{key.replaceAll('_', ' ')}</Label>
            <Input value={form[key]} onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))} />
          </View>
        ))}
        <PrimaryButton label="Save profile" loading={saving} onPress={submit} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1E2D7',
    color: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  rowGap: {
    marginTop: 16,
    gap: 12,
  },
  previewImage: {
    width: '100%',
    height: 320,
    marginTop: 14,
    borderRadius: 20,
  },
  galleryImage: {
    width: '100%',
    height: 240,
    borderRadius: 18,
  },
  qrImage: {
    width: 180,
    height: 180,
    marginTop: 14,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  eventChip: {
    minWidth: 170,
    backgroundColor: theme.colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: 14,
  },
  eventChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#F5E7DE',
  },
  eventChipTitle: {
    color: theme.colors.primary,
    fontWeight: '700',
    marginBottom: 6,
  },
  eventChipText: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  spacer: {
    marginTop: 12,
  },
});
