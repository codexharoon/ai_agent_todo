import OpenAI from "openai";

export const client = new OpenAI({
  apiKey: process.env.TOGETHER_API_KEY,
  baseURL: "https://api.together.xyz/v1",
});

export const model = "meta-llama/Llama-3.3-70B-Instruct-Turbo";


// export const client = new OpenAI({
//   apiKey: process.env.GROQ_API_KEY,
//   baseURL: "https://api.groq.com/openai/v1"
// });

// export const model = "llama-3.3-70b-versatile"