
import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { roomType, style, budget, requirements } =
      await request.json();

    if (
      typeof roomType !== "string" ||
      typeof style !== "string" ||
      typeof budget !== "string" ||
      typeof requirements !== "string" ||
      !roomType.trim() ||
      !style.trim() ||
      !budget.trim() ||
      !requirements.trim()
    ) {
      return NextResponse.json(
        { error: "Please fill in all fields." },
        { status: 400 }
      );
    }

    if (
      roomType.length > 60 ||
      style.length > 60 ||
      budget.length > 60 ||
      requirements.length > 500
    ) {
      return NextResponse.json(
        { error: "Please keep your inputs within the allowed limits." },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      instructions: `
        You are a professional interior design assistant.
        Suggest practical, attractive room designs.
        Include:
        1. A short design concept
        2. A color palette
        3. Furniture recommendations
        4. Lighting and decor suggestions
        5. A suggested budget breakdown

        Use clear headings and concise bullet points.
        Respect the user's budget and requirements.
        If exact prices are unknown, label estimates clearly.
      `,
      input: `
        Room type: ${roomType}
        Design style: ${style}
        Budget: ${budget}
        Requirements: ${requirements}
      `,
      max_output_tokens: 700,
    });

    return NextResponse.json({
      result: response.output_text,
    });
  } catch (error) {
    console.error("Room design API error:", error);

    return NextResponse.json(
      {
        error: "Unable to generate your design. Please try again.",
      },
      { status: 500 }
    );
  }
}
