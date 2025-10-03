"use client";

import React, { useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import ListItem from '@tiptap/extension-list-item';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import CodeBlock from '@tiptap/extension-code-block';
import Blockquote from '@tiptap/extension-blockquote';
import HardBreak from '@tiptap/extension-hard-break';
import Heading from '@tiptap/extension-heading';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Strike from '@tiptap/extension-strike';
import Underline from '@tiptap/extension-underline';
import History from '@tiptap/extension-history';
import Placeholder from '@tiptap/extension-placeholder';

import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Strikethrough as StrikethroughIcon,
  Code as CodeIcon,
  Heading1,
  Heading2,
  Heading3,
  List as ListIcon,
  ListOrdered,
  Quote as QuoteIcon,
  Minus,
  Redo,
  Undo,
  Link as LinkIcon,
  Image as ImageIcon,
  CodeSquare,
  CheckSquare,
  Eraser,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TipTapEditorProps {
  initialContent: string;
  onChange: (html: string) => void;
  isEditable?: boolean;
  onImageUpload: (file: File) => Promise<string | null>;
}

const MenuBar = ({ editor, onImageUpload }: { editor: Editor | null; onImageUpload: (file: File) => Promise<string | null> }) => {
  if (!editor) {
    return null;
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addImage = useCallback(async (file: File) => {
    const url = await onImageUpload(file);
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    } else {
      toast.error('Error al subir la imagen.');
    }
  }, [editor, onImageUpload]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      addImage(file);
    }
    if (event.target) {
      event.target.value = ''; // Clear the input
    }
  }, [addImage]);

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-input bg-muted rounded-t-md">
      <Button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        title="Negrita"
      >
        <BoldIcon className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        title="Cursiva"
      >
        <ItalicIcon className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        variant={editor.isActive('strike') ? 'secondary' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        title="Tachado"
      >
        <StrikethroughIcon className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => editor.chain().focus().toggleCode().run()}
        disabled={!editor.can().chain().focus().toggleCode().run()}
        variant={editor.isActive('code') ? 'secondary' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        title="Código en línea"
      >
        <CodeIcon className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => editor.chain().focus().unsetAllMarks().run()}
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Limpiar formato"
      >
        <Eraser className="h-4 w-4" />
      </Button>
      <div className="h-6 border-l border-input mx-1" />
      <Button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        title="Encabezado 1"
      >
        <Heading1 className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        title="Encabezado 2"
      >
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        variant={editor.isActive('heading', { level: 3 }) ? 'secondary' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        title="Encabezado 3"
      >
        <Heading3 className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        title="Lista de viñetas"
      >
        <ListIcon className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        title="Lista numerada"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        title="Cita"
      >
        <QuoteIcon className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        variant={editor.isActive('codeBlock') ? 'secondary' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        title="Bloque de código"
      >
        <CodeSquare className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        variant={editor.isActive('taskList') ? 'secondary' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        title="Lista de tareas"
      >
        <CheckSquare className="h-4 w-4" />
      </Button>
      <div className="h-6 border-l border-input mx-1" />
      <Button
        onClick={() => {
          const url = window.prompt('URL:');
          if (url) {
            editor.chain().focus().setLink({ href: url }).run();
          }
        }}
        variant={editor.isActive('link') ? 'secondary' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        title="Insertar enlace"
      >
        <LinkIcon className="h-4 w-4" />
      </Button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        hidden
      />
      <Button
        onClick={() => fileInputRef.current?.click()}
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Insertar imagen"
      >
        <ImageIcon className="h-4 w-4" />
      </Button>
      <div className="h-6 border-l border-input mx-1" />
      <Button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Deshacer"
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Rehacer"
      >
        <Redo className="h-4 w-4" />
      </Button>
    </div>
  );
};

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  initialContent,
  onChange,
  isEditable = true,
  onImageUpload,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // Disable default codeBlock to use custom one
        blockquote: false, // Disable default blockquote to use custom one
        hardBreak: false, // Disable default hardBreak to use custom one
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      ListItem,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      CodeBlock.configure({
        HTMLAttributes: {
          class: 'bg-gray-800 text-white p-3 rounded-md font-mono text-sm overflow-x-auto',
        },
      }),
      Blockquote.configure({
        HTMLAttributes: {
          class: 'border-l-4 border-gray-300 pl-4 italic text-gray-600 dark:text-gray-400',
        },
      }),
      HardBreak,
      Heading.configure({ levels: [1, 2, 3] }),
      Bold,
      Italic,
      Strike,
      Underline,
      History,
      Placeholder.configure({
        placeholder: 'Escribe tu nota aquí...',
        emptyEditorClass: 'is-editor-empty',
        emptyNodeClass: 'is-empty',
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editable: isEditable,
    editorProps: {
      attributes: {
        class: cn(
          'prose dark:prose-invert max-w-none p-4 focus:outline-none min-h-[200px] overflow-y-auto',
          'text-foreground text-base leading-relaxed',
          'prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h1:font-bold prose-h2:font-semibold prose-h3:font-medium',
          'prose-ul:list-disc prose-ol:list-decimal prose-li:ml-4',
          'prose-a:text-blue-500 prose-a:underline',
          'prose-strong:font-bold',
          'prose-em:italic',
          'prose-code:bg-muted prose-code:px-1 prose-code:rounded',
          'prose-img:max-w-full prose-img:h-auto prose-img:rounded-lg prose-img:shadow-md',
          'prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400',
          'prose-hr:border-t prose-hr:border-gray-300 prose-hr:my-4'
        ),
      },
    },
  });

  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent, { emitUpdate: false }); // Corrected line
    }
  }, [editor, initialContent]);

  return (
    <div className="flex flex-col h-full border border-input rounded-md">
      <MenuBar editor={editor} onImageUpload={onImageUpload} />
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
};