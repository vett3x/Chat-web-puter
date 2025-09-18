import React from 'react';
import ReactMarkdown, { Components, CodeProps } from 'react-markdown'; // Importar Components y CodeProps
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coldarkDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// Interfaces para el contenido multimodal (deben coincidir con ChatInterface)
interface PuterMessageContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

interface MessageContentProps {
  content: PuterMessageContentBlock[]; // Ahora es un array de bloques de contenido
  isNew?: boolean;
}

export function MessageContent({ content, isNew }: MessageContentProps) {
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", isNew && "animate-fade-in")}>
      {content.map((block, index) => (
        <React.Fragment key={index}>
          {block.type === 'text' && block.text && (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }: CodeProps) { // Tipado con CodeProps
                  const match = /language-(\w+)(:(\S+))?/.exec(className || '');
                  const language = match?.[1];
                  const filename = match?.[3];

                  if (inline) {
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  }

                  return (
                    <div className="relative my-2 rounded-md overflow-hidden">
                      {filename && (
                        <div className="absolute top-0 left-0 right-0 bg-gray-700 text-white text-xs px-3 py-1">
                          {filename}
                        </div>
                      )}
                      <SyntaxHighlighter
                        style={coldarkDark}
                        language={language || 'text'}
                        PreTag="div"
                        {...props}
                        className={cn("!my-0", filename && "!pt-8")} // Ajustar padding si hay filename
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    </div>
                  );
                },
                p: ({ node, ...props }: Components['p']) => <p className="mb-2 last:mb-0" {...props} />, // Tipado con Components['p']
                ul: ({ node, ...props }: Components['ul']) => <ul className="mb-2 last:mb-0" {...props} />, // Tipado con Components['ul']
                ol: ({ node, ...props }: Components['ol']) => <ol className="mb-2 last:mb-0" {...props} />, // Tipado con Components['ol']
                li: ({ node, ...props }: Components['li']) => <li className="mb-1 last:mb-0" {...props} />, // Tipado con Components['li']
                a: ({ node, ...props }: Components['a']) => <a target="_blank" rel="noopener noreferrer" {...props} />, // Tipado con Components['a']
              }}
            >
              {block.text}
            </ReactMarkdown>
          )}
          {block.type === 'image' && block.source && (
            <div className="my-2 rounded-lg overflow-hidden border border-border">
              <Image
                src={`data:${block.source.media_type};base64,${block.source.data}`}
                alt="Attached image"
                width={500} // Puedes ajustar el tamaño o hacerlo responsivo
                height={300} // Puedes ajustar el tamaño o hacerlo responsivo
                objectFit="contain"
                className="max-w-full h-auto"
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}