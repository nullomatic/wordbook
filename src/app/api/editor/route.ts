import { Query } from "@/lib/query";

export async function POST(request: Request) {
  try {
    const { input, page, pageSize } = await request.json();
    const result = await Query.words(input, page, pageSize);
    return Response.json(result);
  } catch (error) {
    return new Response("Internal server error", { status: 500 });
  }
}
