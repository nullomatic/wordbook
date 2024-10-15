import { MAX_TRANSLATION_LENGTH, POS } from "@/lib/constants";
import { translateText } from "../controllers/translateController";
import { logger } from "@/lib/util";

export async function POST(request: Request) {
  try {
    const { input, options } = await request.json();
    validateTranslationInput(input);
    validateTranslationOptions(options);
    const terms = await translateText(input, options);
    return Response.json(terms);
  } catch (error) {
    logger.error(error);
    return new Response("Internal server error", { status: 500 });
  }
}

function validateTranslationInput(input: unknown) {
  if (typeof input !== "string") {
    throw new Error("Invalid input");
  }
  if (input.length > MAX_TRANSLATION_LENGTH) {
    throw new Error(
      `Translation input length must be less than ${MAX_TRANSLATION_LENGTH}`,
    );
  }
}

function validateTranslationOptions(options: unknown) {
  if (!Array.isArray(options)) {
    throw new Error("Invalid options");
  }
  for (const option of options) {
    if (Object.hasOwn(POS, option)) {
      throw new Error(`Invalid POS '${option}'`);
    }
  }
}
