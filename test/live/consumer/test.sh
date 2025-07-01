#!/bin/bash
set -e  # Exit immediately if any command fails


# Get the directory of this script, resolving symlinks if needed
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the package root dir
cd "../../"
# Share the root
npm link

# Change to the script directory
cd "$SCRIPT_DIR"

# Reset the config file
cp pm-link-auto.config.initial.ts pm-link-auto.config.ts

npm link @andyrmitchell/pm-link-auto
npx pm-link-auto

echo "\n\n=======\n"
echo "Expect paths in pm-link-auto.config.ts to be correct. Now run it again to complete."

npx pm-link-auto

# This should output "Ran OK"
node consume.js