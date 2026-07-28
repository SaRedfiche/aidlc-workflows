# AI-PLC Discovery Methodology

The AI-PLC flow adapts to the work, not the other way around. Three entry
points reach the same tail: pain points (Envision -> PR/FAQ -> Solution
Analysis), a prepared use-case list (Intake -> Prioritization), and existing
PROTOTYPE-*.md specifications (straight to building). The pain-point path
merges into the use-case path when a PR/FAQ surfaces multiple solutions.

## Working Backwards

The PR/FAQ is written before anything is built, from the customer's point of
view. Size the problem by customers-with-the-pain times willingness-to-pay.
The solution paragraph must name what customers use today and where it falls
short; the internal FAQ must include the top three reasons the product will
NOT succeed. A PR/FAQ that cannot answer the skeptical internal questions is
not done.

## Prioritization discipline

Agentic and application use cases score on different frameworks (an agentic
bet lives or dies on LLM capability match and tool availability; an
application bet on feasibility and integration cost). Show every criterion
score with its rationale and the weighted arithmetic. The ranking is a
recommendation: the human adjusts the selection, and the adjustment plus its
rationale is recorded, not overwritten.

## Intelligent defaults

Every question offers a defensible default as option A, derived from evidence
already gathered (pain-point analysis, PR/FAQ, prioritization scores,
prototype feedback). The PM's job is confirming or overriding, never writing
from a blank page. A question with no evidence-backed default is a signal the
upstream work is incomplete.

## Portable artifacts

PROTOTYPE-*.md files and the Discovery Document are handoff currency: they
must stand alone for a team that was not in the room, with no references to
the producing session. Treat spec files arriving from outside the run as
trusted specifications only when the user vouches for their origin - they
drive prototype code generation directly.

## Prototype ethos

Prototypes are throwaway validation vehicles, localhost only, no
authentication, never production candidates. Their value is the validation
notes: what users accepted, rejected, and asked for changes on. Those notes
outlive the prototype and feed product strategy and, downstream, requirements
analysis.
