import express from "express";
import { tavily } from "@tavily/core";
import dotenv from "dotenv";

dotenv.config();

const client = tavily({ apiKey: process.env.TAVILY_API_KEY });


const app = express();

app.use(express.json());

app.post("/perplexity_ask", async (req, res) => {
    // get the query from the user
    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ error: "Query is required" });
    }

    // (TODO) make sure user has access to 

    // (TODO) check if we have web search indexed for a similar query

    // web search to gather resources
    const webSearchResponse = await client.search(query, {
        searchDepth: "advanced",
    });

    const webSearchResult = webSearchResponse.results;

    // do some context engineering on the prompt + web search response

    // hit the LLM and stream back the response

    // aslo stream back the sources and follow up questions (which we can get from parallel llm call)

    // close the event stream
});

app.listen(3000, () => console.log("Server is running on port 3000"));