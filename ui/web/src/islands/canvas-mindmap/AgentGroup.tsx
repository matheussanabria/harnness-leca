// Agent context-copy group for the mind-map toolbar.
import { buildContextPack, copyText } from "../../features/context-pack/index.ts";
import type { ToolbarState } from "../../features/mindmap/toolbarState.ts";
import type { MindDoc } from "../../features/mindmap/types.ts";
import { useCopyStatus } from "../../features/mindmap/useCopyStatus.ts";
import { ToolbarButton } from "./ToolbarButton.tsx";

export interface AgentGroupProps {
  doc: MindDoc;
  selectedId: string | null;
  boardTitle: string;
  state: ToolbarState;
}

export function AgentGroup({ doc, selectedId, boardTitle, state }: AgentGroupProps) {
  const { status, show } = useCopyStatus();

  const copy = async (asJson: boolean) => {
    const pack = buildContextPack(doc, selectedId, { boardTitle, budget: 4000 });
    if (pack.empty) return;

    const text = asJson ? JSON.stringify(pack.json, null, 2) : pack.markdown;
    const ok = await copyText(text);
    if (!ok) {
      show("Could not copy");
      return;
    }
    const omitted = pack.truncated ? ` (${pack.omitted} nodes omitted)` : "";
    show(`Copied ${text.length} characters${omitted}`);
  };

  return (
    <fieldset className="mm-agent-group" aria-label="Agent">
      <ToolbarButton
        icon="fa-clipboard-list"
        label="Copy selection as agent context (Markdown)"
        disabled={!state.copyContext}
        onClick={() => void copy(false)}
      />
      <ToolbarButton
        icon="fa-code"
        label="Copy selection as agent context (JSON)"
        disabled={!state.copyContext}
        onClick={() => void copy(true)}
      />
      {status ? (
        <span className="mm-agent-status" role="status" aria-live="polite">
          {status}
        </span>
      ) : null}
    </fieldset>
  );
}
