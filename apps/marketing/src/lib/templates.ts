import type { TemplateId } from "./site";

/**
 * Marketing copy of the starter templates. Structure mirrors the web app's
 * template set (ids must match what /app/?template=<id> understands).
 */
export interface TreeNode {
  text: string;
  children?: TreeNode[];
}

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  summary: string;
  goodFor: string;
  tree: TreeNode;
}

const kids = (...t: (string | TreeNode)[]): TreeNode[] =>
  t.map((x) => (typeof x === "string" ? { text: x } : x));

export const TEMPLATES: TemplateInfo[] = [
  {
    id: "blank",
    name: "Blank",
    summary: "One central topic and an empty canvas.",
    goodFor: "When you already know the shape of the idea and just want to type.",
    tree: { text: "Central topic" },
  },
  {
    id: "project",
    name: "Project plan",
    summary: "Goals, scope, timeline, risks and owners.",
    goodFor: "Kick-offs, side projects and anything with a deadline and more than one person.",
    tree: {
      text: "Project plan",
      children: kids(
        { text: "Goals", children: kids("Outcome we want", "How we'll measure it") },
        { text: "Scope", children: kids("In scope", "Out of scope") },
        { text: "Timeline", children: kids("Milestone 1", "Milestone 2", "Launch") },
        { text: "Risks", children: kids("Risk", "Mitigation") },
        { text: "Team", children: kids("Owner", "Contributors") },
      ),
    },
  },
  {
    id: "lecture",
    name: "Lecture notes",
    summary: "Key concepts, examples and questions to review.",
    goodFor: "Taking notes in class, then revising them as a map before an exam.",
    tree: {
      text: "Lecture: topic",
      children: kids(
        { text: "Key concepts", children: kids("Concept 1", "Concept 2") },
        "Examples",
        "Formulas & definitions",
        "Questions to review",
        "Further reading",
      ),
    },
  },
  {
    id: "meeting",
    name: "Meeting notes",
    summary: "Agenda, decisions and action items.",
    goodFor: "Weekly syncs, one-to-ones and client calls where decisions need owners.",
    tree: {
      text: "Meeting — date",
      children: kids(
        "Attendees",
        { text: "Agenda", children: kids("Item 1", "Item 2") },
        "Decisions",
        { text: "Action items", children: kids("Who — what — when") },
      ),
    },
  },
  {
    id: "swot",
    name: "SWOT analysis",
    summary: "Strengths, weaknesses, opportunities, threats.",
    goodFor: "Comparing options, reviewing a product or preparing a strategy session.",
    tree: {
      text: "SWOT",
      children: kids("Strengths", "Weaknesses", "Opportunities", "Threats"),
    },
  },
  {
    id: "novel",
    name: "Story outline",
    summary: "Characters, setting and three-act structure.",
    goodFor: "Planning a novel, a short story or a screenplay before the first draft.",
    tree: {
      text: "Story title",
      children: kids(
        { text: "Characters", children: kids("Protagonist", "Antagonist") },
        "Setting",
        "Act I — Setup",
        "Act II — Confrontation",
        "Act III — Resolution",
        "Themes",
      ),
    },
  },
];

export function countNodes(n: TreeNode): number {
  return 1 + (n.children ?? []).reduce((s, c) => s + countNodes(c), 0);
}
