import axios, { AxiosError } from "axios";

interface RedditComment {
  data: {
    id: string;
    author: string;
    body: string;
    replies?: {
      kind: string;
      data: {
        children: RedditComment[];
      };
    };
  };
  kind: string;
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

interface GetRedditDataResponse {
  data: {
    children: [
      {
        comments: RedditComment[];
        data: RedditPost;
      },
    ];
  };
}

export interface PostResultItem {
  text: string;
  url: string;
  id: string;
}

const MAX_TOP_COMMENTS = 7;
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

function flattenComments(commentNode: RedditComment): RedditComment[] {
  if (!commentNode || commentNode.kind === "more") return [];

  const data = commentNode.data;
  if (!data) return [];

  const comment: RedditComment = {
    data: {
      id: data.id,
      author: data.author,
      body: data.body || "",
      replies: { data: { children: [] }, kind: commentNode.kind },
    },
    kind: commentNode.kind,
  };

  const result: RedditComment[] = [comment];

  if (data.replies?.data?.children) {
    for (const child of data.replies.data.children) {
      const childComments = flattenComments(child);
      result.push(...childComments);
    }
  }

  return result;
}

function collectTopComments(comments: RedditComment[]): RedditComment[] {
  const topLevel = comments.filter((c) => c.kind !== "more");

  const allComments: RedditComment[] = [];
  for (const child of topLevel) {
    const flattened = flattenComments(child);
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
    if (comment.data.author === opName) {
      userMap.set(comment.data.id, "OP");
    } else if (!userMap.has(comment.data.id)) {
      // Use a stable mapping based on first encounter
      // But we need per-comment author mapping, not per-id
    }
  }

  // Build author -> anonymized name mapping
  const authorMap = new Map<string, string>();
  const seenAuthors = new Set<string>();

  for (const comment of comments) {
    if (comment.data.author === opName) {
      authorMap.set(comment.data.author, "OP");
    } else if (!seenAuthors.has(comment.data.author)) {
      seenAuthors.add(comment.data.author);
      authorMap.set(comment.data.author, `User ${userCounter}`);
      userCounter++;
    }
  }

  // Format comments in order
  for (const comment of comments) {
    const speaker =
      authorMap.get(comment.data.author) || `User ${userCounter++}`;
    const cleanBody = comment.data.body.replace(/\s+/g, " ").trim();
    text += ` ${speaker}: ${cleanBody}`;
  }

  return text;
}

export async function fetchTopPosts(
  subredditName: string,
): Promise<PostResultItem[] | AxiosError> {
  const results: PostResultItem[] = [];

  try {
    const baseUrl = "https://functions.yandexcloud.net/d4e4d9s8rbi7flr2iei5";
    const url =
      baseUrl +
      `?subreddit=${subredditName}&limit=${MAX_POSTS}&maxComments=${MAX_TOP_COMMENTS}&depth=${MAX_REPLY_DEPTH}`;

    const res = await axios.get(url);
    const postsData: GetRedditDataResponse = res.data;

    const posts = postsData?.data?.children || [];

    if (!posts.length) {
      console.warn(`No posts found in r/${subredditName}`);
      return [];
    }

    for (const post of posts) {
      try {
        const imageUrl = extractImageUrl(post.data);

        const comments = collectTopComments(post.comments).filter(
          (c) => c.data.author !== "AutoModerator",
        );

        const formattedText = formatMRedditSum(post.data, comments);

        results.push({
          text: formattedText,
          url: imageUrl,
          id: post.data.id,
        });
      } catch (postErr) {
        const err = postErr as AxiosError;
        console.error(
          `Failed to fetch comments for post ${post.data.id}:`,
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

    return error;
  }

  return results;
}
