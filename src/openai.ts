import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
