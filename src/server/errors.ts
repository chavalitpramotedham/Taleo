import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { StoryRefusal } from "./claude";

export function errorResponse(err: unknown) {
  if (err instanceof StoryRefusal) {
    return NextResponse.json({ error: "Let's try a different idea for this story!" }, { status: 422 });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return NextResponse.json({ error: "The storyteller is very busy. Try again in a moment." }, { status: 429 });
  }
  if (err instanceof Anthropic.AuthenticationError) {
    console.error("Anthropic auth error — check ANTHROPIC_API_KEY");
    return NextResponse.json({ error: "The storyteller isn't set up yet (API key problem)." }, { status: 500 });
  }
  if (err instanceof Anthropic.APIError) {
    console.error("Anthropic API error", err.status, err.message);
    return NextResponse.json({ error: "The storyteller tripped over a word. Please try again." }, { status: 502 });
  }
  console.error(err);
  const message = err instanceof Error ? err.message : "Something went wrong.";
  return NextResponse.json({ error: message }, { status: 500 });
}
