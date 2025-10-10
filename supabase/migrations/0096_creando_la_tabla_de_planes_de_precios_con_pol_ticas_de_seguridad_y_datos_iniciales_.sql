-- Create the pricing_plans table
CREATE TABLE public.pricing_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    price TEXT NOT NULL,
    price_period TEXT,
    description TEXT,
    features JSONB,
    cta_text TEXT,
    cta_href TEXT,
    highlight BOOLEAN DEFAULT FALSE,
    badge_text TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    order_index INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access for active plans
CREATE POLICY "Public read access for active plans" ON public.pricing_plans
FOR SELECT USING (is_active = TRUE);

-- Policy: Allow super admins to manage all plans
CREATE POLICY "Super admins can manage plans" ON public.pricing_plans
FOR ALL TO authenticated
USING (get_user_role(auth.uid()) = 'super_admin')
WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

-- Insert initial data based on the current landing page
INSERT INTO public.pricing_plans (name, price, price_period, description, features, cta_text, cta_href, highlight, badge_text, order_index)
VALUES
('Hobby', '$0', NULL, 'Para proyectos personales y experimentación.', '["1 Proyecto Activo", "Asistente de IA y Notas Inteligentes", "Recursos Limitados (0.5 CPU, 512MB RAM)", "250 MB de Almacenamiento", "Despliegue con Subdominio", "Soporte Comunitario"]', 'Empezar Gratis', '/start', FALSE, NULL, 1),
('Pro', '$25', '/mes', 'Para desarrolladores serios y freelancers.', '["10 Proyectos Activos", "Recursos Ampliados (2 CPU, 2GB RAM)", "5 GB de Almacenamiento", "Proyectos Siempre Activos", "Dominio Personalizado", "Backups Automáticos", "Soporte Prioritario"]', 'Empezar Ahora', '/start', TRUE, 'Más Popular', 2),
('Enterprise', 'Contacto', NULL, 'Para equipos y empresas que necesitan más.', '["Proyectos Ilimitados", "Soporte Dedicado 24/7", "Infraestructura Personalizada", "SSO y Seguridad Avanzada"]', 'Contactar Ventas', '#contact', FALSE, NULL, 3);