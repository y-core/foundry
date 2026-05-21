import { addCommand, createCommand, execute } from "@y-core/forge/cli";
import { createStatusCommand, createSyncCommand } from "./mod";

const root = createCommand({ name: "cf", description: "Cloudflare resource management" });
addCommand(root, createSyncCommand());
addCommand(root, createStatusCommand());
execute(root);
