import { PageHeader } from "@/components/blocks";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy",
  description:
    "What noodl stores and where: notes in your browser's IndexedDB, optional sync to Google Firestore when you sign in, and AI requests to Google Gemini only while AI is on. No ads, no tracking cookies.",
  path: "/privacy/",
});

// Update this date whenever the notice changes.
const UPDATED = "19 October 2026";

export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ name: "Privacy", path: "/privacy/" }]}
        eyebrow="Privacy notice"
        title="Your notes, and where they go."
        lede="The short version: your notes stay in your browser unless you sign in to sync or use an AI feature. There are no ads and no tracking cookies."
      >
        <p className="mt-6">
          <span className="draft-banner" role="note">
            Draft — have this reviewed before launch
          </span>
        </p>
      </PageHeader>

      <div className="container-site pb-20">
        <article className="prose-mn">
          <p className="muted text-[15px]">Last updated: {UPDATED}</p>

          <h2>Summary</h2>
          <div className="table-wrap">
            <table className="ktable">
              <caption className="sr-only">What is stored or sent, and when</caption>
              <thead>
                <tr>
                  <th scope="col">Situation</th>
                  <th scope="col">Where your notes are</th>
                  <th scope="col">What leaves your device</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Guest (default)</th>
                  <td>IndexedDB in this browser</td>
                  <td>Nothing about your notes</td>
                </tr>
                <tr>
                  <th scope="row">Signed in with Google</th>
                  <td>IndexedDB, plus Google Firestore under your account</td>
                  <td>Your notes, to sync them</td>
                </tr>
                <tr>
                  <th scope="row">AI on</th>
                  <td>Unchanged</td>
                  <td>The text needed for each AI request, to Google Gemini via Firebase</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>Notes stored on your device</h2>
          <p>
            noodl works without an account. Everything you create in guest mode (notes, folders, images, the
            Recycle Bin, version snapshots and settings) is saved in your browser&apos;s <strong>IndexedDB</strong> storage on this
            device. We do not receive a copy.
          </p>
          <p>
            That data is controlled by your browser. Clearing site data, using a private window, or a browser deciding
            to free up space can remove it. Make a backup from Settings › Data if a note matters to you. To remove
            everything from a device, clear this site&apos;s data in your browser settings.
          </p>

          <h2>Sign-in and sync (optional)</h2>
          <p>
            If you choose to sign in with Google (or with an email sign-in link, where offered), we use{" "}
            <strong>Firebase Authentication</strong> to identify your account. Firebase receives your email address
            and, for Google sign-in, your account&apos;s basic profile (name and photo).
          </p>
          <p>
            While you are signed in, your notes are synced to <strong>Google Cloud Firestore</strong>, stored under your
            account&apos;s user ID so that only you can read or change them, and copied back to IndexedDB on each device
            where you sign in. When you first sign in, notes made in guest mode on that device are merged into your
            account. Two things are never synced and stay only on the device that created them: images you add to
            notes, and version snapshots.
          </p>
          <p>
            Signing out stops syncing. You are asked whether to keep a copy of your notes on that device or remove
            them from it. To have
            synced notes deleted from Firestore, delete them in the app while signed in (they are removed for good after
            30 days in the Recycle Bin), or contact us.
          </p>

          <h2>AI features (only when AI is on)</h2>
          <p>
            AI features are provided by <strong>Google Gemini</strong> through <strong>Firebase AI Logic</strong>.
            Requests go from your browser to Google; they are not sent to a server we run. What is sent depends on the
            feature:
          </p>
          <ul>
            <li>
              <strong>Typeahead suggestions:</strong> what you have typed in the current node, the texts of the nodes
              from the root (the note&apos;s title) down to its parent, and the texts of its sibling nodes.
            </li>
            <li>
              <strong>Generate a map:</strong> the prompt you write and the depth you choose.
            </li>
            <li>
              <strong>Summarize pasted text:</strong> the text you paste.
            </li>
            <li>
              <strong>Rewrite node:</strong> the node&apos;s text, the path of node texts above it, and the kind of
              rewrite you picked.
            </li>
            <li>
              <strong>Expand into ideas:</strong> the node&apos;s text, the path of node texts above it, and the texts
              of its existing children.
            </li>
          </ul>
          <p>
            Your other notes are never sent. Google processes these requests under its own terms for the Gemini API;
            depending on how the service is configured, Google may retain request content for a limited period to
            provide the service and prevent abuse.{" "}
            <em>[Reviewer: confirm the Gemini API tier and data-use terms that apply to this project.]</em>
          </p>
          <p>
            You can switch AI off entirely in <strong>Settings › AI</strong>. With AI off, nothing is sent to Gemini,
            and typeahead suggests matches from your own notes, computed on your device.
          </p>

          <h2>What we do not do</h2>
          <ul>
            <li>No advertising, and we do not sell or share your data for advertising.</li>
            <li>No analytics or tracking scripts on this website or in the app.</li>
            <li>
              No tracking cookies. The app uses browser storage only to run: your notes, your settings, and keeping you
              signed in if you choose to sign in.
            </li>
          </ul>

          <h2>Hosting</h2>
          <p>
            This website and the app are served by <strong>Firebase Hosting</strong>. Like any web server, it processes
            your IP address and request details to deliver pages, and Google may keep short-lived server logs for
            security and reliability.
          </p>

          <h2>Children</h2>
          <p>
            noodl is a general-purpose tool and is not directed at children under 13. Signing in requires a
            Google account, which is subject to Google&apos;s own age requirements.
          </p>

          <h2>Changes and contact</h2>
          <p>
            If this notice changes, we will update the date at the top of this page. For questions or deletion
            requests, contact <em>[contact address to be added before launch]</em>.
          </p>
        </article>
      </div>
    </>
  );
}
