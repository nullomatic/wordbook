import { POS } from "@/lib/constants";
import { translateText } from "../controllers/translateController";
import { logger } from "@/lib/util";

export async function POST(request: Request) {
  try {
    const { input, options } = await request.json();
    validateInput(input);
    validateOptions(options);
    const terms = await translateText(input, options);
    return Response.json(terms);
  } catch (error) {
    logger.error(error);
    return new Response("Internal server error", { status: 500 });
  }
}

function validateInput(input: unknown) {
  if (typeof input !== "string") {
    throw new Error("Invalid input");
  }
}

function validateOptions(options: unknown) {
  if (!Array.isArray(options)) {
    throw new Error("Invalid options");
  }
  for (const option of options) {
    if (Object.hasOwn(POS, option)) {
      throw new Error(`Invalid POS '${option}'`);
    }
  }
}
