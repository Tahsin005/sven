import express from "express";
import { tavily } from "@tavily/core";
import OpenAI from "openai";
import dotenv from "dotenv";
import askLLMStream from "./llm";
import { PROMPT_TEMPLATE } from "./prompt";

dotenv.config();

const webSearchClient = tavily({ apiKey: process.env.TAVILY_API_KEY });

const llmClient = new OpenAI({
    baseURL: process.env.AI_GATEWAY_BASE_URL!,
    apiKey: process.env.AI_GATEWAY_API_KEY,
});

const app = express();

app.use(express.json());

app.post("/signup", async(req, res) => {

});

app.post("/signin", async(req, res) => {

});

app.get("/conversations", async(req, res) => {

});

app.get("/conversations/:conversationId", async(req, res) => {

});

app.post("/sven_ask", async (req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    
    // get the query from the user
    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ error: "Query is required" });
    }

    // (TODO) make sure user has access to 

    // (TODO) check if we have web search indexed for a similar query

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

    if (llmResponse.success && llmResponse.stream) {
        for await (const chunk of llmResponse.stream) {
            const token = chunk.choices?.[0]?.delta?.content;
            if (token) res.write(token);
        }
    }

    
    // aslo stream back the sources and follow up questions (which we can get from parallel llm call)
    res.write("\n<SOURCES>\n");
    res.write(JSON.stringify(webSearchResult.map(result => ({
        url: result.url
    }))));
    res.write("\n</SOURCES>\n");

    // close the event stream
    res.end();
});

app.post("/sven_ask/follow_up", async (req, res) => {
    // get the existing chat from db

    // forward the history to the llm

    // (TODO) - context engineering here

    // stream the response to the user
});

app.listen(3000, () => console.log("Server is running on port 3000"));