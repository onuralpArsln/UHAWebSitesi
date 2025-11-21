#!/usr/bin/env node

/**
 * Cross-platform script to kill processes using a specific port
 * Works on both Linux/Unix and Windows
 */

const { execSync } = require('child_process');
const os = require('os');

const PORT = process.env.PORT || 3000;

function killProcessOnPort(port) {
  const platform = os.platform();
  console.log(`📌 Checking for processes on port ${port}...`);

  try {
    if (platform === 'win32') {
      // Windows: Use netstat to find PID, then taskkill
      try {
        // Find PID using netstat
        const netstatOutput = execSync(
          `netstat -ano | findstr :${port}`,
          { encoding: 'utf8', stdio: 'pipe' }
        );

        if (netstatOutput.trim()) {
          const lines = netstatOutput.trim().split('\n');
          const pids = new Set();

          lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(pid) && pid !== '0') {
              pids.add(pid);
            }
          });

          if (pids.size > 0) {
            console.log(`⚠️  Found ${pids.size} process(es) using port ${port}, killing them...`);
            pids.forEach(pid => {
              try {
                execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' });
                console.log(`   ✅ Killed process ${pid}`);
              } catch (err) {
                // Process might already be dead or requires admin privileges
                console.log(`   ⚠️  Could not kill process ${pid} (may require admin privileges)`);
              }
            });
            console.log(`✅ Port ${port} is now free\n`);
            return true;
          }
        }
      } catch (err) {
        // No process found or netstat failed
      }
    } else {
      // Linux/Unix: Try multiple methods
      const methods = [
        // Method 1: lsof (most common)
        `lsof -ti:${port}`,
        // Method 2: fuser (alternative)
        `fuser ${port}/tcp 2>/dev/null`,
        // Method 3: netstat + awk
        `netstat -tlnp 2>/dev/null | grep :${port} | awk '{print $7}' | cut -d'/' -f1`
      ];

      for (const method of methods) {
        try {
          const result = execSync(method, { encoding: 'utf8', stdio: 'pipe' }).trim();
          if (result) {
            const pids = result.split('\n').filter(pid => pid && !isNaN(pid) && pid !== '0');
            if (pids.length > 0) {
              console.log(`⚠️  Found ${pids.length} process(es) using port ${port}, killing them...`);
              pids.forEach(pid => {
                try {
                  execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
                  console.log(`   ✅ Killed process ${pid}`);
                } catch (err) {
                  // Process might already be dead
                }
              });
              console.log(`✅ Port ${port} is now free\n`);
              return true;
            }
          }
        } catch (err) {
          // Method not available or no process found, try next
          continue;
        }
      }
    }

    console.log(`✅ Port ${port} is already free\n`);
    return false;
  } catch (error) {
    console.log(`⚠️  Could not check/kill processes on port ${port}: ${error.message}`);
    console.log('   Continuing anyway...\n');
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  killProcessOnPort(PORT);
}

module.exports = { killProcessOnPort };

