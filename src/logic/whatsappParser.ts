export interface ParsedWhatsAppCommand {
  isWhatsAppIntent: boolean;
  contactName: string;
  messageText: string;
  rawInput: string;
}

export function parseWhatsAppCommand(transcript: string): ParsedWhatsAppCommand {
  if (!transcript) {
    return {
      isWhatsAppIntent: false,
      contactName: '',
      messageText: '',
      rawInput: '',
    };
  }

  const text = transcript.trim();
  const lower = text.toLowerCase();

  // Check intent keywords
  const isIntent =
    lower.includes('whatsapp') ||
    lower.includes('message') ||
    lower.includes('msg') ||
    lower.includes('bhejo') ||
    lower.includes('send');

  if (!isIntent) {
    return {
      isWhatsAppIntent: false,
      contactName: '',
      messageText: '',
      rawInput: text,
    };
  }

  // Regex patterns commonly used in Pakistani Urdu / Roman Urdu:
  // 1. "[ZARA,] {name} ko [whatsapp/message] karo ke {message}"
  // 2. "[ZARA,] {name} ko bolo {message}"
  // 3. "Send message to {name}: {message}"
  const patterns = [
    /(?:zara,?\s*)?(?:ko\s+)?([a-zA-Z0-9_\-\s]{2,20}?)\s+ko\s+(?:whatsapp\s+(?:karo|bhejo)|message\s+(?:karo|bhejo)|bolo)\s+(?:ke\s+|that\s+)?(.+)/i,
    /(?:zara,?\s*)?(?:send\s+(?:a\s+)?whatsapp\s+(?:message\s+)?to\s+)([a-zA-Z0-9_\-\s]{2,20}?)\s+(?:saying|that|:)?\s*(.+)/i,
    /(?:zara,?\s*)?([a-zA-Z0-9_\-\s]{2,20}?)\s+ko\s+(?:yeh\s+)?(?:msg|message)\s+(?:bhej do|bhejo)\s*[:,\s]\s*(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[2]) {
      const contactName = match[1].replace(/^(zara\s+)/i, '').trim();
      const messageText = match[2].trim();
      if (contactName && messageText) {
        return {
          isWhatsAppIntent: true,
          contactName: capitalizeFirst(contactName),
          messageText,
          rawInput: text,
        };
      }
    }
  }

  // Fallback heuristic: find word before 'ko'
  const koMatch = text.match(/(?:zara,?\s*)?([A-Za-z0-9_-]+)\s+ko\s+(.+)/i);
  if (koMatch && koMatch[1] && koMatch[2]) {
    let rawMsg = koMatch[2].replace(/^(?:whatsapp\s+karo|message\s+bhejo|bolo)\s*(?:ke\s+)?/i, '').trim();
    return {
      isWhatsAppIntent: true,
      contactName: capitalizeFirst(koMatch[1]),
      messageText: rawMsg || 'Assalam-o-Alaikum',
      rawInput: text,
    };
  }

  return {
    isWhatsAppIntent: true,
    contactName: 'Hamza',
    messageText: text,
    rawInput: text,
  };
}

function capitalizeFirst(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
