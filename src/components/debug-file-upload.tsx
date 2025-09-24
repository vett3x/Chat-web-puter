"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface DebugFileUploadProps {
  appId: string;
}

export function DebugFileUpload({ appId }: DebugFileUploadProps) {
  const [filePath, setFilePath] = useState('src/test.txt');
  const [fileContent, setFileContent] = useState('Hello from debug test!');
  const [isUploading, setIsUploading] = useState(false);
  const [response, setResponse] = useState<string>('');

  const testFileUpload = async () => {
    setIsUploading(true);
    setResponse('');
    
    try {
      console.log('[DEBUG] Starting file upload test...');
      console.log('[DEBUG] App ID:', appId);
      console.log('[DEBUG] File path:', filePath);
      console.log('[DEBUG] Content length:', fileContent.length);
      
      const res = await fetch(`/api/apps/${appId}/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: [{
            filePath: filePath,
            content: fileContent
          }]
        }),
      });

      const responseText = await res.text();
      console.log('[DEBUG] Response status:', res.status);
      console.log('[DEBUG] Response text:', responseText);
      
      setResponse(`Status: ${res.status}\nResponse: ${responseText}`);
      
      if (res.ok) {
        toast.success('¡Archivo subido correctamente!');
      } else {
        toast.error(`Error: ${res.status} - ${responseText}`);
      }
    } catch (error) {
      console.error('[DEBUG] Upload error:', error);
      setResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast.error('Error al subir el archivo');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Debug: Prueba de Subida de Archivos</h3>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Ruta del archivo:</label>
        <Input
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          placeholder="src/test.txt"
        />
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Contenido del archivo:</label>
        <Textarea
          value={fileContent}
          onChange={(e) => setFileContent(e.target.value)}
          placeholder="Contenido del archivo..."
          rows={4}
        />
      </div>
      
      <Button 
        onClick={testFileUpload} 
        disabled={isUploading || !filePath || !fileContent}
        className="w-full"
      >
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Subiendo...
          </>
        ) : (
          'Probar Subida de Archivo'
        )}
      </Button>
      
      {response && (
        <div className="mt-4 p-3 bg-muted rounded-md">
          <pre className="text-xs whitespace-pre-wrap">{response}</pre>
        </div>
      )}
    </Card>
  );
}