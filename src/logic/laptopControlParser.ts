import { LaptopAction, LaptopActionType } from '../types/laptopControl.types.ts';

export interface ParseResult {
  isLaptopAction: boolean;
  action?: LaptopAction;
  userConfirmationIntent?: 'confirm' | 'cancel' | null;
}

export function parseLaptopAction(rawText: string): ParseResult {
  if (!rawText || !rawText.trim()) {
    return { isLaptopAction: false };
  }

  const clean = rawText
    .replace(/[,!?;:"'(){}\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const cleanLower = clean.toLowerCase();

  // First, check if this is an explicit confirmation or cancellation of a pending action
  const confirmWords = [
    'haan', 'han', 'yes', 'kar do', 'kardo', 'khol do', 'bhej do',
    'theek hai', 'bilkul', 'confirm', 'pakka', 'chalega', 'sahi hai',
    'delete karo', 'delete kar do', 'proceed', 'go ahead', 'haan yaar'
  ];
  const cancelWords = [
    'nahi', 'na', 'no', 'ruko', 'ruk jao', 'mat karo', 'cancel',
    'rehne do', 'chhor do', 'abort', 'don\'t', 'stop'
  ];

  if (cancelWords.some((w) => cleanLower === w || cleanLower.startsWith(w + ' ') || cleanLower.endsWith(' ' + w))) {
    return { isLaptopAction: false, userConfirmationIntent: 'cancel' };
  }

  if (confirmWords.some((w) => cleanLower === w || cleanLower.startsWith(w + ' ') || cleanLower.endsWith(' ' + w))) {
    return { isLaptopAction: false, userConfirmationIntent: 'confirm' };
  }

  // 1. FILE SYSTEM ACCESS
  // a) Folders (Downloads, Documents, Desktop, Pictures, Music, Videos)
  const folderMatch = clean.match(
    /(?:zara\s+)?(downloads|documents|desktop|pictures|music|videos)\s+(?:folder\s+)?(?:kholo|open\s+karo|open|khol\s+do)/i
  ) || clean.match(/(?:kholo|open)\s+(downloads|documents|desktop|pictures|music|videos)(?:\s+folder)?/i);

  if (folderMatch) {
    const folderName = folderMatch[1].charAt(0).toUpperCase() + folderMatch[1].slice(1).toLowerCase();
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'folder_open',
        title: `${folderName} Folder`,
        target: folderName,
        payload: { folderName },
        descriptionRomanUrdu: `${folderName} folder kholna`,
        requiresDoubleConfirm: false,
        confirmPrompt: `Boss, kya main ${folderName} folder khol doon?`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  // b) File search: "resume.pdf dhundo" / "search resume.pdf" / "find project.zip"
  const searchFileMatch = clean.match(
    /(?:zara\s+)?(?:file\s+)?([a-z0-9_\-\.]+\.(?:pdf|docx|txt|xlsx|pptx|png|jpg|jpeg|zip|mp4|json|ts|js))\s+(?:dhundo|dhoondo|search\s+karo|search|find)/i
  ) || clean.match(
    /(?:dhundo|dhoondo|search|find)\s+(?:file\s+)?([a-z0-9_\-\.]+\.(?:pdf|docx|txt|xlsx|pptx|png|jpg|jpeg|zip|mp4|json|ts|js))/i
  ) || clean.match(
    /(?:zara\s+)?([a-z0-9_\-\.]+\.(?:pdf|docx|txt|xlsx|pptx|png|jpg|jpeg|zip|mp4|json|ts|js))\s+dhundo/i
  );

  if (searchFileMatch) {
    const fileName = searchFileMatch[1];
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'file_search',
        title: `Search ${fileName}`,
        target: fileName,
        payload: { fileName },
        descriptionRomanUrdu: `"${fileName}" file dhoondna`,
        requiresDoubleConfirm: false,
        confirmPrompt: `Boss, kya laptop mein "${fileName}" search karun?`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  // c) File delete: "resume.pdf delete karo" / "file delete karo test.txt" -> SENSITIVE! Double Confirm
  const deleteFileMatch = clean.match(
    /(?:zara\s+)?(?:file\s+)?([a-z0-9_\-\.]+\.[a-z0-9]{2,4})\s+(?:delete\s+karo|delete\s+kar\s+do|mita\s+do|remove\s+karo)/i
  ) || clean.match(
    /(?:file\s+)?(?:delete\s+karo|delete\s+kar\s+do|delete|mita\s+do|remove)\s+(?:file\s+)?([a-z0-9_\-\.]+\.[a-z0-9]{2,4})/i
  );

  if (deleteFileMatch) {
    const fileName = deleteFileMatch[1];
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'file_delete',
        title: `Delete ${fileName}`,
        target: fileName,
        payload: { fileName },
        descriptionRomanUrdu: `"${fileName}" file delete karna`,
        requiresDoubleConfirm: true,
        confirmPrompt: `Boss, kya aap sach mein "${fileName}" delete karna chahte hain? Yeh file hamesha ke liye chali jayegi!`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  // d) File rename: "file rename karo test.txt ko final.txt"
  const renameMatch = clean.match(
    /(?:rename|naam\s+badlo)\s+(?:file\s+)?([a-z0-9_\-\.]+\.[a-z0-9]{2,4})\s+(?:ko|to|as)\s+([a-z0-9_\-\.]+\.[a-z0-9]{2,4})/i
  );
  if (renameMatch) {
    const oldName = renameMatch[1];
    const newName = renameMatch[2];
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'file_rename',
        title: `Rename ${oldName} to ${newName}`,
        target: oldName,
        payload: { oldName, newName },
        descriptionRomanUrdu: `"${oldName}" ko "${newName}" mein rename karna`,
        requiresDoubleConfirm: false,
        confirmPrompt: `Boss, kya main "${oldName}" ka naam badal kar "${newName}" kar doon?`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  // e) File open: "resume.pdf kholo"
  const openFileMatch = clean.match(
    /(?:zara\s+)?(?:file\s+)?([a-z0-9_\-\.]+\.(?:pdf|docx|txt|xlsx|pptx|png|jpg|jpeg|zip|mp4|json|ts|js))\s+(?:kholo|open\s+karo|open|khol\s+do)/i
  ) || clean.match(
    /(?:kholo|open)\s+(?:file\s+)?([a-z0-9_\-\.]+\.(?:pdf|docx|txt|xlsx|pptx|png|jpg|jpeg|zip|mp4|json|ts|js))/i
  );

  if (openFileMatch) {
    const fileName = openFileMatch[1];
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'file_open',
        title: `Open ${fileName}`,
        target: fileName,
        payload: { fileName },
        descriptionRomanUrdu: `"${fileName}" kholna`,
        requiresDoubleConfirm: false,
        confirmPrompt: `Boss, kya main "${fileName}" file khol doon?`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  // 2. BROWSER CONTROL
  // a) YouTube search: "YouTube par lofi music search karo" / "youtube search pakistani drama"
  const youtubeMatch = clean.match(
    /(?:zara\s+)?youtube\s+par\s+(.+?)\s+(?:search\s+karo|search|chalao|play\s+karo|dhoondo)/i
  ) || clean.match(/(?:search|play)\s+(.+?)\s+on\s+youtube/i) || clean.match(/youtube\s+search\s+(.+)/i);

  if (youtubeMatch) {
    const query = youtubeMatch[1].trim();
    const encoded = encodeURIComponent(query);
    const url = `https://www.youtube.com/results?search_query=${encoded}`;
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'browser_search',
        title: `YouTube Search: ${query}`,
        target: url,
        payload: { query, engine: 'youtube', url },
        descriptionRomanUrdu: `YouTube par "${query}" search karna`,
        requiresDoubleConfirm: false,
        confirmPrompt: `Boss, kya YouTube par "${query}" search kar ke open karoon?`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  // b) Google search: "Google par Pakistan cricket score search karo" / "Google search Karachi weather"
  const googleMatch = clean.match(
    /(?:zara\s+)?google\s+par\s+(.+?)\s+(?:search\s+karo|search|dhoondo)/i
  ) || clean.match(/(?:google\s+search|search\s+google\s+for)\s+(.+)/i);

  if (googleMatch) {
    const query = googleMatch[1].trim();
    const encoded = encodeURIComponent(query);
    const url = `https://www.google.com/search?q=${encoded}`;
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'browser_search',
        title: `Google Search: ${query}`,
        target: url,
        payload: { query, engine: 'google', url },
        descriptionRomanUrdu: `Google par "${query}" dhoondna`,
        requiresDoubleConfirm: false,
        confirmPrompt: `Boss, kya Google par "${query}" search kar ke khol doon?`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  // c) Direct URL open: "github.com kholo" / "open google.com" / bare URL like "https://nodejs.org/..."
  const rawUrlPattern = /^(https?:\/\/[^\s]+)$/i;
  const bareUrlMatch = rawText.trim().match(rawUrlPattern);

  const urlMatch = bareUrlMatch || clean.match(
    /(?:open|kholo|chalao)\s+([a-z0-9\-]+\.(?:com|org|net|pk|io|dev|ai|edu)(?:\/[^\s]*)?)/i
  ) || clean.match(
    /([a-z0-9\-]+\.(?:com|org|net|pk|io|dev|ai|edu)(?:\/[^\s]*)?)\s+(?:kholo|open\s+karo|open|khol\s+do)/i
  );

  if (urlMatch) {
    const rawUrl = urlMatch[1];
    const fullUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'browser_open_url',
        title: `Open ${rawUrl}`,
        target: fullUrl,
        payload: { url: fullUrl, rawUrl },
        descriptionRomanUrdu: `Browser mein "${rawUrl}" kholna`,
        requiresDoubleConfirm: false,
        confirmPrompt: `Boss, kya default browser mein "${rawUrl}" open karoon?`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  // d) Tab operations: "tab close karo" / "tab band karo" / "naya tab kholo"
  if (clean.includes('tab close') || clean.includes('tab band') || clean.includes('close tab')) {
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'browser_tab_close',
        title: 'Close Browser Tab',
        target: 'current_tab',
        payload: { shortcut: 'Ctrl+W' },
        descriptionRomanUrdu: 'Browser tab close karna',
        requiresDoubleConfirm: false,
        confirmPrompt: 'Boss, kya current browser tab close kar doon?',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  if (clean.includes('naya tab') || clean.includes('new tab') || clean.includes('tab kholo')) {
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'browser_tab_open',
        title: 'Open New Tab',
        target: 'new_tab',
        payload: { shortcut: 'Ctrl+T' },
        descriptionRomanUrdu: 'Browser mein naya tab kholna',
        requiresDoubleConfirm: false,
        confirmPrompt: 'Boss, kya browser mein naya tab khol doon?',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  if (clean.includes('bookmark') || clean.includes('bookmarks kholo')) {
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'browser_bookmark',
        title: 'Open Bookmarks',
        target: 'bookmarks',
        payload: { shortcut: 'Ctrl+Shift+O' },
        descriptionRomanUrdu: 'Browser bookmarks kholna',
        requiresDoubleConfirm: false,
        confirmPrompt: 'Boss, kya bookmarks manager khol doon?',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  // 3. SYSTEM APPS
  // a) App close: "Notepad band karo" / "Calculator close karo" -> SENSITIVE!
  const appCloseMatch = clean.match(
    /(?:zara\s+)?(notepad|calculator|calc|chrome|vscode|vs\s+code|code|terminal|task\s+manager)\s+(?:band\s+karo|close\s+karo|close|band\s+kar\s+do)/i
  ) || clean.match(
    /(?:close|band\s+karo)\s+(notepad|calculator|calc|chrome|vscode|vs\s+code|code|terminal|task\s+manager)/i
  );

  if (appCloseMatch) {
    const rawAppName = appCloseMatch[1].trim();
    const appName = formatAppName(rawAppName);
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'app_close',
        title: `Close ${appName}`,
        target: appName,
        payload: { appName },
        descriptionRomanUrdu: `${appName} band karna`,
        requiresDoubleConfirm: true,
        confirmPrompt: `Boss, kya aap sach mein ${appName} ko band karna chahte hain? Unsaved data zaya ho sakta hai!`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  // b) App open: "Notepad kholo", "Calculator kholo", "Chrome kholo"
  const appOpenMatch = clean.match(
    /(?:zara\s+)?(notepad|calculator|calc|chrome|vscode|vs\s+code|code|terminal|task\s+manager)\s+(?:kholo|open\s+karo|open|chalao|khol\s+do)/i
  ) || clean.match(
    /(?:open|kholo|chalao)\s+(notepad|calculator|calc|chrome|vscode|vs\s+code|code|terminal|task\s+manager)/i
  );

  if (appOpenMatch) {
    const rawAppName = appOpenMatch[1].trim();
    const appName = formatAppName(rawAppName);
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'app_launch',
        title: `Launch ${appName}`,
        target: appName,
        payload: { appName },
        descriptionRomanUrdu: `${appName} kholna`,
        requiresDoubleConfirm: false,
        confirmPrompt: `Boss, kya main ${appName} open kar doon?`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  // c) Volume control: "volume kam karo", "awaz barhao", "mute karo", "volume 50 percent karo"
  if (
    clean.includes('volume kam') ||
    clean.includes('awaz kam') ||
    clean.includes('volume down') ||
    clean.includes('awaz slow')
  ) {
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'volume_change',
        title: 'Volume Down (-15%)',
        target: 'system_volume',
        payload: { delta: -15 },
        descriptionRomanUrdu: 'System volume 15% kam karna',
        requiresDoubleConfirm: false,
        confirmPrompt: 'Boss, kya system ki aawaz thodi kam kar doon?',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  if (
    clean.includes('volume zyada') ||
    clean.includes('volume barhao') ||
    clean.includes('awaz barhao') ||
    clean.includes('volume up') ||
    clean.includes('awaz tez')
  ) {
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'volume_change',
        title: 'Volume Up (+15%)',
        target: 'system_volume',
        payload: { delta: 15 },
        descriptionRomanUrdu: 'System volume 15% barhana',
        requiresDoubleConfirm: false,
        confirmPrompt: 'Boss, kya system ki aawaz barha doon?',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  if (clean.includes('mute karo') || clean.includes('volume mute') || clean.includes('mute kar do')) {
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'volume_set',
        title: 'Mute System Audio',
        target: 'system_volume',
        payload: { volume: 0 },
        descriptionRomanUrdu: 'System aawaz mute karna',
        requiresDoubleConfirm: false,
        confirmPrompt: 'Boss, kya laptop ka audio mute kar doon?',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  // d) Screenshot: "screenshot lo" / "screen capture karo" / "screenshot lena"
  if (clean.includes('screenshot') || clean.includes('screen capture') || clean.includes('screen shot')) {
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'screenshot_take',
        title: 'Take Screenshot',
        target: 'desktop_screen',
        payload: {},
        descriptionRomanUrdu: 'Laptop screen ka screenshot lena',
        requiresDoubleConfirm: false,
        confirmPrompt: 'Boss, kya abhi screen ka screenshot capture karoon?',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  // 4. WHATSAPP DESKTOP CONTROL
  // a) WhatsApp open: "WhatsApp kholo" / "WhatsApp desktop open karo"
  if (
    cleanLower === 'whatsapp kholo' ||
    cleanLower === 'whatsapp desktop kholo' ||
    cleanLower === 'open whatsapp' ||
    cleanLower === 'open whatsapp desktop' ||
    cleanLower.includes('whatsapp app kholo')
  ) {
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'whatsapp_launch',
        title: 'Open WhatsApp Desktop',
        target: 'whatsapp_app',
        payload: {},
        descriptionRomanUrdu: 'WhatsApp Desktop app kholna',
        requiresDoubleConfirm: false,
        confirmPrompt: 'Boss, kya WhatsApp Desktop open kar doon?',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  // b) Open contact chat: "Hamza ki whatsapp chat kholo"
  const waChatMatch = clean.match(
    /(?:zara\s+)?([a-z\s]+?)\s+ki\s+whatsapp\s+(?:chat\s+)?(?:kholo|open\s+karo)/i
  );
  if (waChatMatch) {
    const rawContact = waChatMatch[1].trim();
    const contact = rawContact.charAt(0).toUpperCase() + rawContact.slice(1);
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'whatsapp_chat_open',
        title: `Open WhatsApp Chat: ${contact}`,
        target: contact,
        payload: { contactName: contact },
        descriptionRomanUrdu: `WhatsApp par "${contact}" ki chat kholna`,
        requiresDoubleConfirm: false,
        confirmPrompt: `Boss, kya WhatsApp par "${contact}" ki chat khol doon?`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  // c) WhatsApp message draft & send: "whatsapp par hamza ko message bhejo kal milte hain" -> SENSITIVE! Double Confirm
  const waSendMatch = clean.match(
    /(?:whatsapp\s+par\s+)?([a-z\s]+?)\s+ko\s+message\s+bhejo\s+(?:ke\s+|colon\s+|:\s+)?(.+)/i
  );
  if (waSendMatch) {
    const rawContact = waSendMatch[1].trim();
    const contact = rawContact.charAt(0).toUpperCase() + rawContact.slice(1);
    const message = waSendMatch[2].trim();
    return {
      isLaptopAction: true,
      action: {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'whatsapp_draft_send',
        title: `Send WhatsApp to ${contact}`,
        target: contact,
        payload: { contactName: contact, messageText: message },
        descriptionRomanUrdu: `WhatsApp par "${contact}" ko message bhejna: "${message}"`,
        requiresDoubleConfirm: true,
        confirmPrompt: `Boss, kya pakka WhatsApp par ${contact} ko yeh message bhej doon: "${message}"? Double confirm karein.`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  return { isLaptopAction: false };
}

function formatAppName(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (lower === 'calc') return 'Calculator';
  if (lower === 'vscode' || lower === 'vs code' || lower === 'code') return 'VS Code';
  if (lower === 'chrome') return 'Google Chrome';
  if (lower === 'task manager') return 'Task Manager';
  if (lower === 'terminal') return 'Terminal';
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
