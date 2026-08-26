export type Locale = 'zh-CN' | 'en';

export const localeFromLanguages = (languages: readonly string[] | undefined): Locale => {
  const preferred = languages?.[0]?.toLowerCase() ?? '';
  return preferred.startsWith('zh') ? 'zh-CN' : 'en';
};

export function detectLocale(): Locale {
  return localeFromLanguages(typeof navigator === 'undefined' ? undefined : navigator.languages);
}

const messages = {
  'zh-CN': {
    settings: '设置',
    save: '保存',
    newTab: '新建临时标签',
    editor: '编辑器'
  },
  en: {
    settings: 'Settings',
    save: 'Save',
    newTab: 'New temporary tab',
    editor: 'Editor'
  }
} as const;

export type MessageKey = keyof typeof messages['zh-CN'];

export function createTranslator(locale: Locale = detectLocale()) {
  return (key: MessageKey): string => messages[locale][key];
}
