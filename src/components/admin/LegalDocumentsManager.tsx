"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import MDEditor from '@uiw/react-md-editor';
import { useTheme } from 'next-themes';

interface LegalDocument {
  slug: string;
  title: string;
  content: string | null;
  updated_at: string;
}

export function LegalDocumentsManager() {
  const { resolvedTheme } = useTheme();
  const [docs, setDocs] = useState<LegalDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<LegalDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchDocs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/legal-documents');
      if (!response.ok) throw new Error('No se pudo cargar los documentos legales.');
      const data = await response.json();
      setDocs(data);
      if (data.length > 0) {
        setSelectedDoc(data[0]);
      }
    } catch (err: any) { toast.error(err.message); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleSave = async () => {
    if (!selectedDoc) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/legal-documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: selectedDoc.slug, title: selectedDoc.title, content: selectedDoc.content }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(result.message);
      fetchDocs();
    } catch (err: any) { toast.error(`Error al guardar: ${err.message}`); } finally { setIsSaving(false); }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {docs.map(doc => (
          <Button key={doc.slug} variant={selectedDoc?.slug === doc.slug ? 'default' : 'outline'} onClick={() => setSelectedDoc(doc)}>
            {doc.title}
          </Button>
        ))}
      </div>
      {selectedDoc && (
        <div className="space-y-4">
          <Input value={selectedDoc.title} onChange={(e) => setSelectedDoc({ ...selectedDoc, title: e.target.value })} disabled={isSaving} />
          <div data-color-mode={resolvedTheme}>
            <MDEditor
              value={selectedDoc.content || ''}
              onChange={(val) => setSelectedDoc({ ...selectedDoc, content: val || '' })}
              height={400}
              preview="live"
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar Documento</Button>
        </div>
      )}
    </div>
  );
}