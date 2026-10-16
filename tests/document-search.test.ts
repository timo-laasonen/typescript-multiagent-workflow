import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, createEmbeddingMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  createEmbeddingMock: vi.fn(),
}));

vi.mock("../src/db/pool.js", () => ({ pool: { query: queryMock } }));
vi.mock("../src/services/embeddings.js", () => ({
  createEmbedding: createEmbeddingMock,
}));

import { searchDocuments } from "../src/services/document-search.js";

describe("searchDocuments", () => {
  beforeEach(() => {
    queryMock.mockReset();
    createEmbeddingMock.mockReset();
    createEmbeddingMock.mockResolvedValue([0.1, 0.2, 0.3]);
    queryMock.mockResolvedValue({ rows: [] });
  });

  it("hylkää tyhjän kysymyksen ennen tietokantahakua", async () => {
    await expect(searchDocuments("tenant-1", "   ")).rejects.toThrow(
      "Tenant and query are required",
    );

    expect(createEmbeddingMock).not.toHaveBeenCalled();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("välittää tenant-rajauksen SQL-kyselylle", async () => {
    await searchDocuments("tenant-42", "lomaohje");

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("WHERE tenant_id = $2");
    expect(params[0]).toBe("[0.1,0.2,0.3]");
    expect(params[1]).toBe("tenant-42");
  });

  it.each([
    [50, 10],
    [10, 10],
    [3, 3],
    [0, 1],
    [-5, 1],
  ])("rajaa limitin %i arvoon %i", async (limit, expected) => {
    await searchDocuments("tenant-1", "kysymys", limit);

    expect(queryMock.mock.calls[0][1][2]).toBe(expected);
  });

  it("käyttää oletuksena viiden tuloksen rajaa", async () => {
    await searchDocuments("tenant-1", "kysymys");

    expect(queryMock.mock.calls[0][1][2]).toBe(5);
  });

  it("välittää tietokantavirheen kutsujalle", async () => {
    queryMock.mockRejectedValue(new Error("connection refused"));

    await expect(searchDocuments("tenant-1", "kysymys")).rejects.toThrow(
      "connection refused",
    );
  });

  it("säilyttää tuloksen lähteen ja sisällön", async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          title: "Lomaohje",
          source_uri: "https://example.com/lomaohje",
          content: "Vuosiloma on 25 päivää.",
          similarity: "0.87",
        },
      ],
    });

    const hits = await searchDocuments("tenant-1", "vuosiloma");

    expect(hits).toEqual([
      {
        title: "Lomaohje",
        sourceUri: "https://example.com/lomaohje",
        content: "Vuosiloma on 25 päivää.",
        similarity: 0.87,
      },
    ]);
  });
});
