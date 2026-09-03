import "dotenv/config";
import {
  createInterface
} from "node:readline/promises";
import {
  stdin as input,
  stdout as output
} from "node:process";
import {
  interpretMessage
} from "./interpreter.js";
import {
  routeAction
} from "./actionRouter.js";

const rl =
  createInterface({
    input,
    output
  });

const requestedActor =
  String(
    process.argv[2] ||
    ""
  )
    .trim()
    .toLowerCase();

let actor =
  requestedActor ===
  "elizabeth"
    ? "elizabeth"
    : requestedActor ===
      "tyler"
      ? "tyler"
      : "";

if (!actor) {
  const answer =
    await rl.question(
      "Who is texting? (Tyler/Elizabeth): "
    );

  actor =
    answer
      .trim()
      .toLowerCase()
      .startsWith("e")
      ? "elizabeth"
      : "tyler";
}

const history = [];

console.log("");
console.log(
  `Simulating WhatsApp as ${actor}.`
);
console.log(
  'Type "exit" to stop.'
);
console.log("");

while (true) {
  const text =
    await rl.question(
      `${actor}> `
    );

  if (
    text
      .trim()
      .toLowerCase() ===
    "exit"
  ) {
    break;
  }

  if (!text.trim()) {
    continue;
  }

  try {
    const action =
      await interpretMessage({
        sender: actor,
        text:
          text.trim(),
        history
      });

    history.push({
      role: "user",
      text:
        text.trim()
    });

    history.push({
      role: "abide",
      structured:
        action
    });

    const result =
      await routeAction({
        action,
        actor,
        originalMessage:
          text.trim(),
        source:
          "simulator"
      });

    console.log("");
    console.log(
      "STRUCTURED ACTION"
    );
    console.log(
      JSON.stringify(
        action,
        null,
        2
      )
    );
    console.log("");
    console.log(
      `Abide> ${result.reply}`
    );
    console.log("");

    if (
      result.complete
    ) {
      history.length = 0;
    }
  } catch (error) {
    console.error("");
    console.error(
      `ERROR: ${error.message}`
    );
    console.error("");
  }
}

rl.close();
