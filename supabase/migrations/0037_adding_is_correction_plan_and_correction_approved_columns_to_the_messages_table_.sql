<dyad-execute-sql description="Añadiendo is_correction_plan y correction_approved a la tabla messages">
ALTER TABLE public.messages
ADD COLUMN is_correction_plan BOOLEAN DEFAULT FALSE,
ADD COLUMN correction_approved BOOLEAN DEFAULT FALSE;

-- Opcional: Crear políticas RLS para las nuevas columnas si es necesario
-- Por ejemplo, si solo el usuario que creó el mensaje puede ver/actualizar estos campos:
-- CREATE POLICY "Allow users to update their own correction plan status" ON public.messages
-- FOR UPDATE TO authenticated USING (auth.uid() = user_id);
</dyad-execute-sql>