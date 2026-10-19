/** Home page FAQ. Plain-text answers are reused verbatim in FAQPage JSON-LD. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: "Is noodl free?",
    a: "Yes. noodl is free to use in your browser. There is no paid plan, no trial and no feature locked behind an upgrade.",
  },
  {
    q: "Do I need an account?",
    a: "No. You start in guest mode and every feature works without signing in. Your notes are saved in this browser. Sign in with Google only if you want the same notes on another device.",
  },
  {
    q: "Where are my notes stored?",
    a: "In your browser's IndexedDB storage, on this device. If you sign in with Google, your notes are also synced to Google Firestore under your account so your other devices can load them.",
  },
  {
    q: "Does it work offline?",
    a: "Yes. Once the app has loaded, you can create, edit, reorganise and export notes without a connection. Typeahead keeps working too: offline, it suggests matches from your own notes instead of asking the AI.",
  },
  {
    q: "What does the AI see?",
    a: "Only when AI is turned on. For a typeahead suggestion: what you have typed in the node, the chain of node texts from the root (the note's title) down to its parent, and the texts of its sibling nodes. For Generate, Summarize, Rewrite and Expand: your prompt, the text you pasted, or the node you chose and its path. It is sent to Google Gemini through Firebase. Your other notes are never sent.",
  },
  {
    q: "Can I turn the AI off?",
    a: "Yes. Settings › AI has a single on/off switch. With AI off, nothing is sent to Gemini, and typeahead still suggests phrases and words from your own notes.",
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
