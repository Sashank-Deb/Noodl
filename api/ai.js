// Vercel Function: POST /api/ai — see _lib/ai-core.js
import { handleAI } from "./_lib/ai-core.js";

export function POST(request) {
  return handleAI(request, process.env);
}

export function OPTIONS(request) {
  return handleAI(request, process.env);
}
