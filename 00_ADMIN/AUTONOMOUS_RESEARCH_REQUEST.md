# PROJECT LEVI — Autonomous Research Agent

Set this up as a Codex Automation that runs **every hour**.

Use this existing PROJECT LEVI thread and repository so every run inherits the current state of the investigation.

The goal is to continuously improve the LEVI-FRADY-CASE research archive while I am away.

This is NOT simply an hourly Google search for "Levi Frady."

The recurring loop is:

**ASSESS → PRIORITIZE → RESEARCH → ACQUIRE → INGEST → VALIDATE → CROSS-REFERENCE → SYNTHESIZE → UPDATE → REPEAT**

---

## START OF EVERY RUN

Read the current project state before doing internet research.

Inspect:

- source inventory
- claims register
- contradiction register
- timeline/events
- people
- organizations
- evidence
- witness statements
- locations
- assets/images
- `WANTED_SOURCES.md`
- `OPEN_QUESTIONS.md`
- Discovery Inbox
- previous research-run logs
- recently ingested Markdown/PDF/media
- visual-board data
- `research_queue.md` if it exists

Understand what we already possess before searching.

Never start each run from scratch.

---

## CHOOSE THE BEST RESEARCH TARGET

Identify the unresolved research targets with the highest expected investigative value.

Prioritize roughly:

1. primary government/court records available publicly online;
2. original case documents already reproduced or archived elsewhere;
3. contemporary 1997–2001 reporting;
4. original interviews, recordings and video;
5. photographs and documentary assets;
6. underlying sources cited by secondary reporting;
7. corroboration/contradiction of consequential claims;
8. unresolved names, dates, locations, agencies, documents and case numbers;
9. later professional reporting;
10. speculative/community material only for SOURCE DISCOVERY.

Do not repeatedly perform generic searches that previous runs have already exhausted.

Use previous failed-search logs when choosing what NOT to repeat.

---

## RESEARCH STRATEGICALLY

Use internet research.

Search beyond simply:

`"Levi Frady"`

Use combinations of:

- names
- dates
- exact quotations
- article headlines
- investigators
- agencies
- locations
- roads
- court cases
- warrant numbers
- document titles
- distinctive phrases
- newspaper archives
- government archives
- court indexes
- archived webpages

Follow promising source chains.

Example:

secondary article  
→ cites 1997 newspaper  
→ newspaper quotes investigator  
→ investigator references report  
→ report becomes acquisition target.

Prioritize reaching the earliest/original source available.

Do not bypass authentication, paywalls, access controls or other technical restrictions.

---

## BEFORE ADDING ANYTHING

Check whether we already possess it.

Use:

- URL
- normalized title
- publication date
- filename
- hashes
- existing SRC IDs
- underlying source

to detect duplicates.

Five websites repeating one original report are NOT five independent confirmations.

Maintain source-dependency relationships.

---

## ACQUIRE + INGEST

When useful material is discovered, process it using the project's existing ingestion protocols and filesystem architecture.

Preserve provenance.

Update relevant records:

- `SRC-`
- `CLM-`
- `EVT-`
- `PER-`
- `ORG-`
- `LOC-`
- `EVD-`
- `WIT-`
- `CON-`
- `AST-`

Archive useful webpages/documents/media locally where technically and legally practical.

Preserve original URLs.

Do not modify original source material.

If only a URL/reference can be preserved, record that rather than fabricating a local copy.

Extract useful images/assets when available and retain their source attribution.

---

## VALIDATE IMPORTANT DISCOVERIES

For consequential information:

- identify the actual speaker/source;
- distinguish firsthand from secondhand;
- distinguish contemporary from retrospective;
- distinguish journalism from primary documentation;
- compare against existing claims;
- search for independent corroboration where warranted;
- identify contradictions;
- determine whether apparently separate sources actually derive from the same underlying source.

Never silently resolve contradictions.

---

## SOURCE INTEGRITY

Maintain our existing evidence standards.

Never infer guilt.

Never convert allegations into facts.

Never identify someone as a suspect unless an authoritative source supports that characterization.

Do not treat repetition as corroboration.

Do not treat AI analysis as evidence.

Reddit, Websleuths, podcasts, blogs and similar sources may be used for:

**SOURCE DISCOVERY**

but should not automatically be treated as authoritative evidence.

Any information originating there must retain that provenance until independently supported.

---

## RECURSIVE RESEARCH

New discoveries should create new research targets when appropriate.

Example:

ARTICLE
→ identifies investigator
→ investigator gave another interview
→ interview mentions evidence
→ evidence references report
→ report becomes wanted source
→ report provides timestamp
→ timestamp conflicts with timeline
→ seek contemporary corroboration
→ update contradiction register.

Follow productive chains.

Do not wander indefinitely down weak speculative branches.

---

## IMPROVE THE CASE EACH RUN

Every run should attempt to accomplish at least one meaningful improvement:

- acquire a new source;
- locate an underlying source;
- strengthen provenance;
- resolve source dependency;
- improve the timeline;
- identify a meaningful contradiction;
- corroborate an existing claim;
- weaken/question an existing claim;
- locate original media;
- improve a person/location/evidence record;
- identify an important missing document;
- surface a strong new research question.

**QUALITY > QUANTITY.**

Do not add material merely to increase database size.

---

## MAINTAIN THE RESEARCH QUEUE

Create/maintain:

`15_AI_WORKSPACE/research_queue.md`

Use priorities:

### P0
Potentially case-changing / critical source

### P1
High investigative value

### P2
Useful supporting research

### P3
Speculative / low priority

Future automation runs should use this queue to determine what to investigate next.

Update:

`WANTED_SOURCES.md`

and:

`OPEN_QUESTIONS.md`

as discoveries change our priorities.

---

## RECORD FAILED SEARCHES

This is important.

Record meaningful unsuccessful searches so future runs do not repeatedly waste time on the same approach.

Include:

- target
- queries/strategies attempted
- archives searched
- result
- possible alternative approach
- whether the target should remain active

A failed search is useful research state.

---

## UPDATE THE VISUAL BOARD

After meaningful ingestion, synchronize the visual research board/database using the project's established sync process.

New supported entities and relationships should become available in the board.

Uncertain material belongs in the Discovery Inbox.

Researcher hypotheses must remain separate from sourced relationships.

Never convert an AI/researcher connection into an evidentiary connection.

---

## CREATE A RUN LOG

Create one concise log for every automation run.

Include:

### TARGET
What this run attempted to answer/acquire.

### SEARCHES
Important search strategies and archives used.

### ACQUIRED
New meaningful sources/documents/assets.

### FINDINGS
Important new information.

### CORROBORATION
Existing claims strengthened.

### CONTRADICTIONS
New or changed conflicts.

### LEADS
New research directions.

### FAILED SEARCHES
Important things searched for but not found.

### FILES UPDATED
Registers/archive files modified.

### NEXT TARGETS
Best research directions for the next automation run.

Keep these reports concise.

---

## STOP / DEPRIORITIZATION RULES

If a search path repeatedly produces nothing useful, lower its priority.

If a source clearly requires an Open Records request or offline retrieval, stop repeatedly searching for it.

Instead:

1. add the exact document to `WANTED_SOURCES.md`;
2. identify the likely custodian;
3. record why we believe the document exists;
4. suggest the appropriate acquisition method.

If identity is uncertain, do not merge people.

If evidence is ambiguous, send it to human review.

---

# AUTOMATION REQUIREMENTS

Create this as a recurring **hourly Codex Automation** associated with this PROJECT LEVI work.

Reuse this project/repository and existing research state.

Do not create a disconnected research project.

Each run must inspect the work produced by previous runs before choosing its next task.

If local execution requires this computer to remain awake/available, configure the automation as far as possible and clearly tell me what needs to remain running.

Once configured, tell me:

1. whether the automation is active;
2. its schedule;
3. whether it is executing locally or in the cloud;
4. what files/project state it will access;
5. where completed-run reports will appear;
6. whether any permissions or approvals may interrupt unattended runs.

Then perform an initial research run now so we can verify the complete loop works.

# CORE PRINCIPLE

**BUILD KNOWLEDGE, NOT VOLUME.**

Every run should leave PROJECT LEVI more accurate, better sourced, more interconnected and easier to investigate than it was before.