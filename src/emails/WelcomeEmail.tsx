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
    <Text className="text-black text-sm leading-6">
      ¡Gracias por unirte a DeepAI Coder! Estamos emocionados de tenerte con nosotros.
    </Text>
    <Text className="text-black text-sm leading-6">
      Para empezar, por favor confirma tu dirección de correo electrónico haciendo clic en el botón de abajo.
    </Text>
    <Section className="text-center mt-8 mb-8">
      <EmailButton href={confirmationUrl}>
        Confirmar mi cuenta
      </EmailButton>
    </Section>
    <Text className="text-black text-sm leading-6">
      Si no te registraste en DeepAI Coder, por favor ignora este correo.
    </Text>
  </EmailLayout>
);

export default WelcomeEmail;