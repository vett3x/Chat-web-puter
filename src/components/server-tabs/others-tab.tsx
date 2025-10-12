"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings2, Tag, Hash, ChevronDown, ChevronRight, FileText, Users, KeyRound, Image as ImageIcon, Mail, Brush } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TeamMembersManager } from '../admin/team-members-manager';
import { AuthConfigManager } from '../admin/auth-config-manager';
import { TechnologyLogosManager } from '../admin/TechnologyLogosManager';
import { SmtpConfigManager } from '../admin/smtp-config-manager';
import { VersionManager } from '../admin/VersionManager'; // Assuming you'll create this
import { LegalDocumentsManager } from '../admin/LegalDocumentsManager'; // Renamed
import { EmailTemplateManager } from '../admin/EmailTemplateManager'; // New import

export function OthersTab() {
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    setOpenItemId(prev => (prev === id ? null : id));
  };

  const sections = [
    { id: 'smtp', icon: <Mail className="h-5 w-5" />, title: 'Configuración SMTP', description: 'Gestiona las credenciales del servidor de correo para enviar emails.', component: <SmtpConfigManager /> },
    { id: 'email_templates', icon: <Brush className="h-5 w-5" />, title: 'Plantillas de Email', description: 'Previsualiza y obtén el HTML de los correos transaccionales.', component: <EmailTemplateManager /> },
    { id: 'team', icon: <Users className="h-5 w-5" />, title: 'Gestión de Equipo', description: 'Añade, edita o elimina miembros del equipo de la página "Sobre Nosotros".', component: <TeamMembersManager /> },
    { id: 'tech_logos', icon: <ImageIcon className="h-5 w-5" />, title: 'Gestión de Logos de Tecnologías', description: 'Gestiona los logos que se muestran en la landing page.', component: <TechnologyLogosManager /> },
    { id: 'auth', icon: <KeyRound className="h-5 w-5" />, title: 'Configuración de Autenticación', description: 'Gestiona las claves de API para Google OAuth y reCAPTCHA.', component: <AuthConfigManager /> },
    { id: 'version', icon: <Tag className="h-5 w-5" />, title: 'Gestión de Versión', description: 'Actualiza la versión y el número de compilación de la aplicación.', component: <VersionManager /> },
    { id: 'legal', icon: <FileText className="h-5 w-5" />, title: 'Gestión de Documentos Legales', description: 'Edita el contenido de la Política de Privacidad y los Términos de Servicio.', component: <LegalDocumentsManager /> },
  ];

  return (
    <div className="space-y-8 p-1">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings2 className="h-6 w-6" /> Otras Configuraciones</CardTitle>
          <CardDescription>Configuraciones adicionales y herramientas para la gestión de la aplicación.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {sections.map(({ id, icon, title, description, component }) => (
            <Collapsible key={id} open={openItemId === id} onOpenChange={() => handleToggle(id)} className="border rounded-lg">
              <CollapsibleTrigger asChild>
                <button type="button" className="flex items-center justify-between w-full p-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">{icon}</div>
                    <div>
                      <h4 className="font-semibold">{title}</h4>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                  </div>
                  {openItemId === id ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <div className="border-t px-4 pt-4 pb-4">
                  {component}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}