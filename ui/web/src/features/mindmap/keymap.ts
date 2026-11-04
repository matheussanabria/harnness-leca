// Keyboard shortcut mapping for the mind map. Returns true when the key was handled.
export interface KeyCommands {
  child(): void;
  sibling(): void;
  outdent(): void;
  remove(): void;
  toggle(): void;
  edit(): void;
  undo(): void;
  redo(): void;
  move(direction: "up" | "down" | "left" | "right"): void;
}

type KeyLike = Pick<KeyboardEvent, "key" | "shiftKey" | "ctrlKey" | "metaKey">;

export function handleKey(event: KeyLike, commands: KeyCommands): boolean {
  const mod = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (mod && key === "z") return run(event.shiftKey ? commands.redo : commands.undo);
  if (mod && key === "y") return run(commands.redo);
  if (mod) return false;
  switch (event.key) {
    case "Tab":
      return run(event.shiftKey ? commands.outdent : commands.child);
    case "Enter":
      return run(commands.sibling);
    case "Delete":
    case "Backspace":
      return run(commands.remove);
    case "F2":
      return run(commands.edit);
    case " ":
      return run(commands.toggle);
    case "ArrowUp":
      return run(() => commands.move("up"));
    case "ArrowDown":
      return run(() => commands.move("down"));
    case "ArrowLeft":
      return run(() => commands.move("left"));
    case "ArrowRight":
      return run(() => commands.move("right"));
    default:
      return false;
  }
}

function run(action: () => void): true {
  action();
  return true;
}
