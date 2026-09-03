import "dotenv/config";
import OpenAI from "openai";
import {
  ACTION_SCHEMA,
  SYSTEM_INSTRUCTIONS
} from "./schema.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function localNow(timeZone) {
  const formatter = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      dateStyle: "full",
      timeStyle: "long"
    }
  );

  return formatter.format(new Date());
}

export async function interpretMessage({
  sender,
  text,
  history = []
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add it to abide-bridge/.env."
    );
  }

  const timeZone =
    process.env.ABIDE_TIMEZONE ||
    "America/Chicago";

  const payload = {
    sender,
    current_local_datetime:
      localNow(timeZone),
    timezone: timeZone,
    recent_conversation:
      history.slice(-8),
    incoming_message: text
  };

  const response =
    await client.responses.create({
      model:
        process.env.OPENAI_MODEL ||
        "gpt-5.6-luna",

      store: false,

      reasoning: {
        effort: "low"
      },

      instructions:
        SYSTEM_INSTRUCTIONS,

      input:
        JSON.stringify(
          payload,
          null,
          2
        ),

      text: {
        format: {
          type: "json_schema",
          name:
            "abide_message_action",
          strict: true,
          schema:
            ACTION_SCHEMA
        }
      },

      max_output_tokens: 900
    });

  if (!response.output_text) {
    throw new Error(
      "OpenAI returned no structured output."
    );
  }

  return JSON.parse(
    response.output_text
  );
}
