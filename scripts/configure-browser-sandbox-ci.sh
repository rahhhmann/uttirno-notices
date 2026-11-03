#!/usr/bin/env bash
set -euo pipefail

# CI only. Keep Chromium's sandbox enabled; do not disable AppArmor globally.
# https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md
if [[ "${GITHUB_ACTIONS:-}" != "true" || "$(uname -s)" != "Linux" ]]; then
  echo "This helper is restricted to ephemeral Linux GitHub Actions runners." >&2
  exit 1
fi

restriction=/proc/sys/kernel/apparmor_restrict_unprivileged_userns
if [[ ! -f "$restriction" ]] || [[ "$(cat "$restriction")" != "1" ]]; then
  echo "No AppArmor user-namespace exception is required."
  exit 0
fi

profile_file="$(mktemp)"
trap 'rm -f "$profile_file"' EXIT
printf 'abi <abi/4.0>,\ninclude <tunables/global>\n' > "$profile_file"
count=0
for browser in \
  "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux64/chrome \
  "$HOME"/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell; do
  [[ -x "$browser" ]] || continue
  case "$browser" in *\"*|*\\*) echo "Unsafe browser path" >&2; exit 1;; esac
  count=$((count + 1))
  printf 'profile uttirno-playwright-ci-%s "%s" flags=(unconfined) {\n  userns,\n}\n' "$count" "$browser" >> "$profile_file"
done
if [[ "$count" -eq 0 ]]; then
  echo "Expected installed Playwright browser binaries were not found." >&2
  exit 1
fi
sudo install -m 0644 "$profile_file" /etc/apparmor.d/uttirno-playwright-ci
sudo apparmor_parser -r /etc/apparmor.d/uttirno-playwright-ci
echo "Loaded exact-path CI browser user-namespace profiles; Chromium sandbox remains enabled."
