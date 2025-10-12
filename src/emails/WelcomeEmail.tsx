import {
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import EmailLayout from './components/EmailLayout';
import EmailButton from './components/EmailButton';

interface WelcomeEmailProps {
  confirmationUrl?: string;
}

export const WelcomeEmail = ({ confirmationUrl = '{{ .ConfirmationURL }}' }: WelcomeEmailProps) => (
  <EmailLayout
    preview="Bienvenido a DeepAI Coder"
    title="¡Bienvenido a Bordo!"
  >
    <Text className="text-gray-700 text-base leading-7">
      ¡Gracias por unirte a DeepAI Coder! Estamos emocionados de tenerte con nosotros.
    </Text>
    <Text className="text-gray-700 text-base leading-7">
      Para empezar, por favor confirma tu dirección de correo electrónico haciendo clic en el botón de abajo.
    </Text>
    <Section className="text-center my-8">
      <EmailButton href={confirmationUrl}>
        Confirmar mi cuenta
      </EmailButton>
    </Section>
    <Text className="text-gray-500 text-sm leading-6">
      Si no te registraste en DeepAI Coder, por favor ignora este correo.
    </Text>
  </EmailLayout>
);

export default WelcomeEmail;