
import OpenAI from "openai";

// This is a working baseline for a small dataset. In production, compute embeddings in batches 
// and make network calls outside the database transaction: 
// a long transaction keeps the database connection occupied for the duration of the model service calls. 
// In a larger system, use a separate queued indexing job, document versioning, and synchronization of deleted sources.
// Privacy: Before indexing, check whether the content of the document can be sent to the model service you have chosen. 
// If not, you will need an approved private model service or a locally run embedding model.


// An embedding is a numerical vector computed from text, which can be used to search for content that is similar in meaning.

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("OPENAI_API_KEY missing");
}

const client = new OpenAI({ apiKey });

const model =
  process.env.OPENAI_EMBEDDING_MODEL ??
  "text-embedding-3-small";

export async function createEmbedding(
  text: string,
): Promise<number[]> {
  const input = text.trim();

  if (!input || input.length > 20000) {
    throw new Error("Not valid embedding input");
  }

  const response = await client.embeddings.create({
    model,
    input,
    encoding_format: "float",
  });

  const vector = response.data[0]?.embedding;

  if (
    !vector ||
    vector.length !== 1536 ||
    !vector.every(Number.isFinite)
  ) {
    throw new Error("Embedding format is not valid");
  }

  return vector;
}
