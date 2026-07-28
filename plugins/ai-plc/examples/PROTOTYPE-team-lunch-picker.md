# Team Lunch Picker - Prototype Specification

## Use Case Overview

### Problem Statement
Office teams waste 15-20 minutes every day deciding where to order lunch.
The discussion restarts from scratch daily, loud voices dominate, dietary
restrictions get forgotten, and the same three places win by exhaustion.
Nobody owns the decision, so everybody relitigates it.

### Target Users
Small office teams (5-15 people) that order lunch together several times a
week; the "lunch coordinator" persona who ends up herding the decision.

### Business Value
Medium. Recovers roughly an hour of collective focus time per team per week
and removes a recurring low-grade social friction. Internal-tool economics:
value is time saved, not revenue.

### Success Criteria
- A team reaches a lunch decision in under 2 minutes using the agent
- Dietary restrictions are never violated by a recommendation
- The agent explains WHY it recommended each option
- Repeat use: the same team uses it 3+ days in a row without reverting to chat-based debate

## Agent Requirements

### Purpose
A conversational agent that recommends where the team should order lunch
today: it balances everyone's dietary restrictions, recent history (no
repeats within 3 days), budget, and delivery time, and it defends its
recommendation when challenged.

### LLM Configuration
Provider: not specified - ask at build time (per methodology).
Temperature: default. No fine-tuning; prompt-only behavior.

### Conversation Style
Brisk and lightly funny - it is a lunch decision, not a mortgage. One
recommendation up front with a one-line rationale, alternatives only on
request. Never more than two questions before producing a recommendation.

## Tools (1-2 Simple Tools for Prototype)

### Tool 1: restaurant_lookup
- **Purpose**: Return candidate restaurants matching the team's constraints
- **Implementation**: Query over a hardcoded JSON list of 12 sample restaurants (name, cuisine, price band, delivery minutes, dietary flags: vegetarian/vegan/gluten-free/halal)
- **Input Parameters**: `max_delivery_minutes` (int, optional), `dietary_flags` (list of strings, optional), `exclude` (list of restaurant names, optional)
- **Output Format**: JSON array of matching restaurants with all fields
- **Sample Usage**: `restaurant_lookup(dietary_flags=["vegetarian"], exclude=["Thai Palace"])` -> the 7 entries with vegetarian options, minus Thai Palace

### Tool 2: order_history
- **Purpose**: Record today's decision and report the last 5 decisions so the agent avoids repeats
- **Implementation**: Read/append a local JSON file (`order-history.json`) in the prototype directory
- **Input Parameters**: `action` ("get" | "record"), `restaurant` (string, required when recording)
- **Output Format**: JSON array of `{date, restaurant}` entries
- **Sample Usage**: `order_history(action="get")` -> `[{"date": "2026-07-27", "restaurant": "Thai Palace"}, ...]`

## Frontend Requirements

### Device Target
Desktop (web browser) - this is used at office workstations.

### Key Screens/Views
1. **Chat view** - the conversation with the agent, recommendation cards rendered inline
2. **Team settings** - the team roster with each member's dietary restrictions (editable, persisted locally)

### User Flow
1. Coordinator opens the app; team roster is already saved from last time
2. Types "where should we eat today?" (or just clicks a "Pick lunch" button)
3. Agent asks at most one clarifying question (e.g. budget mood), then recommends one place with rationale + two alternates
4. Coordinator either accepts (agent records it to history) or pushes back ("we had Thai yesterday") and the agent re-picks

### UI Components Needed
- Chat message list with a text input and a "Pick lunch" quick-action button
- Recommendation card (restaurant name, cuisine, delivery estimate, which constraints it satisfies, rationale line)
- Roster editor (name + dietary-flag checkboxes per member)

## Design Context

### Brand Reference
None - generic modern design.

### Style Guidelines
Clean modern look: neutral palette with a single warm accent color, rounded
cards, system font stack. Feels like a friendly internal tool, not a
consumer app.

### Design Notes
The recommendation card is the hero element - it should read at a glance.
Dietary-restriction violations are impossible by construction, so no warning
UI is needed; show which flags each recommendation satisfies instead.

## Sample Interactions

### Interaction 1: The daily pick
User: "where should we eat today?"
Agent: "Given Sam's vegan flag and that you did Thai Palace yesterday: **Green Bowl** (vegan-friendly, 20 min, $$) - everyone can eat there and it's been 6 days since the last visit. Alternates: Burrito Bros, Falafel Hut. Lock it in?"

### Interaction 2: The pushback
User: "nah, people are sick of bowls"
Agent: "Fair. **Burrito Bros** then - build-your-own covers the vegan flag, 25 min, and it's never appeared in your history. Locking it unless you object."

### Interaction 3: The constraint change
User: "Priya joined the team, she's gluten-free"
Agent: "Added Priya (gluten-free) to the roster. That drops Noodle House from the viable list - down to 9 places that work for everyone. Doesn't change today's pick: Burrito Bros has GF tortillas."

## Deployment

### Local Development
Run on localhost, port 3000 (or the next free port). Single command start
preferred (e.g. one script that starts backend + serves the frontend).

### Dependencies
Keep minimal; whatever the build stage selects. Agent SDK optional - a
mocked agent (hardcoded recommendation logic over the same tools) is an
acceptable fallback per the methodology.

### Environment Variables
Provider API credentials only, supplied via the environment at build time -
never embedded in code, never pasted into chat.

## Testing & Validation

### Test Scenarios
1. Team with one vegan member: every recommendation carries the vegetarian or vegan flag
2. Yesterday's restaurant is never recommended today
3. Adding a roster member with a new restriction narrows subsequent recommendations
4. "Pick lunch" with no clarifying answer still produces a recommendation (defaults applied)

### Acceptance Criteria
- Recommendation appears within one exchange for the happy path
- History file records accepted picks and influences the next day's pick
- Roster edits persist across a page reload

## Notes

### Assumptions
- Single team per deployment; no auth, no multi-tenancy (prototype posture)
- The 12-restaurant sample list is realistic enough to exercise every dietary flag

### Constraints
- Localhost only; never expose publicly (holds provider credentials, has no auth)

### Future Enhancements
- Real restaurant data via a delivery-platform API
- Slack integration so the pick lands in the team channel
- Voting mode for contested picks

## Metadata
- **Created By**: AI-PLC discovery (sample spec for testing the ai-plc plugin)
- **Source**: Hand-authored test fixture following prototype-md-format.md
- **Prioritization Rank**: n/a (test fixture)
- **Related Documents**: none
