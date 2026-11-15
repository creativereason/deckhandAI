import AgentsSettings from "@/components/AgentsSettings";

export default function AgentsSettingsPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Give each bot its own key so you can limit what it can do and revoke it alone. Changes an
        agent makes are recorded under its name. See <code>docs/agent-api.md</code> for the API and MCP endpoint.
      </p>
      <AgentsSettings />
    </div>
  );
}
