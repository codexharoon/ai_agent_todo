import { PrismaClient } from "@prisma/client";
import { client, model } from "./lib/openai.js";
import readline from "node:readline/promises";
import {
  createTodo,
  deleteTodoById,
  getAllTodos,
  searchTodos,
  updateTodoById,
} from "./lib/tools.js";

const prisma = new PrismaClient();

const tools = {
  getAllTodos,
  createTodo,
  updateTodoById,
  deleteTodoById,
  searchTodos,
};

const systemPrompt = `
You are an AI to-do list assistant that respond in JSON format and have ability with START, PLAN, ACTION, Observation and Output state.
Wait for the user prompt and first PLAN using available tools. 
After Planning, Take the action with appropriate tools and wait for Observation based on Action. 
Once you get the observations, Return the AI response based on START propmt and observations 

You can manage tasks by adding, viewing, updating, and deleting them. 
You must strictly follow the JSON output format.  

Todo DB Schema: 
 id: String and Primary Key 
 title: String 
 created_at: Date Time 
 updated_at: Date Time 
 
Available Tools: 
 - getAllTodos(): Returns all the Todos from Database 
 - createTodo (input: string): Creates or add a new Todo in the DB and takes input todo as a string and return the id of created todo
 - updateTodoById(id: string, input: string): Updates the todo, use ID and Input to update the todo given in the DB
 - deleteTodoById(id: string): Deleted the todo by ID given in the DB 
 - searchTodos (search: string): Searches for all todos matching the search string 

Your responses MUST be in one of these JSON formats: 

Example: 

{ "type": "user", "user": "Add a task for shopping groceries." } 
{ "type": "plan", "plan": "I will try to get more context on what user needs to shop." } 
{ "type": "output", "output": "Can you tell me what all items you want to shop for?" } 
{ "type": "user", "user": "I want to shop for milk, kurkure, lays and choco." } 
{ "type": "plan", "plan": "I will use createTodo to create a new Todo in DB." } 
{ "type": "action", "function": "createTodo", "input": "Shopping for milk, kurkure, lays and choco." }
{ "type": "observation", "observation": "2" } 
{ "type": "output", "output": "You todo has been added successfully" } 
{ "type": "user", "user": "I want to update the todo that contain milk" } 
{ "type": "plan", "plan": "I will use updateTodoById to update the Todo in DB." } 
{ "type": "action", "function": "updateTodoById", "id":"2", "input": "i have shopped for milk" }
{ "type": "observation", "observation": "2" } 
{ "type": "output", "output": "You todo has been updated successfully" } 
{ "type": "user", "user": "I want to delete the todo that contain milk or i have shopped for milk" } 
{ "type": "plan", "plan": "I will use deleteTodoById to delete the Todo in DB." } 
{ "type": "action", "function": "deleteTodoById", "id":"2" }
{ "type": "observation", "observation": "2" } 
{ "type": "output", "output": "You todo has been deleted successfully" } 

Remember: 
- Always respond in valid JSON
- Always use action for todo related operations
- Keep responses natural but focused on todo information
`;

const messages = [
  {
    role: "system",
    content: systemPrompt,
  },
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ASCII art for application startup
const displayHeader = () => {
  console.log("\n\x1b[36m========================================\x1b[0m");
  console.log("\x1b[1m\x1b[33m       AI TODO LIST ASSISTANT       \x1b[0m");
  console.log("\x1b[36m========================================\x1b[0m");
  console.log("\x1b[32mType your requests (or 'exit' to quit):\x1b[0m\n");
};

// Spinner animation for "thinking" state
const startSpinner = () => {
  const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  process.stdout.write("\x1b[33mThinking ");
  return setInterval(() => {
    process.stdout.write(
      `\r\x1b[33mThinking ${spinnerFrames[i++ % spinnerFrames.length]} \x1b[0m`
    );
  }, 100);
};

// Stop spinner animation
const stopSpinner = (interval) => {
  clearInterval(interval);
  process.stdout.write("\r\x1b[K"); // Clear the line
};

// Format tool errors for better readability
const formatToolError = (error) => {
  if (typeof error === "object" && error.error) {
    return error.error;
  }
  return String(error);
};

async function main() {
    prisma.$connect();
  displayHeader();

  try {
    while (true) {
      const userQuery = await rl.question("\x1b[1m\x1b[34mYou: \x1b[0m");

      if (userQuery.toLowerCase() === "exit") {
        console.log(
          "\n\x1b[32mThank you for using the AI Todo Assistant. Goodbye!\x1b[0m"
        );
        rl.close();
        await prisma.$disconnect();
        process.exit(0);
      }

      // Skip empty inputs
      if (!userQuery.trim()) {
        console.log("\x1b[33mPlease enter a command or question.\x1b[0m");
        continue;
      }

      const userMessage = {
        type: "user",
        user: userQuery.trim(),
      };

      messages.push({
        role: "user",
        content: JSON.stringify(userMessage),
      });

      // Start thinking spinner
      const spinnerInterval = startSpinner();

      try {
        await processUserRequest();
      } catch (error) {
        stopSpinner(spinnerInterval);

        // Add error message to conversation history
        messages.push({
          role: "system",
          content: `Error: ${error.message}. Please try again with a different request.`,
        });
      } finally {
        stopSpinner(spinnerInterval);
      }
    }
  } catch (error) {
    console.error("\n\x1b[31mFatal error:", error.message, "\x1b[0m");
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// Process a single user request through the agent loop
async function processUserRequest() {
  while (true) {
    try {
      const chat = await client.chat.completions.create({
        model: model,
        messages: messages,
        response_format: { type: "json_object" },
      });

      const result = chat.choices[0].message.content;

      messages.push({
        role: "assistant",
        content: result,
      });

      // Parse response
      let action;
      try {
        action = JSON.parse(result);
      } catch (error) {
        messages.push({
          role: "system",
          content:
            "Your last response was not valid JSON. Please respond in the correct JSON format.",
        });
        continue;
      }

      if (action.type === "output") {
        console.log("\x1b[1m\x1b[32m🤖 Assistant: \x1b[0m" + action.output);
        break;
      } 
      else if (action.type === "action") {
        const fn = tools[action.function];
        if (!fn) {
          messages.push({
            role: "system",
            content: `The function ${
              action.function
            } is not available. Available functions are: ${Object.keys(
              tools
            ).join(", ")}`,
          });
          continue;
        }

        try {
          // Check if function requires multiple parameters
          let observation;
          if (
            action.function === "updateTodoById" &&
            action.id &&
            action.input
          ) {
            observation = await fn(action.id, action.input);
          } else {
            observation = await fn(action.input);
          }

          const observationMessage = {
            type: "observation",
            observation,
          };

          messages.push({
            role: "assistant",
            content: JSON.stringify(observationMessage),
          });
        } catch (error) {
          const errorMessage = formatToolError(error);
          messages.push({
            role: "system",
            content: `Error executing ${action.function}: ${errorMessage}`,
          });
        }
      } else {
        messages.push({
          role: "system",
          content: `Unknown action type: ${action.type}. Expected 'output' or 'action'.`,
        });
      }
    } catch (error) {
      console.error("\x1b[31mAPI error:", error.message, "\x1b[0m");
      messages.push({
        role: "system",
        content: `API error occurred: ${error.message}. Let's try a different approach.`,
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
