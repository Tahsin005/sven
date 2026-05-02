import { Router } from "express";
import crypto from "crypto";
import OpenAI from "openai";
import { tavily } from "@tavily/core";
import { prisma } from "../db";
import askLLMStream from "../llm";
import { PROMPT_TEMPLATE, SYSTEM_PROMPT } from "../prompt";
import { middleware, type CustomRequest } from "../middleware";

const router = Router();

const webSearchClient = tavily({ apiKey: process.env.TAVILY_API_KEY });

const llmClient = new OpenAI({
    baseURL: process.env.AI_GATEWAY_BASE_URL!,
    apiKey: process.env.AI_GATEWAY_API_KEY,
});

// POST /sven_ask — start a new conversation with a web-augmented LLM response
router.post("/", middleware, async (req: CustomRequest, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ error: "Query is required" });
    }

    try {
        const conversation = await prisma.conversation.create({
            data: {
                userId: req.userId!,
                title: query.substring(0, 50),
                slug: crypto.randomUUID(),
                messages: {
                    create: {
                        content: query,
                        role: "user"
                    }
                }
            }
        });

        // Web search to gather context
        const webSearchResponse = await webSearchClient.search(query, {
            searchDepth: "advanced",
        });
        const webSearchResult = webSearchResponse.results;

        const pendingMessage = await prisma.message.create({
            data: {
                content: "",
                role: "assistant",
                conversationId: conversation.id,
                status: "PENDING",
                sources: webSearchResult
            }
        });

        // Build prompt with web search context
        const prompt = PROMPT_TEMPLATE
            .replace("{{WEB_SEARCH_RESULTS}}", JSON.stringify(webSearchResult))
            .replace("{{USER_QUERY}}", query);

        // Stream LLM response
        const llmResponse = await askLLMStream(
            prompt,
            llmClient,
            process.env.AI_GATEWAY_MODEL!,
        );

        res.write(`<CONVERSATION_ID>${conversation.id}</CONVERSATION_ID>\n`);
        res.write(`<MESSAGE_ID>${pendingMessage.id}</MESSAGE_ID>\n`);

        let assistantContent = "";
        if (llmResponse.success && llmResponse.stream) {
            for await (const chunk of llmResponse.stream) {
                const token = chunk.choices?.[0]?.delta?.content;
                if (token) {
                    assistantContent += token;
                    res.write(token);
                }
            }
        }

        res.write("\n<SOURCES>\n");
        res.write(JSON.stringify(webSearchResult.map(result => ({
            url: result.url
        }))));
        res.write("\n</SOURCES>\n");

        await prisma.message.update({
            where: { id: pendingMessage.id },
            data: {
                content: assistantContent,
                status: "COMPLETED"
            }
        });

        res.end();
    } catch (e) {
        console.error(e);
        res.write("\nAn error occurred.");
        res.end();
    }
});

// POST /sven_ask/follow_up — continue an existing conversation
router.post("/follow_up", middleware, async (req: CustomRequest, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    const { query, conversationId } = req.body;
    if (!query || !conversationId) {
        return res.status(400).json({ error: "Query and conversationId are required" });
    }

    try {
        // Fetch existing conversation with history
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { messages: { orderBy: { createdAt: 'asc' } } }
        });

        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        if (conversation.userId !== req.userId) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        // Persist the user's follow-up message
        await prisma.message.create({
            data: {
                content: query,
                role: "user",
                conversationId
            }
        });

        // Web search for follow-up context
        const webSearchResponse = await webSearchClient.search(query, {
            searchDepth: "advanced",
        });
        const webSearchResult = webSearchResponse.results;

        const pendingMessage = await prisma.message.create({
            data: {
                content: "",
                role: "assistant",
                conversationId,
                status: "PENDING",
                sources: webSearchResult
            }
        });

        // Build prompt with web context
        const prompt = PROMPT_TEMPLATE
            .replace("{{WEB_SEARCH_RESULTS}}", JSON.stringify(webSearchResult))
            .replace("{{USER_QUERY}}", query);

        // Build full message history for the LLM
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: "system", content: SYSTEM_PROMPT },
            ...conversation.messages.map(msg => ({
                role: msg.role,
                content: msg.content
            } as OpenAI.Chat.Completions.ChatCompletionMessageParam)),
            { role: "user", content: prompt }
        ];

        const stream = await llmClient.chat.completions.create({
            model: process.env.AI_GATEWAY_MODEL!,
            stream: true,
            messages
        });

        res.write(`<MESSAGE_ID>${pendingMessage.id}</MESSAGE_ID>\n`);

        let assistantContent = "";
        for await (const chunk of stream) {
            const token = chunk.choices?.[0]?.delta?.content;
            if (token) {
                assistantContent += token;
                res.write(token);
            }
        }

        res.write("\n<SOURCES>\n");
        res.write(JSON.stringify(webSearchResult.map(result => ({
            url: result.url
        }))));
        res.write("\n</SOURCES>\n");

        // Persist completed assistant message
        await prisma.message.update({
            where: { id: pendingMessage.id },
            data: {
                content: assistantContent,
                status: "COMPLETED"
            }
        });

        res.end();
    } catch (e) {
        console.error(e);
        res.write("\nAn error occurred.");
        res.end();
    }
});

export default router;
