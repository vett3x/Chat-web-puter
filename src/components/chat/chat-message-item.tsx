"use client";

import React from 'react';
import { Bot, User, Loader2, Clipboard, RefreshCw, Upload, Check } from 'lucide-react';
import { MessageContent } from '@/components/message-content';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getModelLabel } from '@/lib/ai-models';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Message } from '@/hooks/use-general-chat';
import { ApiKey } from '@/hooks/use-user-api-keys';
import { RenderablePart } from '@/lib/utils';

interface ChatMessageItemProps {
  message: Message;
  isLastMessage: boolean;
  userAvatarUrl: string | null;
  aiResponseSpeed: 'slow' | 'normal' | 'fast';
  onRegenerate: () => void;
  onReapplyFiles: (message: Message) => void;
  onApprovePlan: (messageId: string) => void;
  isAppChat?: boolean;
  isLoading: boolean;
  userApiKeys: ApiKey[];
}

const ChatMessageItemComponent: React.FC<ChatMessageItemProps> = ({
  message,
  isLastMessage,
  userAvatarUrl,
  aiResponseSpeed,
  onRegenerate,
  onReapplyFiles,
  onApprovePlan,
  isAppChat,
  isLoading,
  userApiKeys,
}) => {
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopy = (content: Message['content']) => {
    let textToCopy = '';
    if (typeof content === 'string') {
      textToCopy = content;
    } else if (Array.isArray(content)) {
      textToCopy = content.map(part => {
        if (part.type === 'text') return part.text;
        if (part.type === 'code' && part.code) return part.code;
        return '';
      }).join('\n\n');
    }
    navigator.clipboard.writeText(textToCopy);
    toast.success('Copiado al portapapeles.');
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleRequestChanges = () => {
    toast.info("Plan rechazado. Por favor, escribe tus cambios en el chat para que la IA genere un nuevo plan.");
  };

  const hasFiles = Array.isArray(message.content) && message.content.some((part: RenderablePart) => part.type === 'code' && part.filename);

  return (
    <div className={`flex flex-col gap-1 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
      <div className={`group relative flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className="flex-shrink-0">
          {message.role === 'user' ? (
            <Avatar className="w-8 h-8 shadow-avatar-user">
              {userAvatarUrl && userAvatarUrl !== '' ? (
                <AvatarImage src={userAvatarUrl} alt="User Avatar" />
              ) : (
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              )}
            </Avatar>
          ) : (
            <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center shadow-avatar-ai">
              <Bot className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className={`rounded-lg p-3 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
          {message.isTyping ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Pensando...</span>
            </div>
          ) : (
            <MessageContent
              content={message.content}
              isNew={isLastMessage && !message.isAnimated}
              aiResponseSpeed={aiResponseSpeed}
              isAppChat={isAppChat}
              isConstructionPlan={message.isConstructionPlan}
              planApproved={message.planApproved}
              onApprovePlan={onApprovePlan}
              onRequestChanges={handleRequestChanges}
              messageId={message.id}
              onAnimationComplete={() => {}}
              isErrorAnalysisRequest={message.isErrorAnalysisRequest}
              isCorrectionPlan={message.isCorrectionPlan}
              correctionApproved={message.correctionApproved}
              isLoading={isLoading}
            />
          )}
        </div>
        {message.role === 'assistant' && !message.isTyping && !message.isConstructionPlan && (
          <div className="absolute top-1/2 -translate-y-1/2 left-full ml-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(message.content)} title="Copiar">
              {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Clipboard className="h-3.5 w-3.5" />}
            </Button>
            {hasFiles && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onReapplyFiles(message)} disabled={isLoading} title="Reaplicar archivos">
                <Upload className="h-3.5 w-3.5" />
              </Button>
            )}
            {isLastMessage && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRegenerate} disabled={isLoading} title="Regenerar">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
      {message.role === 'assistant' && !message.isTyping && message.model && (
        <p className="text-xs text-muted-foreground px-12">
          ✓ Generado con {getModelLabel(message.model, userApiKeys)}
        </p>
      )}
    </div>
  );
};

export const ChatMessageItem = React.memo(ChatMessageItemComponent);