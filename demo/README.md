# Demo Folder

⚠️ **WARNING: This folder is for DEMO purposes only!**

This directory contains scripts and snapshots specifically designed for creating and managing the BetterShift demo environment. **Do NOT use these scripts on production data** as they will reset/overwrite your database.

## Contents

### Scripts

- **`create-snapshot.sh`** - Creates a snapshot of the current database state for demo purposes
- **`reset-demo.sh`** - Resets the database to the demo snapshot state

### What This Folder Is For

This folder helps maintain a consistent demo environment by:

- Capturing a pre-configured database state with sample data
- Quickly resetting to that state for demos or testing
- Ensuring reproducible demo scenarios

## Usage

### Creating a Demo Snapshot

```bash
./demo/create-snapshot.sh
```

This will create a snapshot of your current database in the demo folder.

### Resetting to Demo State

```bash
./demo/reset-demo.sh
```

This will **overwrite your current database** with the demo snapshot.

### Automated Demo Reset with Cron

For automated demo environments (e.g., public demos), you can set up a cron job to automatically reset the database at regular intervals.

**Example: Reset every hour**

```bash
# Edit your crontab
crontab -e

# Add this line to reset every hour at minute 0
0 * * * * cd /path/to/bettershift && ./demo/reset-demo.sh >> /var/log/bettershift-demo-reset.log 2>&1
```

**Example: Reset every 30 minutes**

```bash
# Add this line to reset twice per hour
*/30 * * * * cd /path/to/bettershift && ./demo/reset-demo.sh >> /var/log/bettershift-demo-reset.log 2>&1
```

**Example: Reset daily at 2 AM**

```bash
# Add this line to reset once per day
0 2 * * * cd /path/to/bettershift && ./demo/reset-demo.sh >> /var/log/bettershift-demo-reset.log 2>&1
```

**Important for Cron Setup:**

- Replace `/path/to/bettershift` with your actual project path
- Ensure the cron user has permission to run the script
- The script requires `sudo` permissions for file operations
- Check logs at `/var/log/bettershift-demo-reset.log` for errors
- Consider using `flock` to prevent overlapping executions:
  ```bash
  */30 * * * * flock -n /tmp/demo-reset.lock -c "cd /path/to/bettershift && ./demo/reset-demo.sh" >> /var/log/bettershift-demo-reset.log 2>&1
  ```

## Important Notes

- ⛔ **Never run these scripts on production databases**
- 🎯 This folder is exclusively for demo/testing environments
- 💾 The snapshot file is not tracked in git (see `.gitignore`)
- 🔄 Always backup your data before running reset scripts

## For Production Use

If you need to backup or restore production data, use proper backup tools and strategies instead of these demo scripts. Consider:

- Database backup solutions (SQLite `.backup` command)
- File-based backups with proper versioning
- Automated backup schedules
- Secure off-site storage
