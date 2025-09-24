"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DebugFileUpload } from '@/components/debug-file-upload';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function DebugUploadPage() {
  const params = useParams();
  const appId = params.appId as string;
  const [testResults, setTestResults] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const runConnectionTest = async () => {
    setIsTesting(true);
    setTestResults(null);
    
    try {
      const res = await fetch(`/api/apps/${appId}/files/test-connection`);
      const data = await res.json();
      setTestResults(data);
      
      if (data.success) {
        toast.success('¡Todas las pruebas pasaron!');
      } else {
        toast.error('Algunas pruebas fallaron');
      }
    } catch (error) {
      console.error('Test error:', error);
      toast.error('Error al ejecutar las pruebas');
      setTestResults({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Debug: Subida de Archivos</h1>
      <p className="text-muted-foreground mb-6">App ID: {appId}</p>
      
      <div className="space-y-6">
        {/* Test de Conexión */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">1. Prueba de Conexión SSH/SFTP</h2>
          <Button onClick={runConnectionTest} disabled={isTesting}>
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ejecutando pruebas...
              </>
            ) : (
              'Ejecutar Pruebas de Conexión'
            )}
          </Button>
          
          {testResults && (
            <div className="mt-4 space-y-2">
              {testResults.success !== undefined && (
                <div className={`p-3 rounded-md ${testResults.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {testResults.success ? '✓ Todas las pruebas pasaron' : '✗ Algunas pruebas fallaron'}
                </div>
              )}
              
              {testResults.results?.steps?.map((step: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                  <span>{step.step}</span>
                  <span className={`font-mono text-sm ${
                    step.status === 'success' ? 'text-green-600' : 
                    step.status === 'failed' ? 'text-red-600' : 
                    'text-yellow-600'
                  }`}>
                    {step.status}
                    {step.error && <span className="ml-2 text-xs">({step.error})</span>}
                  </span>
                </div>
              ))}
              
              {testResults.error && (
                <div className="p-3 bg-red-100 text-red-800 rounded-md">
                  <pre className="text-xs whitespace-pre-wrap">{testResults.error}</pre>
                </div>
              )}
            </div>
          )}
        </Card>
        
        {/* Test de Subida Manual */}
        <DebugFileUpload appId={appId} />
        
        {/* Información de Debug */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">3. Información de Debug</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Sistema Operativo:</strong> {typeof window !== 'undefined' ? window.navigator.platform : 'N/A'}</p>
            <p><strong>URL de la API:</strong> /api/apps/{appId}/files</p>
            <p><strong>Método:</strong> POST</p>
            <p><strong>Headers:</strong> Content-Type: application/json</p>
          </div>
        </Card>
      </div>
    </div>
  );
}