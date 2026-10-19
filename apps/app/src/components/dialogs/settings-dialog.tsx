"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/context/settings";
import { useAuth } from "@/context/auth";
import { aiAvailable } from "@/lib/ai/ai";
import { exportBackup, importBackup, type Backup } from "@/lib/db";
import { download } from "@/lib/io";
import { schedulePush } from "@/lib/sync";
import { MOD } from "@/components/editor/editor";

function Row({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </Label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Tab", "Add child (accepts AI ghost text when shown)"],
  ["Enter", "Add sibling"],
  ["⇧ Enter", "New line (editing) · sibling above (selected)"],
  ["Space / F2", "Edit selected node"],
  ["Esc", "Close suggestions, then stop editing"],
  ["↑ ↓", "Choose suggestion · move between nodes"],
  ["← →", "Parent / first child"],
  ["⇧ Tab", "Outdent"],
  ["⌥ ↑ / ⌥ ↓", "Move node up / down"],
  [`${MOD} ;`, "Collapse / expand"],
  ["⌥ 0–3", "Expand all / to level 1–3"],
  [`${MOD} Z / ⇧${MOD} Z`, "Undo / redo"],
  [`${MOD} C / X / V`, "Copy, cut, paste branches as text"],
  [`${MOD} D`, "Duplicate branch"],
  [`⇧${MOD} M`, "Switch outline / mind map"],
  [`${MOD} K`, "Search"],
  ["⌥ N", "New note"],
  [`⇧${MOD} G`, "Generate a map with AI"],
  [`${MOD} J`, "AI rewrite / ideas for the selected node"],
  [`⇧${MOD} E`, "Export menu"],
  [`${MOD} \\`, "Show / hide the library"],
  [`${MOD} .`, "Focus mode"],
  [`${MOD} ,`, "Settings"],
  ["?", "This list"],
  ["⇧ 1", "Restore view (fit)"],
  [`${MOD} = / ${MOD} −`, "Zoom in / out"],
  ["Double-click canvas", "Reset view"],
];

export function SettingsDialog({ open, onOpenChange, initialTab = "general" }: { open: boolean; onOpenChange: (o: boolean) => void; initialTab?: string }) {
  const { settings, update } = useSettings();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">App preferences, AI, data and keyboard shortcuts.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={initialTab}>
          <TabsList className="w-full">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="ai">AI</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="keys">Shortcuts</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="divide-y">
            <Row label="Theme">
              <ToggleGroup type="single" variant="outline" size="sm" value={settings.theme} onValueChange={(v) => v && update({ theme: v as typeof settings.theme })}>
                <ToggleGroupItem value="light">Light</ToggleGroupItem>
                <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
                <ToggleGroupItem value="system">System</ToggleGroupItem>
              </ToggleGroup>
            </Row>
            <Row label="Open notes in">
              <ToggleGroup type="single" variant="outline" size="sm" value={settings.defaultView} onValueChange={(v) => v && update({ defaultView: v as typeof settings.defaultView })}>
                <ToggleGroupItem value="map">Mind map</ToggleGroupItem>
                <ToggleGroupItem value="outline">Outline</ToggleGroupItem>
              </ToggleGroup>
            </Row>
            <Row label="Map style for new notes">
              <ToggleGroup type="single" variant="outline" size="sm" value={settings.defaultMapStyle} onValueChange={(v) => v && update({ defaultMapStyle: v as typeof settings.defaultMapStyle })}>
                <ToggleGroupItem value="curved">Ballpoint</ToggleGroupItem>
                <ToggleGroupItem value="elbow">Elbow</ToggleGroupItem>
                <ToggleGroupItem value="boxed">Card</ToggleGroupItem>
              </ToggleGroup>
            </Row>
            <Row label="Map layout" hint="Balanced puts branches on both sides of the central topic.">
              <ToggleGroup type="single" variant="outline" size="sm" value={settings.mapLayout} onValueChange={(v) => v && update({ mapLayout: v as typeof settings.mapLayout })}>
                <ToggleGroupItem value="right">Right</ToggleGroupItem>
                <ToggleGroupItem value="balanced">Balanced</ToggleGroupItem>
              </ToggleGroup>
            </Row>
          </TabsContent>

          <TabsContent value="ai" className="divide-y">
            <Row label="AI suggestions" hint={aiAvailable() ? "Typeahead, Generate and Rewrite. Prompts and the current branch's text are sent to Google Gemini." : "AI isn't configured for this deployment. Typeahead uses your own notes."} htmlFor="ai-switch">
              <Switch id="ai-switch" checked={settings.aiEnabled} disabled={!aiAvailable()} onCheckedChange={(v) => update({ aiEnabled: v })} />
            </Row>
            <Row label="Suggestion delay" hint={`Wait ${settings.typeaheadDelay} ms after you stop typing. Longer saves AI quota.`}>
              <Slider
                className="w-40"
                min={150}
                max={600}
                step={50}
                value={[settings.typeaheadDelay]}
                onValueChange={([v]) => update({ typeaheadDelay: v })}
                aria-label="Suggestion delay in milliseconds"
              />
            </Row>
            <Row label="Tab accepts suggestions" hint="When off, Tab always adds a child; → still accepts." htmlFor="tab-switch">
              <Switch id="tab-switch" checked={settings.tabAccepts} onCheckedChange={(v) => update({ tabAccepts: v })} />
            </Row>
            <p className="pt-3 text-xs text-muted-foreground">With AI off, suggestions still appear from text you&apos;ve already written. Nothing leaves this device.</p>
          </TabsContent>

          <TabsContent value="data" className="divide-y">
            <Row label="Cloud sync" hint={user ? `Signed in as ${user.email}` : "Sign in from the account menu to sync across devices."} htmlFor="sync-switch">
              <Switch id="sync-switch" checked={settings.syncEnabled} disabled={!user} onCheckedChange={(v) => update({ syncEnabled: v })} />
            </Row>
            <Row label="Backup" hint="All notes and folders as one JSON file.">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const b = await exportBackup();
                    download(`noodl-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b), "application/json");
                  }}
                >
                  Export all
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  Restore…
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    try {
                      const n = await importBackup(JSON.parse(await f.text()) as Backup);
                      schedulePush();
                      toast(`Restored ${n} notes`);
                    } catch (err) {
                      toast.error((err as Error).message || "That file isn't a noodl backup");
                    }
                  }}
                />
              </div>
            </Row>
            <p className="pt-3 text-xs text-muted-foreground">Images stay on the device they were added on. Deleted notes are kept in the Recycle Bin for 30 days.</p>
          </TabsContent>

          <TabsContent value="keys">
            <dl className="grid max-h-[50vh] grid-cols-[auto_1fr] gap-x-4 gap-y-2 overflow-auto py-2 text-sm">
              {SHORTCUTS.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt>
                    <kbd className="kbd whitespace-nowrap">{k}</kbd>
                  </dt>
                  <dd className="text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
