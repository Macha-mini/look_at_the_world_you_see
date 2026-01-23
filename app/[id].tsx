import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  Image, 
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Modal,
  Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getMergedTimeline, Post } from '../src/services/bsky';
import { useTranslation } from 'react-i18next';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useColorScheme } from 'react-native';

const { width, height } = Dimensions.get('window');

const RichText = ({ text, facets, isDark }: { text: string; facets?: any[]; isDark: boolean }) => {
  if (!facets || facets.length === 0) {
    return <Text style={[styles.postText, isDark && styles.postTextDark]}>{text}</Text>;
  }

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  const utf8Text = Buffer.from(text, 'utf8');

  facets.sort((a, b) => a.index.byteStart - b.index.byteStart).forEach((facet, i) => {
    if (facet.index.byteStart > lastIndex) {
      elements.push(utf8Text.slice(lastIndex, facet.index.byteStart).toString('utf8'));
    }

    const facetText = utf8Text.slice(facet.index.byteStart, facet.index.byteEnd).toString('utf8');
    const feature = facet.features[0];

    if (feature.$type === 'app.bsky.richtext.facet#link') {
      elements.push(
        <Text 
          key={i} 
          style={styles.link} 
          onPress={() => Linking.openURL(feature.uri)}
        >
          {facetText}
        </Text>
      );
    } else {
      elements.push(facetText);
    }

    lastIndex = facet.index.byteEnd;
  });

  if (lastIndex < utf8Text.length) {
    elements.push(utf8Text.slice(lastIndex).toString('utf8'));
  }

  return <Text style={[styles.postText, isDark && styles.postTextDark]}>{elements}</Text>;
};

const PostVideo = ({ playlist, thumbnail }: { playlist: string; thumbnail?: string }) => {
  const player = useVideoPlayer(playlist, (player) => {
    player.loop = true;
  });

  return (
    <VideoView
      style={styles.embeddedVideo}
      player={player}
      allowsFullscreen
      allowsPictureInPicture
    />
  );
};

export default function TimelinePage() {
  const { id } = useLocalSearchParams();
  const actorId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursorMap, setCursorMap] = useState<Map<string, string> | undefined>(undefined);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      void fetchTimeline(false, false, id);
    }
  }, [id]);

  const fetchTimeline = async (isRefreshing = false, isLoadMore = false, targetId?: string) => {
    const handleToFetch = targetId || id;
    if (!handleToFetch) return;
    
    if (isLoadMore) {
      if (loadingMore) return;
      setLoadingMore(true);
    } else if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const currentCursorMap = isLoadMore ? cursorMap : undefined;
      const result = await getMergedTimeline(handleToFetch, currentCursorMap);
      
      if (isLoadMore) {
        setPosts((prev: Post[]) => [...prev, ...result.posts]);
      } else {
        setPosts(result.posts);
      }
      setCursorMap(result.cursorMap);
    } catch (e: any) {
      console.error(e);
      setError(t('timeline.error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const fetchUserTimeline = async (user: { handle: string; did: string }) => {
    // Navigate to the new user's timeline
    router.push(`/${user.handle}`);
  };

  const renderEmbed = (embed: any) => {
    if (!embed) return null;

    if (embed.$type === 'app.bsky.embed.images#view' || embed.$type === 'app.bsky.embed.images') {
      const images = embed.images || [];
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
          {images.map((img: any, i: number) => (
            <TouchableOpacity key={i} onPress={() => setSelectedImage(img.fullsize || img.image)}>
              <Image 
                source={{ uri: img.thumb || img.image }} 
                style={styles.embeddedImage} 
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      );
    }

    if (embed.$type === 'app.bsky.embed.video#view') {
      return (
        <PostVideo 
          playlist={embed.playlist} 
          thumbnail={embed.thumbnail} 
        />
      );
    }

    if (embed.$type === 'app.bsky.embed.external#view' || embed.$type === 'app.bsky.embed.external') {
      const external = embed.external || embed.view?.external;
      if (!external) return null;
      return (
        <TouchableOpacity 
          style={styles.linkCard} 
          onPress={() => Linking.openURL(external.uri)}
        >
          {external.thumb && (
            <Image source={{ uri: external.thumb }} style={styles.linkThumb} />
          )}
          <View style={styles.linkInfo}>
            <Text style={styles.linkTitle} numberOfLines={1}>{external.title}</Text>
            <Text style={styles.linkDesc} numberOfLines={2}>{external.description}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    return null;
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={[styles.postContainer, isDark && styles.postContainerDark]}>
      {item.repostedBy && (
        <View style={styles.repostHeader}>
          <Text style={[styles.repostText, isDark && styles.repostTextDark]}>
            <Text style={{ color: '#27ae60' }}>♻️ </Text>
            {item.repostedBy.displayName || item.repostedBy.handle} {t('timeline.reposted')}
          </Text>
        </View>
      )}
      <View style={styles.postHeader}>
        <TouchableOpacity onPress={() => fetchUserTimeline({ handle: item.author.handle, did: item.author.did })}>
          {item.author.avatar ? (
            <Image source={{ uri: item.author.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: '#ccc' }]} />
          )}
        </TouchableOpacity>
        <View style={styles.authorInfo}>
          <Text style={[styles.displayName, isDark && styles.displayNameDark]}>{item.author.displayName || item.author.handle}</Text>
          <Text style={[styles.handle, isDark && styles.handleDark]}>@{item.author.handle}</Text>
        </View>
      </View>
      <RichText text={item.record.text} facets={item.record.facets} isDark={isDark} />
      {renderEmbed(item.embed)}
      <Text style={[styles.timestamp, isDark && styles.timestampDark]}>{new Date(item.indexedAt).toLocaleString()}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity 
          onPress={() => router.canGoBack() ? router.back() : router.replace('/')} 
          style={styles.backButton}
        >
          <Text style={[styles.backButtonText, isDark && styles.backButtonTextDark]}>← {t('timeline.back')}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, isDark && styles.titleDark]} numberOfLines={1}>
          {t('timeline.title', { handle: id })}
        </Text>
        <TouchableOpacity 
          style={[styles.languageToggle, isDark && styles.languageToggleDark]}
          onPress={() => i18n.changeLanguage(i18n.language === 'ja' ? 'en' : 'ja')}
        >
          <Text style={[styles.languageToggleText, isDark && styles.languageToggleTextDark]}>
            {i18n.language === 'ja' ? 'EN' : '日本語'}
          </Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0085ff" />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>{t('timeline.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item: Post, index: number) => item.uri + item.indexedAt + index}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => fetchTimeline(true)}
          onEndReached={() => {
            if (posts.length > 0) {
              void fetchTimeline(false, true);
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color="#0085ff" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading && posts.length === 0 ? (
              <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>{t('timeline.empty')}</Text>
            ) : null
          }
        />
      )}
      <StatusBar style="auto" />

      <Modal
        visible={!!selectedImage}
        transparent={true}
        onRequestClose={() => setSelectedImage(null)}
      >
        <Pressable 
          style={styles.modalContainer} 
          onPress={() => setSelectedImage(null)}
        >
          {selectedImage && (
            <Image 
              source={{ uri: selectedImage }} 
              style={styles.fullImage} 
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  containerDark: {
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerDark: {
    backgroundColor: '#161616',
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 5,
    width: 40,
  },
  backButtonText: {
    fontSize: 24,
    color: '#0085ff',
    fontWeight: 'bold',
  },
  backButtonTextDark: {
    color: '#0085ff',
  },
  languageToggle: {
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    width: 60,
    alignItems: 'center',
  },
  languageToggleDark: {
    backgroundColor: '#333',
  },
  languageToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0085ff',
  },
  languageToggleTextDark: {
    color: '#0085ff',
  },
  title: {    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#0085ff',
  },
  titleDark: {
    color: '#fff',
  },
  listContent: {
    padding: 10,
  },
  postContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  postContainerDark: {
    backgroundColor: '#161616',
    shadowOpacity: 0.3,
  },
  repostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  repostText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  repostTextDark: {
    color: '#999',
  },
  postHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  authorInfo: {
    justifyContent: 'center',
  },
  displayName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  displayNameDark: {
    color: '#fff',
  },
  handle: {
    color: '#666',
    fontSize: 14,
  },
  handleDark: {
    color: '#999',
  },
  postText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 10,
  },
  postTextDark: {
    color: '#fff',
  },
  link: {
    color: '#0085ff',
  },
  imageScroll: {
    marginBottom: 10,
  },
  embeddedImage: {
    width: width * 0.7,
    height: 200,
    borderRadius: 8,
    marginRight: 10,
  },
  embeddedVideo: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    marginBottom: 10,
  },
  linkCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
  },
  linkThumb: {
    width: '100%',
    height: 150,
  },
  linkInfo: {
    padding: 10,
  },
  linkTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  linkDesc: {
    fontSize: 12,
    color: '#666',
  },
  timestamp: {
    color: '#999',
    fontSize: 12,
    textAlign: 'right',
  },
  timestampDark: {
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  loadingTextDark: {
    color: '#999',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginVertical: 10,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: '#999',
    fontSize: 16,
  },
  emptyTextDark: {
    color: '#666',
  },
  footerLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: width,
    height: height,
  },
});
