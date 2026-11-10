const readline = require("readline");
const { CliError } = require("./errors");

/**
 * A minimal line-based prompt. Reading lines through the async iterator keeps
 * input that arrives before a question is asked (e.g. when input is piped).
 * @param {{input: NodeJS.ReadableStream, output: NodeJS.WritableStream}} streams
 */
function createPrompt({ input = process.stdin, output = process.stdout } = {}) {
  const rl = readline.createInterface({ input, terminal: false });
  const lines = rl[Symbol.asyncIterator]();

  async function readAnswer(question) {
    output.write(question);
    const { value, done } = await lines.next();
    if (done) {
      throw new CliError("\nCancelled.");
    }
    return value.trim();
  }

  return {
    /**
     * Ask for free text
     * @param {string} question
     * @param {(answer: string) => string|undefined} [validate] - Returns an error message for invalid answers
     */
    async text(question, validate = () => undefined) {
      for (;;) {
        const answer = await readAnswer(`${question}: `);
        const error = answer ? validate(answer) : "A value is required";
        if (!error) return answer;
        output.write(`  ${error}\n`);
      }
    },

    /**
     * Ask to pick one of several options; Enter picks the first one
     * @param {string} question
     * @param {{value: string, label: string}[]} choices
     */
    async choice(question, choices) {
      output.write(`${question}\n`);
      choices.forEach((choice, index) => {
        output.write(`  ${index + 1}) ${choice.label}${index === 0 ? " (default)" : ""}\n`);
      });

      for (;;) {
        const answer = await readAnswer(`Choose 1-${choices.length}: `);
        if (answer === "") return choices[0].value;

        const index = Number(answer) - 1;
        if (Number.isInteger(index) && choices[index]) return choices[index].value;

        // Also accept the value itself (e.g. "postgres")
        const byValue = choices.find((choice) => choice.value === answer.toLowerCase());
        if (byValue) return byValue.value;

        output.write(`  Please enter a number from 1 to ${choices.length}\n`);
      }
    },

    close() {
      rl.close();
    },
  };
}

module.exports = { createPrompt };
