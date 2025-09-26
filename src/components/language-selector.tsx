"use client";

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUserLanguage } from '@/hooks/use-user-language';
import { Loader2 } from 'lucide-react';

const SUPPORTED_LANGUAGES = [
  { code: 'ar', name: 'العربية', nativeName: 'Arabic' },
  { code: 'zh', name: '中文', nativeName: 'Chinese (Simplified)' },
  { code: 'zh-tw', name: '繁體中文', nativeName: 'Chinese (Traditional)' },
  { code: 'hr', name: 'Hrvatski', nativeName: 'Croatian' },
  { code: 'nl', name: 'Nederlands', nativeName: 'Dutch' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'fr', name: 'Français', nativeName: 'French' },
  { code: 'de', name: 'Deutsch', nativeName: 'German' },
  { code: 'he', name: 'עברית', nativeName: 'Hebrew' },
  { code: 'is', name: 'Íslenska', nativeName: 'Icelandic' },
  { code: 'it', name: 'Italiano', nativeName: 'Italian' },
  { code: 'ja', name: '日本語', nativeName: 'Japanese' },
  { code: 'ko', name: '한국어', nativeName: 'Korean' },
  { code: 'no', name: 'Norsk', nativeName: 'Norwegian' },
  { code: 'pl', name: 'Polski', nativeName: 'Polish' },
  { code: 'pt', name: 'Português', nativeName: 'Portuguese' },
  { code: 'ru', name: 'Русский', nativeName: 'Russian' },
  { code: 'sk', name: 'Slovenčina', nativeName: 'Slovak' },
  { code: 'es', name: 'Español', nativeName: 'Spanish' },
  { code: 'uk', name: 'Українська', nativeName: 'Ukrainian' },
  { code: 'vi', name: 'Tiếng Việt', nativeName: 'Vietnamese' },
];

interface LanguageSelectorProps {
  className?: string;
}

export function LanguageSelector({ className }: LanguageSelectorProps) {
  const { language, updateLanguage, isLoading } = useUserLanguage();

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Cargando idioma...</span>
      </div>
    );
  }

  const currentLanguage = SUPPORTED_LANGUAGES.find(lang => lang.code === language);

  return (
    <div className={className}>
      <Select value={language} onValueChange={updateLanguage}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {currentLanguage ? (
              <span className="flex items-center gap-2">
                <span>{currentLanguage.name}</span>
                <span className="text-xs text-muted-foreground">({currentLanguage.nativeName})</span>
              </span>
            ) : (
              'Seleccionar idioma'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              <span className="flex items-center gap-2">
                <span>{lang.name}</span>
                <span className="text-xs text-muted-foreground">({lang.nativeName})</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}