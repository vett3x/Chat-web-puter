-- Create the table to store legal documents
CREATE TABLE public.legal_documents (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION handle_legal_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updates
CREATE TRIGGER on_legal_documents_updated
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW
  EXECUTE FUNCTION handle_legal_documents_updated_at();

-- Policies
-- 1. Public can read all documents
CREATE POLICY "Public can read legal documents"
  ON public.legal_documents FOR SELECT
  USING (true);

-- 2. Super admins can manage documents
CREATE POLICY "Super admins can manage legal documents"
  ON public.legal_documents FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

-- Seed the table with the current Privacy Policy content
INSERT INTO public.legal_documents (slug, title, content)
VALUES (
  'privacy-policy',
  'Política de Privacidad',
  $$
**Última actualización:** 11 de Octubre de 2025

## 1. Introducción
Bienvenido a DeepAI Coder ("nosotros", "nuestro"). Nos comprometemos a proteger tu privacidad. Esta Política de Privacidad explica cómo recopilamos, usamos, divulgamos y salvaguardamos tu información cuando utilizas nuestra aplicación web (la "Aplicación"). Por favor, lee esta política de privacidad cuidadosamente. Si no estás de acuerdo con los términos de esta política de privacidad, por favor no accedas a la aplicación.

## 2. Información que Recopilamos
Podemos recopilar información sobre ti de varias maneras. La información que podemos recopilar en la Aplicación incluye:

- **Datos Personales:** Información de identificación personal, como tu nombre, dirección de correo electrónico, que nos proporcionas voluntariamente cuando te registras en la Aplicación. La base legal para este procesamiento es la ejecución de nuestro contrato de servicio contigo.
- **Datos de Uso:** Información que nuestro servidor recopila automáticamente cuando accedes a la Aplicación, como tu dirección IP, tipo de navegador, y tiempos de acceso. La base legal para este procesamiento es nuestro interés legítimo en mantener la seguridad y el funcionamiento de nuestra Aplicación.
- **Contenido Generado por el Usuario:** Recopilamos el contenido que creas, subes o recibes de otros al usar nuestros servicios. Esto incluye los prompts que envías a la IA, el código generado, las notas que escribes y los archivos que subes. La base legal es la ejecución de nuestro contrato de servicio.
- **Datos Financieros:** Datos relacionados con tu método de pago que recopilamos cuando te suscribes a un plan de pago. Estos datos son procesados de forma segura por nuestro proveedor de pagos (PayPal). La base legal es la ejecución de un contrato.

## 3. Uso de tu Información
Tener información precisa sobre ti nos permite proporcionarte una experiencia fluida, eficiente y personalizada. Específicamente, podemos usar la información recopilada sobre ti para:

- Crear y gestionar tu cuenta.
- Procesar pagos y transacciones.
- Proporcionar y mejorar los servicios de la Aplicación.
- Prevenir actividades fraudulentas y garantizar la seguridad.
- Comunicarnos contigo sobre tu cuenta o servicios.
- Cumplir con nuestras obligaciones legales.

## 4. Divulgación de tu Información
No compartiremos tu información con terceros excepto en las siguientes situaciones:

- **Por Ley o para Proteger Derechos:** Si la divulgación es necesaria para responder a un proceso legal, investigar violaciones de nuestras políticas, o proteger los derechos, la propiedad y la seguridad de otros.
- **Proveedores de Servicios de Terceros:** Compartimos información con terceros que realizan servicios para nosotros, como procesamiento de pagos (PayPal), alojamiento en la nube y proveedores de modelos de IA.
- **Transferencias Internacionales de Datos:** Tu información, incluido el contenido que envías a la IA, puede ser transferida, almacenada y procesada en países fuera de tu país de residencia, donde las leyes de protección de datos pueden ser diferentes. Utilizamos proveedores (como Google y Anthropic) que se adhieren a marcos de protección de datos reconocidos para garantizar la seguridad de tus datos.

## 5. Seguridad de tu Información
Utilizamos medidas de seguridad administrativas, técnicas y físicas para ayudar a proteger tu información personal. Si bien hemos tomado medidas razonables para asegurar la información personal que nos proporcionas, ninguna medida de seguridad es perfecta o impenetrable.

## 6. Retención de Datos
Retendremos tu información personal solo durante el tiempo que sea necesario para los fines establecidos en esta política de privacidad. Retendremos y utilizaremos tu información en la medida necesaria para cumplir con nuestras obligaciones legales, resolver disputas y hacer cumplir nuestras políticas.

## 7. Tus Derechos de Protección de Datos (GDPR)
Si eres residente del Espacio Económico Europeo (EEE), tienes ciertos derechos de protección de datos. Nuestro objetivo es tomar medidas razonables para permitirte corregir, modificar, eliminar o limitar el uso de tus Datos Personales.

- **El derecho de acceso, actualización o eliminación:** Puedes acceder, actualizar o solicitar la eliminación de tu información directamente desde la configuración de tu cuenta.
- **El derecho de rectificación:** Tienes derecho a que se rectifique tu información si es inexacta o incompleta.
- **El derecho a oponerte:** Tienes derecho a oponerte a nuestro procesamiento de tus Datos Personales.
- **El derecho de restricción:** Tienes derecho a solicitar que restrinjamos el procesamiento de tu información personal.
- **El derecho a la portabilidad de datos:** Tienes derecho a que se te proporcione una copia de la información que tenemos sobre ti en un formato estructurado, legible por máquina y de uso común.
- **El derecho a retirar el consentimiento:** También tienes derecho a retirar tu consentimiento en cualquier momento en que nos hayamos basado en tu consentimiento para procesar tu información personal.

Ten en cuenta que podemos pedirte que verifiques tu identidad antes de responder a tales solicitudes. Tienes derecho a presentar una queja ante una Autoridad de Protección de Datos sobre nuestra recopilación y uso de tus Datos Personales.

## 8. Política para Niños
Nuestros servicios no están dirigidos a menores de 13 años. No recopilamos conscientemente información de identificación personal de niños menores de 13 años. Si te das cuenta de que un niño nos ha proporcionado datos personales, por favor contáctanos.

## 9. Contacto
Si tienes preguntas o comentarios sobre esta Política de Privacidad, por favor contáctanos en: [Tu Email de Contacto]
  $$
);

-- Seed the table with the current Terms of Service content
INSERT INTO public.legal_documents (slug, title, content)
VALUES (
  'terms-of-service',
  'Términos de Servicio',
  $$
**Última actualización:** 11 de Octubre de 2025

## 1. Acuerdo de los Términos
Estos Términos de Servicio constituyen un acuerdo legalmente vinculante entre tú, ya sea personalmente o en nombre de una entidad ("tú") y DeepAI Coder ("nosotros", "nuestro"), con respecto a tu acceso y uso de la aplicación web DeepAI Coder (la "Aplicación"). Al acceder a la Aplicación, declaras que has leído, entendido y aceptas estar obligado por todos estos Términos de Servicio. Si no estás de acuerdo con todos estos términos, se te prohíbe expresamente el uso de la Aplicación y debes discontinuar su uso inmediatamente.

## 2. Cuentas de Usuario
Para utilizar la mayoría de las funciones de la Aplicación, debes registrarte para obtener una cuenta. Debes proporcionar información precisa y completa. Eres el único responsable de la actividad que ocurra en tu cuenta y debes mantener segura la contraseña de tu cuenta. Debes notificarnos inmediatamente de cualquier brecha de seguridad o uso no autorizado de tu cuenta.

## 3. Uso Aceptable
Aceptas no utilizar la Aplicación para ningún propósito que sea ilegal o esté prohibido por estos Términos. Aceptas no:

- Realizar ninguna actividad que interfiera o interrumpa la Aplicación.
- Intentar realizar ingeniería inversa, descompilar, desensamblar o descubrir el código fuente de la Aplicación.
- Utilizar la Aplicación para generar o distribuir spam, malware, virus o cualquier código malicioso.
- Utilizar la Aplicación para generar contenido que sea ilegal, difamatorio, acosador, abusivo, fraudulento o de cualquier otra manera objetable.
- Violar los derechos de propiedad intelectual de otros.

## 4. Propiedad Intelectual
**Nuestra Propiedad Intelectual:** Nosotros poseemos todos los derechos, títulos e intereses sobre la Aplicación, incluyendo todo el software, texto, gráficos, logos e interfaces de usuario asociados. Estos Términos no te otorgan ningún derecho sobre nuestra propiedad intelectual, excepto por la licencia limitada para usar la Aplicación.

**Tu Contenido:** Tú conservas la plena propiedad de los prompts que proporcionas y del código o contenido generado por la IA en tu nombre ("Tu Contenido"). Nos otorgas una licencia mundial, no exclusiva y libre de regalías para usar, reproducir, modificar y mostrar Tu Contenido únicamente con el propósito de operar, proporcionar y mejorar la Aplicación.

## 5. Suscripciones y Pagos
Algunas partes del Servicio están disponibles solo mediante la compra de una suscripción de pago. Aceptas proporcionar información de pago actual, completa y precisa. Todos los pagos son manejados por nuestro procesador de pagos externo (PayPal). No almacenamos la información completa de tu tarjeta de crédito. Las suscripciones se facturan de forma recurrente y por adelantado. Salvo que la ley exija lo contrario, todas las tarifas no son reembolsables.

## 6. Terminación
Puedes dejar de usar nuestros servicios en cualquier momento. Nos reservamos el derecho de suspender o terminar tu acceso a la Aplicación en cualquier momento, a nuestra discreción, sin previo aviso y sin responsabilidad, incluso por incumplimiento de estos Términos. Tras la terminación, tu derecho a usar la Aplicación cesará inmediatamente.

## 7. Renuncia de Garantías (Descargo de Responsabilidad)
LA APLICACIÓN SE PROPORCIONA "TAL CUAL" Y "SEGÚN DISPONIBILIDAD". EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY, RENUNCIAMOS A TODAS LAS GARANTÍAS, EXPRESAS O IMPLÍCITAS, EN RELACIÓN CON LA APLICACIÓN Y TU USO DE LA MISMA, INCLUIDAS, ENTRE OTRAS, LAS GARANTÍAS IMPLÍCITAS DE COMERCIABILIDAD, IDONEIDAD PARA UN PROPÓSITO PARTICULAR Y NO INFRACCIÓN. NO GARANTIZAMOS QUE LA APLICACIÓN O EL CÓDIGO GENERADO SEAN SEGUROS, LIBRES DE ERRORES, O QUE FUNCIONEN SIN INTERRUPCIONES.

## 8. Limitación de Responsabilidad
EN NINGÚN CASO NOSOTROS O NUESTROS DIRECTORES, EMPLEADOS O AGENTES SEREMOS RESPONSABLES ANTE TI O CUALQUIER TERCERO POR CUALQUIER DAÑO DIRECTO, INDIRECTO, CONSECUENTE, EJEMPLAR, INCIDENTAL, ESPECIAL O PUNITIVO, INCLUIDA LA PÉRDIDA DE BENEFICIOS, PÉRDIDA DE INGRESOS, PÉRDIDA DE DATOS U OTROS DAÑOS DERIVADOS DE TU USO DE LA APLICACIÓN, INCLUSO SI HEMOS SIDO ADVERTIDOS DE LA POSIBILIDAD DE TALES DAÑOS. NUESTRA RESPONSABILIDAD TOTAL HACIA TI POR CUALQUIER CAUSA Y SIN IMPORTAR LA FORMA DE LA ACCIÓN, SE LIMITARÁ EN TODO MOMENTO AL MONTO PAGADO, SI LO HUBIERA, POR TI A NOSOTROS DURANTE EL PERÍODO DE TRES (3) MESES ANTERIOR A CUALQUIER CAUSA DE ACCIÓN QUE SURJA.

## 9. Ley Aplicable
Estos Términos se regirán e interpretarán de acuerdo con las leyes de [Tu Jurisdicción], sin tener en cuenta sus disposiciones sobre conflicto de leyes.

## 10. Cambios a los Términos
Nos reservamos el derecho, a nuestra entera discreción, de realizar cambios o modificaciones a estos Términos de Servicio en cualquier momento y por cualquier motivo. Te alertaremos sobre cualquier cambio actualizando la fecha de "Última actualización" de estos Términos de Servicio.

## 11. Contacto
Si tienes preguntas o comentarios sobre estos Términos, por favor contáctanos en: [Tu Email de Contacto]
  $$
);