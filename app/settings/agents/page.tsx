import AgentsSettings from "@/components/AgentsSettings";
import { Code, Notice } from "@/components/settings/SettingsSection";

export default function AgentsSettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <Notice>
        <p>Give each bot its own key so you can limit what it can do and revoke it alone. Changes an agent makes are recorded under its name. See <Code>docs/agent-api.md</Code> for the API and MCP endpoint.</p>
      </Notice>
      <AgentsSettings />
    </div>
  );
}
