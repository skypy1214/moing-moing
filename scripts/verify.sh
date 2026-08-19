#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export GRADLE_USER_HOME="$repository_root/.gradle-user-home"

cd "$repository_root/backend"
./gradlew clean build

cd "$repository_root/frontend"
npm ci
npm run lint
npm test
npm run build

cd "$repository_root"
git diff --check
git status --short
