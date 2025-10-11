"use client";

import React from 'react';
import { LegalPageLayout } from '@/components/legal-page-layout';

// ADVERTENCIA LEGAL: Este es un documento de plantilla y no constituye asesoramiento legal.
// Debes consultar con un profesional legal para asegurarte de que cumple con todas las
// leyes y regulaciones aplicables a tu negocio y jurisdicción.

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Política de Privacidad">
      <p><strong>Última actualización:</strong> 11 de Octubre de 2025</p>
      
      <h2>1. Introducción</h2>
      <p>Bienvenido a DeepAI Coder. Nos comprometemos a proteger tu privacidad. Esta Política de Privacidad explica cómo recopilamos, usamos, divulgamos y salvaguardamos tu información cuando utilizas nuestra aplicación web. Por favor, lee esta política de privacidad cuidadosamente. Si no estás de acuerdo con los términos de esta política de privacidad, por favor no accedas a la aplicación.</p>

      <h2>2. Información que Recopilamos</h2>
      <p>Podemos recopilar información sobre ti de varias maneras. La información que podemos recopilar en la Aplicación incluye:</p>
      <ul>
        <li><strong>Datos Personales:</strong> Información de identificación personal, como tu nombre, dirección de correo electrónico, que nos proporcionas voluntariamente cuando te registras en la Aplicación.</li>
        <li><strong>Datos de Uso:</strong> Información que nuestro servidor recopila automáticamente cuando accedes a la Aplicación, como tu dirección IP, tipo de navegador, sistema operativo, tiempos de acceso y las páginas que has visto directamente antes y después de acceder a la Aplicación.</li>
        <li><strong>Contenido Generado por el Usuario:</strong> Recopilamos el contenido que creas, subes o recibes de otros al usar nuestros servicios. Esto incluye los prompts que envías a la IA, el código generado, las notas que escribes y los archivos que subes.</li>
        <li><strong>Datos Financieros:</strong> Datos financieros, como los datos relacionados con tu método de pago (por ejemplo, número de tarjeta de crédito válido, marca de la tarjeta, fecha de vencimiento) que podemos recopilar cuando compras, pides, devuelves, cambias o solicitas información sobre nuestros servicios desde la Aplicación. Almacenamos solo información muy limitada, si la hay, de los datos financieros que recopilamos. De lo contrario, todos los datos financieros son almacenados por nuestro procesador de pagos (PayPal) y te animamos a que revises su política de privacidad.</li>
      </ul>

      <h2>3. Uso de tu Información</h2>
      <p>Tener información precisa sobre ti nos permite proporcionarte una experiencia fluida, eficiente y personalizada. Específicamente, podemos usar la información recopilada sobre ti a través de la Aplicación para:</p>
      <ul>
        <li>Crear y gestionar tu cuenta.</li>
        <li>Procesar pagos y reembolsos.</li>
        <li>Enviarte un correo electrónico con respecto a tu cuenta o pedido.</li>
        <li>Proporcionar y mejorar los servicios de IA.</li>
        <li>Prevenir actividades fraudulentas, supervisar contra robos y proteger contra actividades delictivas.</li>
        <li>Solicitar comentarios y contactarte sobre tu uso de la Aplicación.</li>
        <li>Resolver disputas y solucionar problemas.</li>
      </ul>

      <h2>4. Divulgación de tu Información</h2>
      <p>No compartiremos tu información con terceros excepto en las siguientes situaciones:</p>
      <ul>
        <li><strong>Por Ley o para Proteger Derechos:</strong> Si creemos que la divulgación de información sobre ti es necesaria para responder a un proceso legal, para investigar o remediar posibles violaciones de nuestras políticas, o para proteger los derechos, la propiedad y la seguridad de otros.</li>
        <li><strong>Proveedores de Servicios de Terceros:</strong> Podemos compartir tu información con terceros que realizan servicios para nosotros o en nuestro nombre, incluido el procesamiento de pagos, el análisis de datos, el alojamiento de servicios y la asistencia de marketing.</li>
        <li><strong>Proveedores de IA:</strong> Los prompts y el contenido que envías a las funciones de IA se compartirán con nuestros proveedores de modelos de lenguaje (por ejemplo, Google, Anthropic) para proporcionarte el servicio. Estos proveedores tienen sus propias políticas de privacidad.</li>
      </ul>

      <h2>5. Seguridad de tu Información</h2>
      <p>Utilizamos medidas de seguridad administrativas, técnicas y físicas para ayudar a proteger tu información personal. Si bien hemos tomado medidas razonables para asegurar la información personal que nos proporcionas, ten en cuenta que a pesar de nuestros esfuerzos, ninguna medida de seguridad es perfecta o impenetrable, y no se puede garantizar ningún método de transmisión de datos contra cualquier interceptación u otro tipo de uso indebido.</p>

      <h2>6. Tus Derechos de Privacidad</h2>
      <p>Dependiendo de tu ubicación, puedes tener los siguientes derechos con respecto a tu información personal:</p>
      <ul>
        <li>El derecho a solicitar acceso a la información personal que tenemos sobre ti.</li>
        <li>El derecho a solicitar la corrección o eliminación de tu información personal.</li>
        <li>El derecho a oponerte al procesamiento de tu información personal.</li>
      </ul>
      <p>Para ejercer estos derechos, por favor contáctanos utilizando la información de contacto proporcionada a continuación.</p>

      <h2>7. Contacto</h2>
      <p>Si tienes preguntas o comentarios sobre esta Política de Privacidad, por favor contáctanos en: [Tu Email de Contacto]</p>
    </LegalPageLayout>
  );
}