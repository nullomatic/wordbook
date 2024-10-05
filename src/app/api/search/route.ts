import { Query } from "@/lib/query";

export async function POST(request: Request) {
  try {
    const input = await request.text();
    const results = await Query.search(input);
    return Response.json(results);
  } catch (error) {
    return new Response("Internal server error", { status: 500 });
  }
}
