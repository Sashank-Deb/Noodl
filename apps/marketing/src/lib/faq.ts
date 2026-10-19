/** Home page FAQ. Plain-text answers are reused verbatim in FAQPage JSON-LD. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: "Is noodl free?",
    a: "Yes. noodl is free to use in your browser. There is no paid plan, no trial and no feature locked behind an upgrade.",
  },
  {
    q: "Do I need an account?",
    a: "No. You start in guest mode and everything except AI works without signing in: your notes are saved in this browser and typeahead suggests from your own notes. Sign in with Google to sync across devices and to turn on AI suggestions.",
  },
  {
    q: "Where are my notes stored?",
    a: "In your browser's IndexedDB storage, on this device. If you sign in with Google, your notes are also synced to Supabase under your account so your other devices can load them.",
  },
  {
    q: "Does it work offline?",
    a: "Yes. Once the app has loaded, you can create, edit, reorganise and export notes without a connection. Typeahead keeps working too: offline, it suggests matches from your own notes instead of asking the AI.",
  },
  {
    q: "What does the AI see?",
    a: "Only when you are signed in and AI is turned on. For a typeahead suggestion: what you have typed in the node, the chain of node texts from the root (the note's title) down to its parent, and the texts of its sibling nodes. For Generate, Summarize, Rewrite and Expand: your prompt, the text you pasted, or the node you chose and its path. It goes through noodl's server to Groq, with Google Gemini as a backup. Your other notes are never sent.",
  },
  {
    q: "Can I turn the AI off?",
    a: "Yes. Settings › AI has a single on/off switch. With AI off, nothing is sent to any AI provider, and typeahead still suggests phrases and words from your own notes.",
  },
  {
    q: "What can I export?",
    a: "PNG and JPEG images of the map, PDF (one A4 page), Markdown, HTML, plain text and lossless JSON. You can import Markdown outlines and noodl JSON files back in, and Settings › Data makes a full backup of every note that you can restore later.",
  },
  {
    q: "Does it work on phones and tablets?",
    a: "Yes. The layout adapts from phone to desktop, controls are sized for touch on small screens, and typeahead works the same way, with suggestions in a dropdown under the node.",
  },
];
