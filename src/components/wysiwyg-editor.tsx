"use client";

import React, { useEffect, useRef } from 'react';
import { Editor, rootCtx } from '@milkdown/core';
import { nord } from '@milkdown/theme-nord';
import { ReactEditor, useEditor } from '@milkdown/react';
import { commonmark } from '@milkdown/preset-commonmark';
import { getDoc, replaceAll } from '@milkdown/utils';

interface WysiwygEditorProps {
  value: string;
  onChange: (markdown: string) => void;
}

const MilkdownEditor: React.FC<WysiwygEditorProps> = ({ value, onChange }) => {
  const editorRef = useRef<Editor | null>(null);
  const valueRef = useRef(value);

  const { editor, getInstance } = useEditor((root) => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
      })
      .use(nord)
      .use(commonmark);

    editorRef.current = editor;
    return editor;
  });

  useEffect(() => {
    const instance = getInstance();
    if (instance) {
      instance.action(replaceAll(value));
      valueRef.current = value;

      const listener = () => {
        const markdown = instance.action(getDoc());
        if (valueRef.current !== markdown) {
          onChange(markdown);
          valueRef.current = markdown;
        }
      };
      instance.on('updated', listener);

      return () => {
        instance.off('updated', listener);
      };
    }
  }, [getInstance, onChange, value]);

  return <ReactEditor editor={editor} />;
};

export const WysiwygEditor = (props: WysiwygEditorProps) => {
  return <MilkdownEditor {...props} />;
};