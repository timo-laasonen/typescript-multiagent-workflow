
import { describe, expect, it, vi } from "vitest";

// pool.ts heittää virheen ilman DATABASE_URL-arvoa, joten se mockataan.
vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/services/embeddings.js", () => ({ createEmbedding: vi.fn() }));

import { splitText } from "../src/services/document-indexer.js";

describe("splitText", () => {
  it("palauttaa tyhjästä tekstistä tyhjän listan", () => {
    expect(splitText("   ")).toEqual([]);
  });

  it("jakaa pitkän tekstin osiin", () => {
    const chunks = splitText("a".repeat(7000), 3000, 300);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(3000);
    expect(chunks[1]).toHaveLength(3000);
    expect(chunks[2]).toHaveLength(1600);
  });

  it("hylkää virheellisen overlap-asetuksen", () => {
    expect(() => splitText("testi", 100, 100)).toThrow();
  });
});
