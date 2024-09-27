import { Query } from "@/lib/query";
import { createClient } from "redis";

const client = createClient(); // todo: move this to singleton
client.on("error", (err) => console.log("Redis Client Error", err)).connect();

export async function POST(request: Request) {
  const { input, page, pageSize } = await request.json();
  const result = await Query.words(input, page, pageSize);
  return Response.json(result);
}
