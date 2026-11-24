
export const MAX_MESSAGE_LENGTH = 5000;

export const SUGGESTED_PROMPTS = [
  "Explain a difficult concept from my course in simple words.",
  "Give me a beginner roadmap for my target career.",
  "How do I structure a strong answer to a long exam question?",
  "Help me make a 4-week study plan for my exams.",
  "How should I prepare for my first job interview in 3 months?",
  "Help me write a strong resume summary for a fresher.",
];

const DEFAULT_TITLE = "New conversation";

/**
 * Same rule the backend uses when it names a conversation after the first
 * message, so the sidebar title is right without another request.
 */
export function buildTitleFromContent(content) {
  const cleaned = String(content || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return DEFAULT_TITLE;

  return cleaned.length <= 50 ? cleaned : `${cleaned.slice(0, 50)}...`;
}

export function isDefaultTitle(title) {
  return !title || title === DEFAULT_TITLE;
}

export function formatMessageTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function startOfDay(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();
}

/**
 * Groups conversations (already newest first) into Today, Yesterday,
 * Previous 7 days and Older. Empty groups are left out.
 */
export function groupConversations(conversations, now = new Date()) {
  const today = startOfDay(now);
  const dayMs = 24 * 60 * 60 * 1000;

  const groups = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const conversation of conversations) {
    const date = new Date(conversation.updatedAt);
    const time = Number.isNaN(date.getTime()) ? 0 : startOfDay(date);

    if (time >= today) groups[0].items.push(conversation);
    else if (time >= today - dayMs) groups[1].items.push(conversation);
    else if (time >= today - 7 * dayMs) groups[2].items.push(conversation);
    else groups[3].items.push(conversation);
  }

  return groups.filter((group) => group.items.length > 0);
}
