// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// Gym information for the AI to reference
const GYM_CONTEXT = `
You are a helpful gym assistant for GymSchedPro. Here's the information about our gym:

Hours:
Monday-Sunday: 6:00 AM - 10:00 PM,

Membership Pricing:
Monthly membership: ₱1,200₱ (Student: 1000₱),
Annual membership: ₱10,400 (save 2 months!),
Walk-in/Day pass: ₱100 per day (Student: ₱80 ),

Student Discount:
Students get 20% off with valid student ID,
Student monthly rate: ₱1,000,

Classes Offered:
We offer daily classes including:
Yoga,
Boxing,
Pilates,
Zumba,
CrossFit,

Certified Coaches:
Personal training - Grey (Women)
Personal training - Anjo (Men)

Amenities:
Locker rooms,
24/7 security and CCTV monitoring,

Personal Training:
Single session: ₱350,
Package of 10 sessions: ₱3'500,
Customized workout plans included,

Gym Rules:
Always wipe down equipment after use,
Wear proper athletic attire and closed-toe shoes,
No dropping weights,
Respect other members and maintain gym etiquette,
No outside food or drinks (except water bottles),
Have fun and stay motivated!,

Location & Contact:
Address: Mabini St. Poblacion, Barangay city, Batangas,
Phone: 09496208191,
Email: apfgym@gmail.com,

Parking:
FREE parking for all members and guests,
Well-lit parking lot monitored 24/7,

Additional Services:
Nutritional counseling available,
Body composition analysis,
Fitness assessments,
Group training sessions,
Special events and challenges,

Always be friendly, helpful, and encouraging. Use Filipino pesos (₱) when mentioning prices. Keep responses concise but informative
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 }
      );
    }

    const lastMessage = messages[messages.length - 1];

    if (!lastMessage || lastMessage.role !== "user") {
      return NextResponse.json(
        { error: "Last message must be from user" },
        { status: 400 }
      );
    }

    // Prepare messages for Groq API
    const groqMessages = [
      {
        role: "system",
        content: GYM_CONTEXT,
      },
      ...messages.map((msg: Message) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    // Call Groq API
    const completion = await groq.chat.completions.create({
      messages: groqMessages as GroqMessage[],
      model: "llama-3.3-70b-versatile", // Fast and efficient model
      temperature: 0.7,
      max_tokens: 500,
      top_p: 1,
      stream: false,
    });

    const responseMessage =
      completion.choices[0]?.message?.content ||
      "I'm sorry, I couldn't process that. Could you please rephrase your question?";

    return NextResponse.json({
      message: responseMessage,
    });
  } catch (error) {
    console.error("Chat API error:", error);

    // Handle specific Groq API errors
    if (error && typeof error === "object" && "status" in error) {
      if (error.status === 401) {
        return NextResponse.json({ error: "Invalid API key" }, { status: 500 });
      }

      if (error.status === 429) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: "Sorry, I encountered an error. Please try again." },
      { status: 500 }
    );
  }
}
