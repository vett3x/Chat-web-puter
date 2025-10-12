-- Create email_templates table
CREATE TABLE public.email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for super admins
CREATE POLICY "Super admins can manage email templates"
ON public.email_templates
FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = 'super_admin'::text)
WITH CHECK (get_user_role(auth.uid()) = 'super_admin'::text);

-- Trigger to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.handle_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_email_templates_updated
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.handle_email_templates_updated_at();

-- Seed with initial templates
INSERT INTO public.email_templates (slug, name, subject, content)
VALUES
  ('welcome', 'Correo de Bienvenida', '¡Bienvenido a DeepAI Coder!', E'¡Hola!\n\nGracias por unirte a DeepAI Coder. Estamos emocionados de tenerte con nosotros.\n\nPara empezar, por favor confirma tu dirección de correo electrónico haciendo clic en el botón de abajo.\n\n[BUTTON:Confirmar mi cuenta]({{ .ConfirmationURL }})\n\nSi no te registraste en DeepAI Coder, por favor ignora este correo.'),
  ('reset-password', 'Restablecimiento de Contraseña', 'Restablece tu contraseña de DeepAI Coder', E'Hola,\n\nHemos recibido una solicitud para restablecer la contraseña de tu cuenta.\n\nHaz clic en el botón de abajo para establecer una nueva contraseña. Este enlace es válido por 60 minutos.\n\n[BUTTON:Restablecer mi contraseña]({{ .ConfirmationURL }})\n\nSi no solicitaste un restablecimiento de contraseña, por favor ignora este correo.');