import { BACKEND_URL } from "@/env";

export interface StreamResponse {
  text: string;
  conversationId?: string;
  messageId?: string;
  sources?: { url: string }[];
  followUps?: string[];
}

export async function askSven(
  query: string,
  jwt: string,
  conversationId: string | undefined,
  onUpdate: (data: StreamResponse) => void
) {
  const endpoint = conversationId ? `${BACKEND_URL}/sven_ask/follow_up` : `${BACKEND_URL}/sven_ask`;
  const body = conversationId ? { query, conversationId } : { query };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: jwt,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    throw new Error("Failed to fetch response from Sven");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let done = false;
  let fullRawText = "";

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      fullRawText += decoder.decode(value, { stream: !done });
      
      let parsedConversationId = conversationId;
      let parsedMessageId;
      let parsedSources;
      let parsedText = "";
      let parsedFollowUps: string[] = [];

      // extract CONVERSATION_ID
      const convMatch = fullRawText.match(/<CONVERSATION_ID>(.*?)<\/CONVERSATION_ID>/);
      if (convMatch && convMatch[1]) {
        parsedConversationId = convMatch[1];
      }

      // extract MESSAGE_ID
      const msgMatch = fullRawText.match(/<MESSAGE_ID>(.*?)<\/MESSAGE_ID>/);
      if (msgMatch && msgMatch[1]) {
        parsedMessageId = msgMatch[1];
      }

      // extract SOURCES
      const sourcesMatch = fullRawText.match(/<SOURCES>([\s\S]*?)<\/SOURCES>/);
      if (sourcesMatch && sourcesMatch[1]) {
        try {
          parsedSources = JSON.parse(sourcesMatch[1]);
        } catch (e) {
          // ignore parsing error if incomplete
        }
      }

      // extract ANSWER (fallback to entire raw string without tags if <ANSWER> not found)
      const answerMatch = fullRawText.match(/<ANSWER>([\s\S]*?)(?:<\/ANSWER>|$)/);
      if (answerMatch && answerMatch[1]) {
        parsedText = answerMatch[1].trim();
      } else {
        // fallback cleanup if the LLM didn't output <ANSWER> tags correctly
        let fallbackText = fullRawText
          .replace(/<CONVERSATION_ID>[\s\S]*?<\/CONVERSATION_ID>/g, "")
          .replace(/<MESSAGE_ID>[\s\S]*?<\/MESSAGE_ID>/g, "")
          .replace(/<SOURCES>[\s\S]*?(?:<\/SOURCES>|$)/g, "")
          .replace(/<FOLLOW_UPS>[\s\S]*?(?:<\/FOLLOW_UPS>|$)/g, "")
          .replace(/<ANSWER>/g, "")
          .replace(/<\/ANSWER>/g, "");
        parsedText = fallbackText.trim();
      }

      // extract FOLLOW_UPS
      const followUpsMatch = fullRawText.match(/<FOLLOW_UPS>([\s\S]*?)(?:<\/FOLLOW_UPS>|$)/);
      if (followUpsMatch && followUpsMatch[1]) {
        const questionsStr = followUpsMatch[1];
        const questionMatches = [...questionsStr.matchAll(/<question>([\s\S]*?)(?:<\/question>|$)/g)];
        parsedFollowUps = questionMatches.map(m => m[1] ? m[1].trim() : "").filter(Boolean);
      }

      onUpdate({
        text: parsedText,
        conversationId: parsedConversationId,
        messageId: parsedMessageId,
        sources: parsedSources,
        followUps: parsedFollowUps.length > 0 ? parsedFollowUps : undefined
      });
    }
  }
}
