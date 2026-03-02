import type { AgentPlan } from "@/app/chat/_components/agent/agent-types";

export function buildAgentModeSystemPrompt(plan: AgentPlan | null): string {
  const lines: string[] = [];

  lines.push("<agent_mode>");
  lines.push("You are in AGENT MODE with planning, file, and shell tools.");
  lines.push("Use exact snake_case tool names and exact argument keys.");
  lines.push("Never invent tool names (for example, do not use title-cased names like 'Create Plan').");
  lines.push("");
  lines.push("## Workflow");
  lines.push("1. If NO <current_plan> exists: call create_plan ONCE with 3-8 steps.");
  lines.push("2. Before doing work on a step, call update_plan({ action: 'status', step_index: N, status: 'running' }).");
  lines.push("3. Execute the step with tools.");
  lines.push("4. Mark the step complete immediately with update_plan({ action: 'complete', step_index: N }).");
  lines.push("5. Continue until all steps are done, then summarize results.");
  lines.push("");
  lines.push("## Tool Contracts (exact names + keys)");
  lines.push("- create_plan({ tasks: [{ title: 'Research X' }, { title: 'Write report' }] })");
  lines.push("- update_plan({ action, step_index?, title?, status?, notes? })");
  lines.push("- list_files({ path?, recursive? })");
  lines.push("- read_file({ path })");
  lines.push("- write_file({ path, content })");
  lines.push("- delete_file({ path })");
  lines.push("- make_directory({ path })");
  lines.push("- move_file({ from, to })");
  lines.push("- execute_command({ command, cwd?, timeout? })");
  lines.push("  - execute_command also accepts { cmd } as a command alias.");
  lines.push("  - timeout is seconds.");
  lines.push("");
  lines.push("## Rules");
  lines.push("- Do NOT loop on plan creation. Create plan ONCE.");
  lines.push("- Do NOT describe what you could do — just DO IT with tools.");
  lines.push("- Always keep exactly one active step marked as status='running' until it is complete.");
  lines.push("- Mark each step complete IMMEDIATELY after finishing it.");
  lines.push("- Use relative workspace paths unless a tool explicitly requires absolute paths.");
  lines.push("- write_file creates parent directories automatically. Only call make_directory when you need an empty directory.");
  lines.push("- Prefer editing existing files over creating new ones. If you need to revise, read_file then write_file to the same path.");

  if (plan?.steps?.length) {
    const steps = plan.steps;
    const doneCount = steps.filter((s) => s.status === "done").length;
    const currentIdx = steps.findIndex((s) => s.status !== "done");
    const planLines = steps.map((s, i) => {
      const marker = s.status === "done" ? "[x]" : i === currentIdx ? "[>]" : s.status === "blocked" ? "[!]" : "[ ]";
      return `  ${marker} ${i}: ${s.title}`;
    });

    lines.push("");
    lines.push("<current_plan>");
    lines.push(`Progress: ${doneCount}/${steps.length}`);
    lines.push(...planLines);
    if (currentIdx >= 0) lines.push(`Current step: ${currentIdx} — ${steps[currentIdx].title}`);
    else lines.push("All steps complete. Provide final summary.");
    lines.push("</current_plan>");
  }

  lines.push("</agent_mode>");
  return lines.join("\n");
}
