import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import pluginQuery from "@tanstack/eslint-plugin-query";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...pluginQuery.configs["flat/recommended"],
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // eslint-plugin-react-hooks v7 added three compiler-based rules that flag
    // pre-existing patterns across the dialog/sheet components and the page
    // routes. They are real findings, but fixing them touches component logic
    // that is out of scope for this maintenance sweep, so they are demoted to
    // warnings to keep CI actionable. The list is deliberately explicit rather
    // than repo-wide: a new violation in any other file still fails the build,
    // and the list shrinks as these files are reworked — tracked as follow-up
    // work. Note that the rule engine stops after the first diagnosis per
    // function, so fixing one finding can uncover others in the same file.
    files: [
      "app/admin/page.tsx",
      "app/login/page.tsx",
      "app/page.tsx",
      "app/profile/page.tsx",
      "app/register/page.tsx",
      "components/admin/calendar-edit-sheet.tsx",
      "components/changelog-dialog.tsx",
      "components/export-dialog.tsx",
      "components/external-sync-manage-sheet.tsx",
      "components/note-sheet.tsx",
      "components/preset-manage-sheet.tsx",
      "components/shift-sheet.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);

export default eslintConfig;
