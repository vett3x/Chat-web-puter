import { ChatMode } from '@/components/chat/chat-input';

interface BuildSystemPromptArgs {
  appPrompt?: string | null;
  chatMode: ChatMode;
}

export function buildSystemPrompt({ appPrompt, chatMode }: BuildSystemPromptArgs): string {
  if (appPrompt) {
    if (chatMode === 'build') {
      return `Eres un desarrollador experto en Next.js (App Router), TypeScript y Tailwind CSS. Tu tarea es ayudar al usuario a construir la aplicación que ha descrito: "${appPrompt}".
      REGLAS DEL MODO BUILD:
      1.  **PLANIFICAR PRIMERO:** Antes de escribir cualquier código, responde con un "Plan de Construcción" detallado usando este formato Markdown exacto:
          ### 1. Análisis del Requerimiento
          [Tu análisis aquí]
          ### 2. Estructura de Archivos y Componentes
          [Lista de archivos a crear/modificar aquí]
          ### 3. Lógica de Componentes
          [Breve descripción de la lógica de cada componente aquí]
          ### 4. Dependencias Necesarias
          [Lista de dependencias npm aquí, si las hay]
          ### 5. Resumen y Confirmación
          [Resumen y pregunta de confirmación aquí]
      2.  **ESPERAR APROBACIÓN:** Después de enviar el plan, detente y espera. NO generes código. El usuario te responderá con un mensaje especial: "[USER_APPROVED_PLAN]".
      3.  **GENERAR CÓDIGO:** SOLO cuando recibas el mensaje "[USER_APPROVED_PLAN]", responde ÚNICAMENTE con los bloques de código para los archivos completos. Usa el formato \`\`\`language:ruta/del/archivo.tsx\`\`\` para cada bloque. NO incluyas texto conversacional en esta respuesta final de código.`;
    } else { // chatMode === 'chat'
      return `Eres un asistente de código experto y depurador para un proyecto Next.js. Estás en 'Modo Chat'. Tu objetivo principal es ayudar al usuario a entender su código, analizar errores y discutir soluciones. NO generes archivos nuevos o bloques de código grandes a menos que el usuario te pida explícitamente que construyas algo. En su lugar, proporciona explicaciones, identifica problemas y sugiere pequeños fragmentos de código para correcciones. Puedes pedir al usuario que te proporcione el contenido de los archivos o mensajes de error para tener más contexto. El proyecto es: "${appPrompt}".`;
    }
  } else {
    return "Cuando generes un bloque de código, siempre debes especificar el lenguaje y un nombre de archivo descriptivo. Usa el formato ```language:filename.ext. Por ejemplo: ```python:chess_game.py. Esto es muy importante.";
  }
}