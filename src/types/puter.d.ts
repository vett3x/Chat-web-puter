declare global {
  interface Window {
    puter: {
      ai: {
        chat: (messages: any[], options: { model: string }) => Promise<any>;
      };
    };
  }
}

export {};