import en from "../../public/_locales/en/messages.json";

export type MessageKey = keyof typeof en;

type Message = {
  message: string;
  placeholders?: Record<string, { content: string }>;
};

let fallback: Record<string, Message> = {};

/** Dictionary used when `chrome.i18n` is unavailable (tests, `dev:mock`). */
export function setFallbackMessages(m: Record<string, Message>): void {
  fallback = m;
}

function fromFallback(key: string, subs: string[]): string {
  const entry = fallback[key];
  if (!entry) return key;
  const { message, placeholders = {} } = entry;
  return message.replace(/\$([A-Za-z0-9_@]+)\$/g, (whole, name: string) => {
    const content = placeholders[name.toLowerCase()]?.content;
    if (content === undefined) return whole;
    return content.replace(
      /\$(\d)/g,
      (_, n: string) => subs[Number(n) - 1] ?? "",
    );
  });
}

export function t(key: MessageKey, subs?: string | string[]): string {
  const list = subs === undefined ? [] : Array.isArray(subs) ? subs : [subs];
  if (typeof chrome !== "undefined" && chrome.i18n?.getMessage) {
    return chrome.i18n.getMessage(key, list) || key;
  }
  return fromFallback(key, list);
}
