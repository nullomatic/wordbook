import { translateText } from "../controllers/translateController";

export async function POST(request: Request) {
  try {
    const input = await request.text();
    const terms = await translateText(input);
    return Response.json(terms);
  } catch (error) {
    return new Response("Internal server error", { status: 500 });
  }
}
