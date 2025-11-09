#!/bin/bash
for file in src/tests/*.spec.ts; do
  echo "🧪 Running $file"
  NODE_ENV=test bun test "$file" || exit 1
done