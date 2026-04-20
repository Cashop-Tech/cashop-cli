import { createProgram } from '../src/cli/index.js';
import { startMcpServer } from '../src/mcp/server.js';
import { CashopError } from '../src/core/errors.js';

process.on('unhandledRejection', (err) => {
  if (err instanceof CashopError) {
    console.error(`Error: ${err.message}`);
  } else if (err instanceof Error) {
    console.error(`Error: ${err.message}`);
  } else {
    console.error('An unexpected error occurred');
  }
  process.exit(1);
});

const args = process.argv.slice(2);

if (args[0] === 'mcp-server') {
  void startMcpServer();
} else {
  const program = createProgram();
  program.parse();
}
