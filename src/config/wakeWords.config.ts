export interface WakeWordConfig {
  phrase: string;
  language: string;
  phoneticDescription: string;
  autoGreetingResponse?: string;
  primary: boolean;
}

export const WAKE_WORDS_CONFIG: WakeWordConfig[] = [
  {
    phrase: 'Hello ZARA',
    language: 'en / ur',
    phoneticDescription: 'Standard English wake phrase',
    autoGreetingResponse: 'Arre Boss! Sun rahi hoon, bolo!',
    primary: true,
  },
  {
    phrase: 'Hey ZARA',
    language: 'en',
    phoneticDescription: 'Short casual trigger',
    autoGreetingResponse: 'Jee Boss, bolo kya chal raha hai?',
    primary: true,
  },
  {
    phrase: 'Assalam-o-Alaikum ZARA',
    language: 'ur',
    phoneticDescription: 'Traditional Pakistani Urdu greeting',
    autoGreetingResponse: 'Wa Alaikum Assalam, Boss! Sab khairiyat? Batao kya karna hai.',
    primary: true,
  },
  {
    phrase: 'Suno ZARA',
    language: 'ur (Roman)',
    phoneticDescription: 'Casual friendly Urdu call',
    autoGreetingResponse: 'Haan Boss, sun rahi hoon!',
    primary: false,
  },
];
