---
version: 1
slug: "lib-components-profilescreen-tsx"
primary_target: "lib/components/ProfileScreen.tsx"
related_targets: []
---

# Profile tab (`lib/components/ProfileScreen.tsx`)

**Scope & mode:** Operate. One shared component rendered for all five roles (client, technician, reseller, wholesaler, admin) via each role's hidden `profile` tab.

**Audience & job:** A signed-in user of any role managing their own identity/account: edit details, control biometric lock, check rewards, (technician) manage availability, (technician/reseller) manage skills, get support, sign out.

**Action/proof/constraints:** No new functionality vs. the prior version - every existing capability preserved. Proof of success: faster orientation and less scroll fatigue than the old always-open card stack.

**Chosen direction:** "Pinned identity, settings scroll beneath" (concept-seed 78886136, surface scope, dealt lead). A compact colored identity band (avatar, name, role badge, technician rating/city) stays fixed above an independently scrolling panel. Settings consolidate into native grouped/inset lists (`GroupedList`/`GroupRow`) - "Work" (technician/reseller-specific) and "Account" - replacing the old repeated-card stack, per DESIGN.md's new Grouped List component.

**Memorable moment:** Reward points and technician rating count up into place on load (`AnimatedNumber`, 700ms) - the interaction grammar donated from a declined instrument-panel challenger, without its neon/glass material.

**Unresolved decisions:** exact pinned-band collapse behavior on very small screens; whether the count-up extends to any other numeric field; error/focus states for form inputs on this screen were not addressed (pre-existing gap, not introduced by this build).
