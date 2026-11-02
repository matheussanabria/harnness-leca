# Convention: the `Story:` commit trailer

Status: in force for Harness Leca work. Reader: `ui/server/services/project-scrum-commits.js` (`parseTrailers`, `readStoryCommits`), exposed by `GET /api/project/:slug/scrum/story/:id/commits`.

## Rule

A commit that implements part of a Scrum story ends its message with one trailer line per story:

```
feat(scrum): capture demand as draft (18.07)

Story: 18.07
```

- The agent or person who writes the commit message writes the trailer. A hook never writes it.
- The value is the story `id` or `key` as shown in the story drawer. A story id never changes when its key is renamed, so prefer the `id`.
- Several stories: one `Story:` line each.
- No story (chore, tooling, docs without a story): omit the trailer. A missing trailer simply produces no link; it is not an error.

## How the reader treats it (what you must respect)

- The trailer must sit in the last paragraph of the message, separated from the body by one blank line, and every line of that paragraph must be `Key: value`. A trailer inside the body, or in a paragraph that also holds prose, is ignored.
- Key match is case-insensitive (`Story`, `story`); the value is matched against story ids and keys case-insensitively. Empty values and repeated values are dropped.
- A value must look like an id: 1 to 80 characters of letters, digits, `.`, `_`, `-`, starting with a letter or digit. Anything else is never matched.
- Only commits reachable in the configured project repository count, newest 500 by default (hard cap 2000), across all refs. The `projects/<slug>` folder inside the Harness repo is not the code repository of a story.
- The result is a claim that a commit mentions the story. The reader verifies that the SHA exists in the repository; it does not prove that the commit really implements the story.

## Co-author and attribution lines

`Story:` and the attribution trailer (`Co-Authored-By:`) must be in the SAME last paragraph, on adjacent lines, with no blank line between them. `git interpret-trailers --parse` applies the same rule.

```
Story: 18.07
Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Wrong (verified with `parseTrailers`): a blank line between them makes `Story:` a paragraph of its own and `Co-Authored-By:` the last one, so the story is NOT read and the commit gets no link:

```
Story: 18.07

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Order does not matter as long as both lines are in the last paragraph. Check a message before committing with `git interpret-trailers --parse < message.txt`: the output must list the `Story:` line.

## Where this lives, and what was not changed

- The installed `commit` skill (`~/.claude/skills/commit`) is generated from the DAI repository by its export scripts. DAI is read-only for this work and an edit to the installed copy would be overwritten at the next sync, so the skill was not edited. This file is the Harness-side source of truth; a pointer from the skill is a request to the DAI owners.
- An optional `commit-msg` hook may only warn when a Scrum project commit has no `Story:` line; it must never block (story 18.25, decision in doc 11 section 6).
