#!/usr/bin/env bash
# Stop hook: turn tugashidan oldin TypeScript tekshiruvi.
# Faqat ishchi daraxtda .ts/.tsx o'zgarishi bo'lsa ishlaydi.
# Xato bo'lsa exit 2 — turn tugashi bloklanadi va xatolar Claude'ga ko'rsatiladi.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

if ! git status --porcelain 2>/dev/null | grep -qE '\.(ts|tsx)$'; then
  exit 0
fi

OUT=$(npm run check 2>&1)
STATUS=$?

if [ $STATUS -ne 0 ]; then
  echo "TypeScript xatolari topildi (npm run check). Turn tugashidan oldin tuzating:" >&2
  echo "$OUT" | grep -E "error TS|\.tsx?\(" | head -30 >&2
  exit 2
fi

exit 0
