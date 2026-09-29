#!/usr/bin/env bash
set -e

echo "Cleaning build artifacts and dependencies across workspace..."
pnpm turbo clean
rm -rf node_modules
find . -name "dist" -type d -prune -exec rm -rf '{}' +
find . -name ".next" -type d -prune -exec rm -rf '{}' +
find . -name ".turbo" -type d -prune -exec rm -rf '{}' +
echo "Clean complete."
