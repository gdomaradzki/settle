import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  DocumentBlockParam,
  TextBlockParam,
} from "@anthropic-ai/sdk/resources/messages/messages";
import { invoiceExtractionSchema, type InvoiceExtraction } from "../schemas";
import { getCannedExtraction } from "../lib/canned-extractions";

const EXTRACTION_PROMPT = `You are extracting structured data from an invoice PDF.

Return ONLY a JSON object, no preamble or markdown. The object MUST match this schema:

{
  "vendorName": string,
  "invoiceNumber": string | null,
  "amountCents": number,
  "issueDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "lineItems": [
    { "description": string, "amountCents": number, "type": "EXPENSE" | "ITEM" }
  ]
}

Conventions:
- All amounts are in USD cents. $12.50 → 1250.
- If no due date is printed, assume 30 days after the issue date.
- Use "EXPENSE" for services and operational costs; "ITEM" only for physical inventory.
- If the invoice has no explicit line items, create a single line item for the total amount.`;

function extractJsonBlock(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text.trim();
}

export async function extractInvoiceData(
  pdfBase64: string,
  filename: string,
): Promise<InvoiceExtraction> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const canned = getCannedExtraction(filename);
    console.log("[extract-invoice-data] no API key, using canned extraction:", canned);
    return canned;
  }

  try {
    const client = new Anthropic({ apiKey: key });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            } satisfies DocumentBlockParam,
            { type: "text", text: EXTRACTION_PROMPT } satisfies TextBlockParam,
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const json = extractJsonBlock(text);
    const extraction = invoiceExtractionSchema.parse(JSON.parse(json));
    console.log("[extract-invoice-data] parsed extraction:", extraction);
    return extraction;
  } catch (err) {
    console.error("[extract-invoice-data] extraction failed, using canned data:", err);
    const canned = getCannedExtraction(filename);
    console.log("[extract-invoice-data] canned extraction:", canned);
    return canned;
  }
}
