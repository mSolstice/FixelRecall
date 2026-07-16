# File Placement Map

Copy the downloaded pack into the root of the new `context-diet` repository.

```text
context-diet/
├── 00_START_HERE.md
├── README.md
├── AGENTS.md
├── CLAUDE.md
├── docs/
│   ├── CONTEXT_DIET_BLUEPRINT.md
│   ├── ARCHITECTURE.md
│   ├── BUILD_PLAN.md
│   ├── ACCEPTANCE_CRITERIA.md
│   ├── SECURITY_MODEL.md
│   ├── DECISIONS.md
│   ├── DUAL_PLATFORM_COMPATIBILITY.md
│   ├── BEGINNER_STEP_BY_STEP_GUIDE.md
│   ├── UPDATED_BUILD_PROMPTS_CODEX_AND_CLAUDE.md
│   └── FILE_PLACEMENT_MAP.md
├── skill-source/
│   └── context-diet/
│       ├── SKILL.md
│       └── references/
├── .agents/
│   └── skills/
│       └── context-diet/
└── .claude/
    └── skills/
        └── context-diet/
```

The `.agents` and `.claude` folders may be hidden in Finder.

The canonical editable skill is under `skill-source/`.

The two hidden skill folders are generated installation copies. During the build, a sync script will
keep them aligned.
