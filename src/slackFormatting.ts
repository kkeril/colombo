import type { CodexResult } from "./types.js";
import { formatElapsed } from "./progress.js";

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  const suffix = "\n\n...truncated; see the local job files for the local final summary.";
  return `${text.slice(0, Math.max(0, maxChars - suffix.length))}${suffix}`;
}

function truncateBodyWithFooter(body: string, footer: string, maxChars: number): string {
  const footerBlock = `\n\n${footer}`;
  const full = `${body}${footerBlock}`;
  if (full.length <= maxChars) {
    return full;
  }

  const suffix = "\n\n...truncated; see the local job files for the local final summary.";
  const availableBodyChars = maxChars - footerBlock.length - suffix.length;
  if (availableBodyChars <= 0) {
    return truncate(footer, maxChars);
  }

  return `${body.slice(0, availableBodyChars)}${suffix}${footerBlock}`;
}

export function formatFinalReply(result: CodexResult, maxChars: number, requesterUserId?: string): string {
  const elapsedMs = Date.parse(result.finishedAt) - Date.parse(result.startedAt);
  const elapsed = Number.isFinite(elapsedMs) ? formatElapsed(elapsedMs) : "unknown";
  const body =
    result.status === "completed" && result.finalMessage.trim().length > 0
      ? result.finalMessage.trim()
      : [
          `*Summary:* Colombo could not complete the investigation (${result.status}).`,
          "*Scope:* Colombo",
          "*Window:* not completed",
          "",
          "*Findings:*",
          result.error ? `- Error: ${result.error}` : "- No final codex summary was produced.",
          `- Elapsed: ${elapsed}.`,
          "",
          "*Suggested next step:*",
          "- Check the Colombo systemd logs on the host.",
          "",
          "*Confidence:* low"
        ].join("\n");
  const footer = [
    `*Job:* \`${result.jobId}\``,
    requesterUserId
      ? `*Feedback:* <@${requesterUserId}> react with :+1: if this met expectations, :thinking_face: if it partly helped, or :poop: if it missed.`
      : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  return truncateBodyWithFooter(body, footer, maxChars);
}
