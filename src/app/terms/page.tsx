"use client";

import React from 'react';
import { LegalPageLayout } from '@/components/legal-page-layout';

// ADVERTENCIA LEGAL: Este es un documento de plantilla y no constituye asesoramiento legal.
// Debes consultar con un profesional legal para asegurarte de que cumple con todas las
// leyes y regulaciones aplicables a tu negocio y jurisdicción.

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout title="Términos de Servicio">
      <p><strong>Última actualización:</strong> 11 de Octubre de 2025</p>

      <h2>1. Acuerdo de los Términos</h2>
      <p>Estos Términos de Servicio constituyen un acuerdo legalmente vinculante entre tú, ya sea personalmente o en nombre de una entidad ("tú") y DeepAI Coder ("nosotros", "nuestro"), con respecto a tu acceso y uso de la aplicación web DeepAI Coder (la "Aplicación"). Al acceder a la Aplicación, declaras que has leído, entendido y aceptas estar obligado por todos estos Términos de Servicio. Si no estás de acuerdo con todos estos términos, se te prohíbe expresamente el uso de la Aplicación y debes discontinuar su uso inmediatamente.</p>

      <h2>2. Cuentas de Usuario</h2>
      <p>Para utilizar la mayoría de las funciones de la Aplicación, debes registrarte para obtener una cuenta. Debes proporcionar información precisa y completa. Eres el único responsable de la actividad que ocurra en tu cuenta y debes mantener segura la contraseña de tu cuenta. Debes notificarnos inmediatamente de cualquier brecha de seguridad o uso no autorizado de tu cuenta.</p>

      <h2>3. Uso Aceptable</h2>
      <p>Aceptas no utilizar la Aplicación para ningún propósito que sea ilegal o esté prohibido por estos Términos. Aceptas no:</p>
      <ul>
        <li>Realizar ninguna actividad que interfiera o interrumpa la Aplicación.</li>
        <li>Intentar realizar ingeniería inversa, descompilar, desensamblar o descubrir el código fuente de la Aplicación.</li>
        <li>Utilizar la Aplicación para generar o distribuir spam, malware, virus o cualquier código malicioso.</li>
        <li>Utilizar la Aplicación para generar contenido que sea ilegal, difamatorio, acosador, abusivo, fraudulento o de cualquier otra manera objetable.</li>
        <li>Violar los derechos de propiedad intelectual de otros.</li>
      </ul>

      <h2>4. Propiedad Intelectual</h2>
      <p><strong>Nuestra Propiedad Intelectual:</strong> Nosotros poseemos todos los derechos, títulos e intereses sobre la Aplicación, incluyendo todo el software, texto, gráficos, logos e interfaces de usuario asociados. Estos Términos no te otorgan ningún derecho sobre nuestra propiedad intelectual, excepto por la licencia limitada para usar la Aplicación.</p>
      <p><strong>Tu Contenido:</strong> Tú conservas la plena propiedad de los prompts que proporcionas y del código o contenido generado por la IA en tu nombre ("Tu Contenido"). Nos otorgas una licencia mundial, no exclusiva y libre de regalías para usar, reproducir, modificar y mostrar Tu Contenido únicamente con el propósito de operar, proporcionar y mejorar la Aplicación.</p>

      <h2>5. Suscripciones y Pagos</h2>
      <p>Algunas partes del Servicio están disponibles solo mediante la compra de una suscripción de pago. Aceptas proporcionar información de pago actual, completa y precisa. Todos los pagos son manejados por nuestro procesador de pagos externo (PayPal). No almacenamos la información completa de tu tarjeta de crédito. Las suscripciones se facturan de forma recurrente y por adelantado. Salvo que la ley exija lo contrario, todas las tarifas no son reembolsables.</p>

      <h2>6. Terminación</h2>
      <p>Puedes dejar de usar nuestros servicios en cualquier momento. Nos reservamos el derecho de suspender o terminar tu acceso a la Aplicación en cualquier momento, a nuestra discreción, sin previo aviso y sin responsabilidad, incluso por incumplimiento de estos Términos. Tras la terminación, tu derecho a usar la Aplicación cesará inmediatamente.</p>

      <h2>7. Renuncia de Garantías (Descargo de Responsabilidad)</h2>
      <p>LA APLICACIÓN SE PROPORCIONA "TAL CUAL" Y "SEGÚN DISPONIBILIDAD". EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY, RENUNCIAMOS A TODAS LAS GARANTÍAS, EXPRESAS O IMPLÍCITAS, EN RELACIÓN CON LA APLICACIÓN Y TU USO DE LA MISMA, INCLUIDAS, ENTRE OTRAS, LAS GARANTÍAS IMPLÍCITAS DE COMERCIABILIDAD, IDONEIDAD PARA UN PROPÓSITO PARTICULAR Y NO INFRACCIÓN. NO GARANTIZAMOS QUE LA APLICACIÓN O EL CÓDIGO GENERADO SEAN SEGUROS, LIBRES DE ERRORES, O QUE FUNCIONEN SIN INTERRUPCIONES.</p>

      <h2>8. Limitación de Responsabilidad</h2>
      <p>EN NINGÚN CASO NOSOTROS O NUESTROS DIRECTORES, EMPLEADOS O AGENTES SEREMOS RESPONSABLES ANTE TI O CUALQUIER TERCERO POR CUALQUIER DAÑO DIRECTO, INDIRECTO, CONSECUENTE, EJEMPLAR, INCIDENTAL, ESPECIAL O PUNITIVO, INCLUIDA LA PÉRDIDA DE BENEFICIOS, PÉRDIDA DE INGRESOS, PÉRDIDA DE DATOS U OTROS DAÑOS DERIVADOS DE TU USO DE LA APLICACIÓN, INCLUSO SI HEMOS SIDO ADVERTIDOS DE LA POSIBILIDAD DE TALES DAÑOS. NUESTRA RESPONSABILIDAD TOTAL HACIA TI POR CUALQUIER CAUSA Y SIN IMPORTAR LA FORMA DE LA ACCIÓN, SE LIMITARÁ EN TODO MOMENTO AL MONTO PAGADO, SI LO HUBIERA, POR TI A NOSOTROS DURANTE EL PERÍODO DE TRES (3) MESES ANTERIOR A CUALQUIER CAUSA DE ACCIÓN QUE SURJA.</p>

      <h2>9. Ley Aplicable</h2>
      <p>Estos Términos se regirán e interpretarán de acuerdo con las leyes de [Tu Jurisdicción], sin tener en cuenta sus disposiciones sobre conflicto de leyes.</p>

      <h2>10. Cambios a los Términos</h2>
      <p>Nos reservamos el derecho, a nuestra entera discreción, de realizar cambios o modificaciones a estos Términos de Servicio en cualquier momento y por cualquier motivo. Te alertaremos sobre cualquier cambio actualizando la fecha de "Última actualización" de estos Términos de Servicio.</p>

      <h2>11. Contacto</h2>
      <p>Si tienes preguntas o comentarios sobre estos Términos, por favor contáctanos en: [Tu Email de Contacto]</p>
    </LegalPageLayout>
  );
}