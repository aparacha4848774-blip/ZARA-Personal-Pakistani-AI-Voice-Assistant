import { durableStorage } from '../db/storage.ts';
import { WhatsAppMessage } from '../types/zara.types.ts';

export interface WhatsAppSendResult {
  success: boolean;
  messageId: string;
  deliveryStatus: 'sent' | 'draft_ready' | 'not_configured' | 'dispatched_desktop' | 'failed';
  provider?: 'whatsapp_cloud_api' | 'desktop_protocol' | 'local_store';
  notice: string;
  details?: any;
}

export function validatePhoneNumber(phone: string): { valid: boolean; formatted: string; reason?: string } {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, formatted: '', reason: 'Phone number string is required.' };
  }

  // Check for dangerous injection characters
  if (/[;<>&`$"'|\\^]/.test(phone)) {
    return { valid: false, formatted: phone, reason: 'Prohibited injection characters detected in phone number.' };
  }

  // Strip spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-()]/g, '');

  // Handle local Pakistani numbers: e.g. 03001234567 -> +923001234567
  if (/^03\d{9}$/.test(cleaned)) {
    cleaned = '+92' + cleaned.slice(1);
  } else if (/^923\d{9}$/.test(cleaned)) {
    cleaned = '+' + cleaned;
  }

  // ITU-T E.164 standard: optional leading +, followed by 10 to 15 digits
  const e164Regex = /^\+?[1-9]\d{9,14}$/;
  if (!e164Regex.test(cleaned)) {
    return {
      valid: false,
      formatted: cleaned,
      reason: 'Phone number must be a valid E.164 format (10-15 digits, e.g. +923001234567).',
    };
  }

  const finalFormatted = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  return { valid: true, formatted: finalFormatted };
}

export async function processWhatsAppDispatch(
  messageId: string,
  confirmed: boolean
): Promise<WhatsAppSendResult> {
  const messages = durableStorage.getWhatsAppMessages();
  const msg = messages.find((m) => m.id === messageId);

  if (!msg) {
    return {
      success: false,
      messageId,
      deliveryStatus: 'failed',
      notice: 'Message draft not found in records.',
    };
  }

  if (!confirmed) {
    durableStorage.updateWhatsAppMessage(messageId, {
      status: 'cancelled',
    });
    return {
      success: true,
      messageId,
      deliveryStatus: 'draft_ready',
      notice: 'Message draft was cancelled by user.',
    };
  }

  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // 1. If WhatsApp Cloud API credentials are provided in environment, send via official API
  if (token && phoneId && msg.contactIdentifier) {
    try {
      const recipient = msg.contactIdentifier.replace(/[^\d]/g, '');
      const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'text',
          text: { body: msg.messageText },
        }),
      });

      const data = await res.json();
      if (res.ok && data.messages?.[0]?.id) {
        durableStorage.updateWhatsAppMessage(messageId, {
          status: 'sent',
          userConfirmed: true,
          sentAt: new Date().toISOString(),
        });

        return {
          success: true,
          messageId,
          deliveryStatus: 'sent',
          provider: 'whatsapp_cloud_api',
          notice: `WhatsApp Cloud API: Message dispatched to ${msg.contactName} (${recipient}). Message ID: ${data.messages[0].id}`,
          details: data,
        };
      } else {
        const errMsg = data?.error?.message || 'Provider API rejected message';
        return {
          success: false,
          messageId,
          deliveryStatus: 'failed',
          provider: 'whatsapp_cloud_api',
          notice: `WhatsApp Cloud API error: ${errMsg}`,
          details: data,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        messageId,
        deliveryStatus: 'failed',
        provider: 'whatsapp_cloud_api',
        notice: `WhatsApp network error: ${err.message}`,
      };
    }
  }

  // 2. When Cloud API is not configured:
  // Do NOT falsely claim the message was "sent" or "delivered".
  // Record status truthfully as 'draft_ready' or 'simulated' and clearly state provider requirement.
  durableStorage.updateWhatsAppMessage(messageId, {
    status: 'simulated',
    userConfirmed: true,
    sentAt: new Date().toISOString(),
  });

  return {
    success: true,
    messageId,
    deliveryStatus: 'draft_ready',
    provider: 'local_store',
    notice: `Draft confirmed for ${msg.contactName}. (WhatsApp Cloud API credentials not configured in environment: WHATSAPP_API_TOKEN & WHATSAPP_PHONE_NUMBER_ID. Message is recorded locally and ready for desktop dispatch).`,
  };
}
