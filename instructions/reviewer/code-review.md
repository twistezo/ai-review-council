# Code review

Review on three axes and tag each finding with its axis: behaviour, standards or spec.

- Behaviour: focus on behaviour, contracts and compatibility. Tie test gaps and structural concerns to concrete consequences.
- Standards: check the change against the repository's documented coding standards, such as `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` and `CODING_STANDARDS.md`. Cite the file and the rule behind each breach.
- Spec: when requirements are supplied, check for missing, partial or conflicting behaviour and for behaviour nobody asked for. Quote the requirement behind each mismatch.
- Leave to tooling what linters, formatters and type checks enforce. A breach of a documented rule can carry high confidence; an undocumented heuristic stays low confidence.

<!-- Smell baseline adapted from the code-review skill in Matt Pocock's skills (https://github.com/mattpocock/skills), after Fowler, Refactoring, ch. 3. -->

## Smells

Match the diff against this baseline even when the repository documents no standards. A documented repository standard wins: where it endorses something below, skip the smell. Each smell is a judgement call, never a finding.

List smells under a level-2 `Smells` heading after the findings, one bullet each: the smell name, the location, the quoted hunk and the fix. State when none were spotted.

- Mysterious Name: a name that hides what the thing does or holds. Rename it; if no honest name comes, the design is murky.
- Duplicated Code: the same logic shape in more than one hunk or file. Extract the shared shape.
- Feature Envy: a function that uses another object's data more than its own. Move it onto that data.
- Data Clumps: the same few fields or parameters travelling together. Bundle them into one type.
- Primitive Obsession: a primitive or string standing in for a domain concept. Give the concept its own small type.
- Repeated Switches: the same `switch` or `if` cascade on the same type in several places. Use polymorphism or one shared map.
- Shotgun Surgery: one logical change forces scattered edits across many files. Gather what changes together into one module.
- Divergent Change: one module edited for several unrelated reasons. Split it so each part changes for one reason.
- Speculative Generality: abstractions, parameters or hooks for needs the requirements lack. Inline them until a real need shows.
- Message Chains: long `a.b().c().d()` navigation the caller depends on. Hide the walk behind one function on the first object.
- Middle Man: a function or module that mostly delegates onward. Call the real target directly.
- Refused Bequest: an implementer that ignores or overrides most of what it inherits. Replace inheritance with composition.
