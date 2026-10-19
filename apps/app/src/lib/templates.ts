import type { OutlineItem } from "./tree";

export interface Template {
  id: string;
  name: string;
  description: string;
  outline: OutlineItem;
}

const kids = (...t: (string | OutlineItem)[]): OutlineItem[] =>
  t.map((x) => (typeof x === "string" ? { text: x } : x));

export const TEMPLATES: Template[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Start from a single central topic.",
    outline: { text: "Central topic" },
  },
  {
    id: "project",
    name: "Project plan",
    description: "Goals, scope, timeline, risks and owners.",
    outline: {
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
    description: "Key concepts, examples and questions to review.",
    outline: {
      text: "Lecture: topic",
      children: kids(
        { text: "Key concepts", children: kids("Concept 1", "Concept 2") },
        { text: "Examples" },
        { text: "Formulas & definitions" },
        { text: "Questions to review" },
        { text: "Further reading" },
      ),
    },
  },
  {
    id: "meeting",
    name: "Meeting notes",
    description: "Agenda, decisions and action items.",
    outline: {
      text: "Meeting — date",
      children: kids(
        { text: "Attendees" },
        { text: "Agenda", children: kids("Item 1", "Item 2") },
        { text: "Decisions" },
        { text: "Action items", children: kids("Who — what — when") },
      ),
    },
  },
  {
    id: "swot",
    name: "SWOT analysis",
    description: "Strengths, weaknesses, opportunities, threats.",
    outline: {
      text: "SWOT",
      children: kids("Strengths", "Weaknesses", "Opportunities", "Threats"),
    },
  },
  {
    id: "novel",
    name: "Story outline",
    description: "Characters, setting and three-act structure.",
    outline: {
      text: "Story title",
      children: kids(
        { text: "Characters", children: kids("Protagonist", "Antagonist") },
        { text: "Setting" },
        { text: "Act I — Setup" },
        { text: "Act II — Confrontation" },
        { text: "Act III — Resolution" },
        { text: "Themes" },
      ),
    },
  },
];

/** The note new users see first — doubles as a quick tutorial. */
export const WELCOME: OutlineItem = {
  text: "Welcome to noodl",
  children: kids(
    {
      text: "Build your map",
      children: kids("Tab adds a child node", "Enter adds a sibling", "Space or double-click edits a node", "Drag a node onto another to move it"),
    },
    {
      text: "AI typeahead",
      children: kids("Start typing in any node", "Ghost text appears — press Tab to accept", "↑ ↓ to pick another suggestion"),
    },
    {
      text: "Two views, one note",
      children: kids("Mind map for the big picture", "Outline for fast writing", "Switch any time from the toolbar"),
    },
    {
      text: "Private by default",
      children: kids("Everything is saved in this browser", "Sign in only if you want sync across devices"),
    },
  ),
};
