import axios, { AxiosError } from "axios";

interface RedditComment {
  id: string;
  author: string;
  body: string;
  replies?: RedditComment[];
  depth: number;
}

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  url: string;
  permalink: string;
  author: string;
  num_comments: number;
  is_self: boolean;
  thumbnail?: string;
  preview?: {
    images?: Array<{
      source: { url: string; width: number; height: number };
      resolutions: Array<{ url: string; width: number; height: number }>;
    }>;
  };
}

export interface PostResultItem {
  text: string;
  url: string;
  id: string;
}

// const REDDIT_BASE = "https://www.reddit.com";
const REDDIT_BASE = "https://corsproxy.io/?https://www.reddit.com";

const USER_AGENT = "mRedditSum-scraper/1.0 (by /u/anonymous)";
const MAX_TOP_COMMENTS = 4;
const MAX_REPLY_DEPTH = 3;
const MAX_POSTS = 3;

function extractImageUrl(post: RedditPost): string {
  // If it's a direct image link
  if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(post.url)) {
    return post.url;
  }
  // Reddit-hosted image (i.redd.it)
  if (post.url.includes("i.redd.it") || post.url.includes("i.imgur.com")) {
    return post.url;
  }
  // Extract from preview images
  if (post.preview?.images?.[0]?.source?.url) {
    return post.preview.images[0].source.url.replace(/&amp;/g, "&");
  }
  // Fallback to thumbnail if it's not a default icon
  if (post.thumbnail && post.thumbnail.startsWith("http")) {
    return post.thumbnail;
  }
  return "";
}

function flattenComments(
  commentNode: any,
  currentDepth: number,
  maxDepth: number,
): RedditComment[] {
  if (!commentNode || commentNode.kind === "more") return [];

  const data = commentNode.data;
  if (!data) return [];

  const comment: RedditComment = {
    id: data.id,
    author: data.author,
    body: data.body || "",
    depth: currentDepth,
    replies: [],
  };

  const result: RedditComment[] = [comment];

  // Process replies if within depth limit
  if (currentDepth < maxDepth && data.replies?.data?.children) {
    for (const child of data.replies.data.children) {
      const childComments = flattenComments(child, currentDepth + 1, maxDepth);
      result.push(...childComments);
    }
  }

  return result;
}

function collectTopComments(
  listingChildren: any[],
  topN: number,
  maxDepth: number,
): RedditComment[] {
  const topLevel = listingChildren
    .filter((c) => c.kind !== "more")
    .slice(0, topN);

  const allComments: RedditComment[] = [];
  for (const child of topLevel) {
    const flattened = flattenComments(child, 0, maxDepth);
    allComments.push(...flattened);
  }
  return allComments;
}

function formatMRedditSum(post: RedditPost, comments: RedditComment[]): string {
  // Build post text content: title + selftext
  const postTextContent = [post.title, post.selftext]
    .filter(Boolean)
    .join(". ");

  let text = `Original Post: ${postTextContent}`;

  // Anonymize users: map original usernames to "User N" or "OP"
  const opName = post.author;
  const userMap = new Map<string, string>();
  let userCounter = 1;

  for (const comment of comments) {
    if (comment.author === opName) {
      userMap.set(comment.id, "OP");
    } else if (!userMap.has(comment.id)) {
      // Use a stable mapping based on first encounter
      // But we need per-comment author mapping, not per-id
    }
  }

  // Build author -> anonymized name mapping
  const authorMap = new Map<string, string>();
  const seenAuthors = new Set<string>();

  for (const comment of comments) {
    if (comment.author === opName) {
      authorMap.set(comment.author, "OP");
    } else if (!seenAuthors.has(comment.author)) {
      seenAuthors.add(comment.author);
      authorMap.set(comment.author, `User ${userCounter}`);
      userCounter++;
    }
  }

  // Format comments in order
  for (const comment of comments) {
    const speaker = authorMap.get(comment.author) || `User ${userCounter++}`;
    const cleanBody = comment.body.replace(/\s+/g, " ").trim();
    text += ` ${speaker}: ${cleanBody}`;
  }

  return text;
}

export async function fetchTopPosts(
  subredditName: string,
  k: number = MAX_POSTS,
): Promise<PostResultItem[]> {
  const results: PostResultItem[] = [];

  try {
    // "https://functions.yandexcloud.net/d4e4d9s8rbi7flr2iei5?subreddit=funny&limit=2&maxComments=3&depth=4"

    // 1. Fetch top posts
    const postsUrl = `${REDDIT_BASE}/r/${subredditName}/top.json?limit=${k}&t=day`;
    const postsRes = await axios.get(postsUrl, {
      // headers: { "User-Agent": USER_AGENT },
      timeout: 15000,
    });

    const posts: RedditPost[] =
      postsRes.data?.data?.children?.map((child: any) => child.data) || [];

    if (!posts.length) {
      console.warn(`No posts found in r/${subredditName}`);
      return [];
    }

    // 2. For each post, fetch comments
    for (const post of posts) {
      try {
        const imageUrl = extractImageUrl(post);

        // Fetch comment thread
        const commentsUrl = `${REDDIT_BASE}/r/${subredditName}/comments/${post.id}.json?limit=${MAX_TOP_COMMENTS}&depth=${MAX_REPLY_DEPTH}`;
        const commentsRes = await axios.get(commentsUrl, {
          headers: { "User-Agent": USER_AGENT },
          timeout: 15000,
        });

        // Reddit returns [postListing, commentListing]
        const commentListing = commentsRes.data?.[1];
        const commentChildren = commentListing?.data?.children || [];

        const comments = collectTopComments(
          commentChildren,
          MAX_TOP_COMMENTS,
          MAX_REPLY_DEPTH,
        );

        const formattedText = formatMRedditSum(post, comments);

        results.push({
          text: formattedText,
          url: imageUrl,
          id: post.id,
        });
      } catch (postErr) {
        const err = postErr as AxiosError;
        console.error(
          `Failed to fetch comments for post ${post.id}:`,
          err.message,
        );
      }
    }
  } catch (err) {
    const error = err as AxiosError;
    console.error(`Failed to fetch r/${subredditName}:`, error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }
  }

  return results;
}
