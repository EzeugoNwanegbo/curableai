import { AI_PRIVACY_INSTRUCTION, type AiTextMessage, type PrivacyFilter } from "./ai-privacy.ts";

interface CompletionBody {
  model: string;
  messages: AiTextMessage[];
  store: false;
  stream: false;
}

interface CompletionClient {
  chat: {
    completions: {
      create: (body: CompletionBody) => PromiseLike<{
        choices: { message: { content: string | null } }[];
      }>;
    };
  };
}

/** The only external model boundary. Apply this for primary and fallback providers. */
export async function requestPrivateCompletion(
  client: CompletionClient,
  model: string,
  messages: readonly AiTextMessage[],
  privacy: PrivacyFilter,
) {
  // Any failure here propagates. Never retry with the unfiltered payload.
  const protectedMessages = privacy.messages(messages);
  const response = await client.chat.completions.create({
    model,
    store: false,
    stream: false,
    messages: [{ role: "system", content: AI_PRIVACY_INSTRUCTION }, ...protectedMessages],
  });
  return privacy.text(response.choices[0]?.message.content || "");
}

/** Provider errors can contain echoed request text or headers. Log only a safe category. */
export function logAiFailure(provider: "openai" | "deepseek", operation: "chat" | "report") {
  console.warn("AI provider unavailable", { provider, operation });
}
