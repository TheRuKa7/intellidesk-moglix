import { execSync } from 'child_process';

const port = Number(process.argv[2] ?? 3020);

if (process.platform === 'win32') {
  try {
    const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8' });
    const pids = new Set(
      out
        .split('\n')
        .map((line) => line.trim().split(/\s+/).pop())
        .filter((pid) => pid && /^\d+$/.test(pid)),
    );
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`Killed process ${pid} on port ${port}`);
      } catch {
        /* already gone */
      }
    }
  } catch {
    console.log(`Port ${port} is free`);
  }
} else {
  try {
    execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore', shell: true });
    console.log(`Killed process on port ${port}`);
  } catch {
    console.log(`Port ${port} is free`);
  }
}
