
// import { GoogleGenAI } from "@google/genai";
// import { NextResponse } from "next/server";

// const apiKey = process.env.GEMINI_API_KEY;

// export async function POST(request: Request) {
//     try {
//         if (!apiKey) {
//             return NextResponse.json(
//                 { error: "Gemini API key is not configured." },
//                 { status: 500 }
//             );
//         }

//         const {
//             roomType,
//             style,
//             budget,
//             requirements,
//         } = await request.json();

//         if (
//             typeof roomType !== "string" ||
//             typeof style !== "string" ||
//             typeof budget !== "string" ||
//             typeof requirements !== "string" ||
//             !roomType.trim() ||
//             !style.trim() ||
//             !budget.trim() ||
//             !requirements.trim()
//         ) {
//             return NextResponse.json(
//                 { error: "Please fill in all fields." },
//                 { status: 400 }
//             );
//         }

//         if (
//             roomType.length > 60 ||
//             style.length > 60 ||
//             budget.length > 60 ||
//             requirements.length > 500
//         ) {
//             return NextResponse.json(
//                 { error: "Please keep your inputs within the allowed limits." },
//                 { status: 400 }
//             );
//         }

//         const ai = new GoogleGenAI({ apiKey });

//         const response = await ai.models.generateContent({
//             model: "gemini-3.8-flash",
//             contents: `
//             You are a professional interior design assistant.

//             Create practical room design recommendations.

//             Room type: ${roomType}
//             Design style: ${style}
//             Budget: ${budget}
//             Requirements: ${requirements}

//             Include:
//             1. Design concept
//             2. Color palette
//             3. Furniture recommendations
//             4. Lighting and decor
//             5. Estimated budget breakdown

//             Use clear headings and concise bullet points.
//             Respect the user's budget.
//             Label uncertain prices as estimates.
//           `,
//         });


//         return NextResponse.json({
//             result: response.text || "No recommendations were returned.",
//         });
//     } catch (error) {
//         console.error("Gemini API error:", error);

//         return NextResponse.json(
//             {
//                 error: "Unable to generate your design. Please try again.",
//             },
//             { status: 500 }
//         );
//     }
// }



import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
];

export async function POST(request: Request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: "Gemini API key is not configured." },
                { status: 500 }
            );
        }

        const formData = await request.formData();

        const roomType = formData.get("roomType");
        const style = formData.get("style");
        const budget = formData.get("budget");
        const requirements = formData.get("requirements");
        const image = formData.get("image");

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
                { error: "Please complete all design fields." },
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
                { error: "One or more fields exceed the allowed length." },
                { status: 400 }
            );
        }

        if (!(image instanceof File) || image.size === 0) {
            return NextResponse.json(
                { error: "Please upload a room photo." },
                { status: 400 }
            );
        }

        if (!allowedTypes.includes(image.type)) {
            return NextResponse.json(
                { error: "Upload a JPG, PNG, or WebP image." },
                { status: 400 }
            );
        }

        if (image.size > MAX_IMAGE_SIZE) {
            return NextResponse.json(
                { error: "Image size must be 5 MB or less." },
                { status: 400 }
            );
        }

        const bytes = await image.arrayBuffer();
        const base64Image = Buffer.from(bytes).toString("base64");

        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [
                {
                    inlineData: {
                        mimeType: image.type,
                        data: base64Image,
                    },
                },
                {
                    text: `
            You are a professional interior design assistant.

            Analyze the uploaded room photo and recommend
            practical improvements based on what is visible.

            Room type: ${roomType}
            Design style: ${style}
            Budget: ${budget}
            Requirements: ${requirements}

            Return these sections:
            1. Current room observations
            2. Design concept
            3. Recommended color palette
            4. Furniture and layout suggestions
            5. Lighting and decor improvements
            6. Estimated budget breakdown

            Respect the user's budget. Label uncertain prices
            as estimates. Do not claim to see objects that
            are not clearly visible in the image.
          `,
                },
            ],
        });

        return NextResponse.json({
            result: response.text || "No recommendations were returned.",
        });
    } catch (error) {
        console.error("Gemini room analysis error:", error);

        return NextResponse.json(
            {
                error:
                    "Unable to analyze your room right now. Please try again.",
            },
            { status: 500 }
        );
    }
}
