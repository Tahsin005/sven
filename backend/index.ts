import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import { tavily } from "@tavily/core";
import OpenAI from "openai";
import askLLMStream from "./llm";
import { PROMPT_TEMPLATE, SYSTEM_PROMPT } from "./prompt";
import { middleware, type CustomRequest } from "./middleware";
import { prisma } from "./db";
dotenv.config();

const webSearchClient = tavily({ apiKey: process.env.TAVILY_API_KEY });

const llmClient = new OpenAI({
    baseURL: process.env.AI_GATEWAY_BASE_URL!,
    apiKey: process.env.AI_GATEWAY_API_KEY,
});

const app = express();

app.use(cors({
    origin: "http://localhost:3000"
}));
app.use(express.json());

app.get("/conversations", middleware, async(req: CustomRequest, res) => {
    try {
        const conversations = await prisma.conversation.findMany({
            where: {
                userId: req.userId
            },
            include: {
                messages: true
            }
        });
        res.json(conversations);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch conversations" });
    }
});

app.get("/conversations/:conversationId", middleware, async(req: CustomRequest, res) => {
    try {
        const conversationId = req.params.conversationId as string;
        if (!conversationId) {
            return res.status(400).json({ error: "Conversation ID is required" });
        }
        const conversation = await prisma.conversation.findUnique({
            where: {
                id: conversationId
            },
            include: {
                messages: {
                    orderBy: {
                        createdAt: 'asc'
                    }
                }
            }
        });

        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        if (conversation.userId !== req.userId) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        res.json(conversation);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch conversation" });
    }
});

app.post("/sven_ask", middleware, async (req: CustomRequest, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    
    // get the query from the user
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

        // web search to gather resources
        const webSearchResponse = await webSearchClient.search(query, {
            searchDepth: "advanced",
        });

        const webSearchResult = webSearchResponse.results;

        // do some context engineering on the prompt + web search response
        const prompt = PROMPT_TEMPLATE
        .replace("{{WEB_SEARCH_RESULTS}}", JSON.stringify(webSearchResult))
        .replace("{{USER_QUERY}}", query);

        // hit the LLM and stream back the response
        const llmResponse = await askLLMStream(
            prompt,
            llmClient,
            process.env.AI_GATEWAY_MODEL!,
        );

        res.write(`<CONVERSATION_ID>${conversation.id}</CONVERSATION_ID>\n`);

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
        
        // aslo stream back the sources and follow up questions (which we can get from parallel llm call)
        res.write("\n<SOURCES>\n");
        res.write(JSON.stringify(webSearchResult.map(result => ({
            url: result.url
        }))));
        res.write("\n</SOURCES>\n");

        await prisma.message.create({
            data: {
                content: assistantContent,
                role: "assistant",
                conversationId: conversation.id
            }
        });

        // close the event stream
        res.end();
    } catch (e) {
        console.error(e);
        res.write("\nAn error occurred.");
        res.end();
    }
});

app.post("/sven_ask/follow_up", middleware, async (req: CustomRequest, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    const { query, conversationId } = req.body;
    if (!query || !conversationId) {
        return res.status(400).json({ error: "Query and conversationId are required" });
    }

    try {
        // get the existing chat from db
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

        // Add user's new message to DB
        await prisma.message.create({
            data: {
                content: query,
                role: "user",
                conversationId
            }
        });

        // web search for follow up
        const webSearchResponse = await webSearchClient.search(query, {
            searchDepth: "advanced",
        });
        const webSearchResult = webSearchResponse.results;

        // context engineering
        const prompt = PROMPT_TEMPLATE
        .replace("{{WEB_SEARCH_RESULTS}}", JSON.stringify(webSearchResult))
        .replace("{{USER_QUERY}}", query);

        // forward the history to the llm
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

        // Save assistant message
        await prisma.message.create({
            data: {
                content: assistantContent,
                role: "assistant",
                conversationId
            }
        });

        // stream the response to the user
        res.end();
    } catch (e) {
        console.error(e);
        res.write("\nAn error occurred.");
        res.end();
    }
});

app.listen(5000, () => console.log("Server is running on port 5000"));