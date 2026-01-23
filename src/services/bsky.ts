import { BskyAgent } from '@atproto/api';

const agent = new BskyAgent({ service: 'https://public.api.bsky.app' });

export interface Post {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  record: {
    text: string;
    createdAt: string;
    facets?: any[];
  };
  embed?: {
    $type: string;
    images?: Array<{
      thumb: string;
      fullsize: string;
      alt: string;
    }>;
    external?: {
      uri: string;
      title: string;
      description: string;
      thumb?: string;
    };
    video?: {
      cid: string;
      playlist: string;
      thumbnail?: string;
    };
  };
  indexedAt: string;
  repostedBy?: {
    did: string;
    handle: string;
    displayName?: string;
  };
}

export interface ActorSuggestion {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
}

export const searchActors = async (query: string, limit = 5): Promise<ActorSuggestion[]> => {
  if (!query || query.trim().length === 0) return [];
  
  try {
    const res = await agent.searchActors({ q: query, limit });
    return res.data.actors.map(actor => ({
      did: actor.did,
      handle: actor.handle,
      displayName: actor.displayName,
      avatar: actor.avatar,
      description: actor.description,
    }));
  } catch (e) {
    console.error('Error searching actors:', e);
    return [];
  }
};

export const resolveHandle = async (handle: string) => {
  if (handle.startsWith('did:')) return handle;
  const res = await agent.resolveHandle({ handle });
  return res.data.did;
};

export const getFollows = async (actor: string) => {
  const res = await agent.app.bsky.graph.getFollows({ actor, limit: 50 });
  return res.data.follows;
};

export const getAuthorFeed = async (actor: string, limit = 10) => {
  const res = await agent.app.bsky.feed.getAuthorFeed({ actor, limit });
  return res.data.feed;
};

export const getMergedTimeline = async (handle: string, cursorMap?: Map<string, string>) => {
  const did = await resolveHandle(handle);
  // Get follows (limit to 50 for better coverage)
  const res = await agent.app.bsky.graph.getFollows({ actor: did, limit: 50 });
  const follows = res.data.follows.filter(profile =>
	profile.labels == null || !profile.labels.some(label => label.val === "!no-unauthenticated")
  );
  
  const newCursorMap = new Map<string, string>();
  const batchSize = 5;
  let allPosts: Post[] = [];
  
  for (let i = 0; i < follows.length; i += batchSize) {
    const batch = follows.slice(i, i + batchSize);
    const feedPromises = batch.map(f => 
      agent.app.bsky.feed.getAuthorFeed({ 
        actor: f.did, 
        limit: 10,
        cursor: cursorMap?.get(f.did)
      })
        .then(res => {
          if (res.data.cursor) newCursorMap.set(f.did, res.data.cursor);
          return res.data.feed;
        })
        .catch(e => {
          console.error(`Error fetching feed for ${f.handle}:`, e);
          return [];
        })
    );
    
    const batchFeeds = await Promise.all(feedPromises);
    const batchPosts: Post[] = batchFeeds.flat()
      .filter(f => {
        // Exclude the target user's own posts
        if (f.post.author.did === did) return false;
        
        // Exclude replies (only show original posts and reposts)
        if (f.reply) return false;
        
        return true;
      })
      .map(f => ({
        uri: f.post.uri,
        cid: f.post.cid,
        author: {
          did: f.post.author.did,
          handle: f.post.author.handle,
          displayName: f.post.author.displayName,
          avatar: f.post.author.avatar,
        },
        record: f.post.record as { text: string; createdAt: string; facets?: any[] },
        embed: f.post.embed as any,
        indexedAt: f.post.indexedAt,
        repostedBy: f.reason?.$type === 'app.bsky.feed.defs#skeletonReasonRepost' ? {
          did: (f.reason as any).by.did,
          handle: (f.reason as any).by.handle,
          displayName: (f.reason as any).by.displayName,
        } : undefined,
      }));
    
    allPosts = [...allPosts, ...batchPosts];
  }
  
  // Sort by indexedAt descending
  const sortedPosts = allPosts.sort((a, b) => 
    new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
  );

  return {
    posts: sortedPosts,
    cursorMap: newCursorMap
  };
};

export const getUserTimeline = async (actor: string) => {
  const feed = await getAuthorFeed(actor, 20);
  return feed.map(f => ({
    uri: f.post.uri,
    cid: f.post.cid,
    author: {
      did: f.post.author.did,
      handle: f.post.author.handle,
      displayName: f.post.author.displayName,
      avatar: f.post.author.avatar,
    },
    record: f.post.record as { text: string; createdAt: string; facets?: any[] },
    embed: f.post.embed as any,
    indexedAt: f.post.indexedAt,
    repostedBy: f.reason?.$type === 'app.bsky.feed.defs#skeletonReasonRepost' ? {
      did: (f.reason as any).by.did,
      handle: (f.reason as any).by.handle,
      displayName: (f.reason as any).by.displayName,
    } : undefined,
  }));
};
