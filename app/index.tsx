import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  FlatList,
  Image,
  ActivityIndicator,
  Keyboard
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { searchActors, ActorSuggestion } from '../src/services/bsky';
import { useColorScheme } from 'react-native';

export default function Home() {
  const [handle, setHandle] = useState('');
  const [suggestions, setSuggestions] = useState<ActorSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleTextChange = (text: string) => {
    setHandle(text);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (text.trim().length === 0) {
      setShowSuggestions(false);
      setSuggestions([]);
      return;
    }

    setLoadingSuggestions(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchActors(text.trim(), 5);
        setSuggestions(results);
        setShowSuggestions(true);
        setLoadingSuggestions(false);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
        setLoadingSuggestions(false);
      }
    }, 300);
  };

  const selectSuggestion = (suggestion: ActorSuggestion) => {
    setHandle(suggestion.handle);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const handleSearch = () => {
    if (handle.trim()) {
      const cleanHandle = handle.trim().replace(/^@/, '');
      setShowSuggestions(false);
      router.push(`/${cleanHandle}`);
    }
  };

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'ja' ? 'en' : 'ja';
    void i18n.changeLanguage(nextLang);
  };

  const renderSuggestion = ({ item }: { item: ActorSuggestion }) => (
    <TouchableOpacity 
      style={[styles.suggestionItem, isDark && styles.suggestionItemDark]}
      onPress={() => selectSuggestion(item)}
    >
      {item.avatar ? (
        <Image source={{ uri: item.avatar }} style={styles.suggestionAvatar} />
      ) : (
        <View style={[styles.suggestionAvatar, { backgroundColor: '#ccc' }]} />
      )}
      <View style={styles.suggestionInfo}>
        <Text style={[styles.suggestionDisplayName, isDark && styles.suggestionDisplayNameDark]} numberOfLines={1}>
          {item.displayName || item.handle}
        </Text>
        <Text style={[styles.suggestionHandle, isDark && styles.suggestionHandleDark]} numberOfLines={1}>
          @{item.handle}
        </Text>
        {item.description && (
          <Text style={[styles.suggestionDescription, isDark && styles.suggestionDescriptionDark]} numberOfLines={1}>
            {item.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <TouchableOpacity 
          style={[styles.languageToggle, isDark && styles.languageToggleDark]}
          onPress={toggleLanguage}
        >
          <Text style={styles.languageToggleText}>
            {i18n.language === 'ja' ? 'EN' : '日本語'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('home.title')}</Text>
        <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>{t('home.subtitle')}</Text>
        
        <View style={styles.searchContainer}>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              placeholder={t('home.placeholder')}
              placeholderTextColor={isDark ? '#555' : '#999'}
              value={handle}
              onChangeText={handleTextChange}
              autoCapitalize="none"
              onSubmitEditing={handleSearch}
              onFocus={() => {
                if (handle.trim().length > 0 && suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
            />
            <TouchableOpacity style={styles.button} onPress={handleSearch}>
              <Text style={styles.buttonText}>{t('home.button')}</Text>
            </TouchableOpacity>
          </View>

          {showSuggestions && (
            <View style={[styles.suggestionsContainer, isDark && styles.suggestionsContainerDark]}>
              {loadingSuggestions ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#0085ff" />
                </View>
              ) : suggestions.length > 0 ? (
                <FlatList
                  data={suggestions}
                  keyExtractor={(item) => item.did}
                  renderItem={renderSuggestion}
                  style={styles.suggestionsList}
                  keyboardShouldPersistTaps="handled"
                />
              ) : (
                <Text style={[styles.noSuggestionsText, isDark && styles.noSuggestionsTextDark]}>{t('home.noSuggestions')}</Text>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  containerDark: {
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  languageToggle: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  languageToggleDark: {
    backgroundColor: '#333',
  },
  languageToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0085ff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0085ff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 24,
  },
  subtitleDark: {
    color: '#bbb',
  },
  searchContainer: {
    width: '100%',
    position: 'relative',
  },
  inputContainer: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    zIndex: 1,
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  inputDark: {
    backgroundColor: '#161616',
    borderColor: '#333',
    color: '#fff',
  },
  button: {
    backgroundColor: '#0085ff',
    paddingHorizontal: 25,
    justifyContent: 'center',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 55,
    left: 0,
    right: 60,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  suggestionsContainerDark: {
    backgroundColor: '#161616',
    borderColor: '#333',
  },
  suggestionsList: {
    maxHeight: 300,
  },
  suggestionItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  suggestionItemDark: {
    borderBottomColor: '#333',
  },
  suggestionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionDisplayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  suggestionDisplayNameDark: {
    color: '#fff',
  },
  suggestionHandle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  suggestionHandleDark: {
    color: '#aaa',
  },
  suggestionDescription: {
    fontSize: 12,
    color: '#999',
  },
  suggestionDescriptionDark: {
    color: '#777',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noSuggestionsText: {
    padding: 20,
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
  },
  noSuggestionsTextDark: {
    color: '#777',
  },
});

