export function showHelp() {
    console.log(`
╔════════════════════════════════════════╗
║         ReplayTunnel CLI               ║
╚════════════════════════════════════════╝

Usage: npm run cli <command> [options]

Commands:
  list [--status CODE] [--method METHOD]
    List captured requests
    
  show <request-id>
    Show full details of a request
    
  replay <request-id>
    Replay a single request
    
  watch <request-id> [--dir PATH]
    Watch files and auto-replay on changes
    Default dir: ./src
    
  watch --failed [--dir PATH]
    Watch and auto-replay all failed requests
    
  stats
    Show request statistics
    
  clear
    Clear all captured requests

Examples:
  npm run cli list --status 500
  npm run cli show abc123
  npm run cli replay abc123
  npm run cli watch abc123 --dir ./src
  npm run cli watch --failed
`);
}
