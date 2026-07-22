# Tatil Phase 0 — Internal Crib Sheet
**INTERNAL ONLY. NEVER SEND THIS TO TATIL.** Contains pricing positions, walk-away thresholds, and negotiating posture.
**Date:** 2026-07-22 · **Author:** Claude-web · **Companion doc:** `docs/strategy/azure-edition-architecture-costs-pricing-2026-07.md`
**⚠ §5 of this document SUPERSEDES §4 of the strategy doc.** Rev B was priced at 350 seats; actual current headcount is 190.

---

## 1. What this meeting is and isn't

**It is:** a technical discovery meeting with Tatil's IT/infrastructure lead to establish what "data on our servers" actually requires, whether Azure satisfies it, and what integration they genuinely expect.

**It is not:** a sales meeting. **Do not quote a price.** Pricing follows in a written proposal once you know the answers below. Quoting early, before you know whether they need on-premises hardware or SOC 2 certification, means either underpricing a hard deal or spooking an easy one.

**Who you want in the room:** the IT/infrastructure lead, and ideally whoever administers their Microsoft tenant. Senior management being there is fine but they can't answer most of this. If only senior management shows up, treat it as a scoping conversation and ask for a follow-up with IT — don't try to force answers out of people who don't have them.

**Your posture:** you are a vendor doing professional discovery, not a supplicant. You are asking these questions because you build things properly. That framing is accurate and it's also the correct commercial position.

---

## 2. The expectation reset — do this in the first five minutes

Senior management asked about linking to **Dataverse**. Your answer is **Azure SQL**. If anyone believes their data will live in Dataverse, correct it now — surfacing it at contract time reads as a bait-and-switch.

**The script (adapt, don't recite):**

> "One thing I want to correct early, because it came up in the last meeting. I looked hard at putting AgencyTrack's data directly in Dataverse, and I'm recommending against it — for your benefit, not mine. Microsoft's licensing rules mean every agent touching data through Dataverse needs a Power Platform licence, even when the access goes through an application account. At your headcount that's somewhere between TTD 155,000 and 309,000 a year on top of everything else, and it grows as you recruit.
>
> What I'm proposing instead is Azure SQL, running in your own Azure subscription. The data is still entirely in your tenant, under your security policies, on your Microsoft agreement. Power BI, Excel, and Power Automate all connect to it directly, the way they'd connect to any enterprise database. You get the same visibility across your Microsoft tools without the per-agent licensing."

**🎯 HEADLINE FOR THE PROPOSAL: zero incremental Microsoft licensing.** Their existing estate covers everything AgencyTrack needs — E1 for agent sign-in, E3/E5 already held above that, Power BI Pro already included where it matters. Against the Dataverse route at TTD 155,000–309,000/yr, that contrast is concrete rather than theoretical.

**⚠ The sharpest version of this argument — CONFIRMED 2026-07-22:** every Tatil agent holds an **E1 licence**, the entry-level enterprise tier. So:

> "Power Apps Premium is US$20 per user per month. That's more, per agent, than their entire Microsoft 365 licence costs you today. You'd be more than doubling your per-agent Microsoft spend to get a database you don't need."

Tatil deliberately chose the cheapest per-agent tier for the advisor force. That tells you they are cost-conscious about per-seat licensing, and it makes this argument land far harder than an abstract annual figure. Lead with it.

**Why this lands:** you're the vendor telling them how to spend less. It buys enormous credibility for everything that follows.

**Have the numbers ready** (from strategy doc §3a): Power Apps Premium is US$20/user/month; Pay-As-You-Go is ~US$10/active user/month. Microsoft pulled the old US$5 Per App plan from the licensing guide in January 2026 for most channels, and the discounted US$12 enterprise rate needs 2,000+ seats — Tatil doesn't qualify at any realistic headcount.

| At | Premium route | PAYG route |
|---|---|---|
| 190 agents | ~TTD 309,000/yr | ~TTD 155,000/yr |
| 350 agents | ~TTD 570,000/yr | ~TTD 285,000/yr |

---

## 3. Questions — grouped, with what you're listening for

### A. Data residency — the requirement that drives everything

**A1. When you say the data must be on your servers, do you mean your Azure tenant, or physical hardware in your building?**
→ *Want:* their Azure tenant. Everything in the plan works.
→ *Bad:* physical on-premises. You become responsible for their server environment, patching, backups, and uptime. Cost and risk multiply and it's a fundamentally different business. Not an automatic no, but it must be priced as a different product.

**A2. ⚠ Is there a requirement that data physically resides in Trinidad and Tobago?**
→ **This is the single biggest dealbreaker in the meeting.** There is no Azure region in T&T; the nearest are in the United States. If in-country residency is a hard regulatory requirement, Azure does not solve it and neither does any major cloud — you'd be back to physical on-premises.
→ Ask it plainly and get a plain answer. Do not let it stay ambiguous.

**A3. What's driving the requirement — internal policy, Central Bank supervision, the Data Protection Act, group policy from a parent company?**
→ You need the actual source. "Policy" you can design around; a specific regulatory citation you must design *to*. Ask them to send you the clause.

**A4. Which Azure subscription would host this — existing or newly provisioned? Who administers it?**
→ Determines who holds the keys and how your deployment access works. You need *some* access to deploy and support; establish early that this is normal and negotiable (time-boxed, audited, revocable).

### B. Identity — the assumption most likely to be wrong

**B1. ✅ ANSWERED — all 190 agents hold Microsoft 365 E1 licences.**
→ The SSO story holds. Custom app registration and OIDC sign-in are **Entra ID Free** capabilities; agents do not need a premium tier to log into AgencyTrack with their Tatil account. IT manages joiners and leavers centrally. E1 being web-only is a mild advantage — the advisor force already works browser-first, which is what AgencyTrack is.
→ Confirm in the meeting only that this covers *all* advisors including any newly contracted ones, and that new advisors get an account as part of onboarding.

**B1a. ✅ ANSWERED — the estate is tiered, and it maps onto the role hierarchy:**

| AgencyTrack role | Licence | Entra tier | Power BI Pro |
|---|---|---|---|
| Agent (190) | E1 | Free | ✗ |
| Unit / Branch Manager | E3 | P1 | ✗ |
| Sales Manager, Tenant Admin | E5 | P2 | ✓ included |

→ Confirm in the meeting only that Unit Managers sit in the E3 band rather than E1 — it changes the Conditional Access picture for that group.
→ **Read this as intelligence, not just data:** an estate tiered this deliberately means Tatil's IT function is competent and intentional about licensing. Their security review will be substantive and they will respond well to architectural precision. Be technical with them; do not simplify.

**B1b. ⚠ CONDITIONAL ACCESS GAP — raise this yourself, don't wait for security review to find it.**
→ E3 and E5 include Entra ID P1/P2, so managers and executives *can* be covered by Conditional Access policies. **The 190 agents on E1 cannot** — Free tier has no Conditional Access, and CA is licensed per user.
→ This is awkward because the agents are the highest-risk population: personal devices, field work, prospect PII. Covering them = Entra ID P1 at ~US$7/user/month post-July-2026 increase ≈ **TTD 108,000/yr** for 190 agents.
→ **Offer application-layer compensation instead:** short session lifetimes, no persistent refresh tokens, re-authentication on sensitive actions. Costs nothing, may satisfy the reviewer without a P1 purchase, and demonstrates you've thought about it. Raising this proactively is a credibility win — it's plainly their cost, not yours.

**🔒 ARCHITECTURAL RULING this settles — authorization stays in AgencyTrack.**
Entra authenticates ("this is Kyron"); AgencyTrack's own tables authorize ("Kyron is a Branch Manager for tenant X"). Mapping the Agent → Unit Manager → Branch Manager → Sales Manager → Tenant Admin hierarchy onto Entra security groups would require group-based assignment, which is a **P1 feature Tatil does not have**. Keeping roles in application data is the free path, matches current behaviour, and is the standard pattern regardless. Fold into strategy doc Rev C; it is also directly relevant to §7 of the migration recon.

**B2. Would you register the application in your own Entra directory?**
→ *Want:* yes. It's cleaner for them and better for you — they own the registration, which reinforces the "we hold the keys" story.

**B3. What conditional access and MFA policies apply? Any device compliance requirements?**
→ Agents work from phones, often personal devices. If their policy blocks unmanaged devices, that's a genuine adoption problem to surface now, not at rollout.

### C. Microsoft licensing — the two surviving cost lines

**C1. ✅ ANSWERED — Power BI Pro is included for Sales Managers and up (E5). Cost line is ZERO if handled correctly.**

⚠ **The viewer trap:** in Power BI, *viewers* need a Pro licence too — not just the report author. If a Sales Manager (E5, has Pro) publishes a report and wants Branch Managers (E3, no Pro) to open it, each of those managers needs Pro at US$14/month. That's ~20–30 people ≈ **TTD 28,000/yr materialising from nowhere.**

→ **The answer is architectural and you already have it:** managers consume reporting *inside AgencyTrack* — the Strategic Plan dashboard, Master Sheet, persistency and funnel views exist for exactly these people. Power BI stays optional, available to the E5 layer who already hold Pro if they want to build their own analyses on top.
→ Say it that way in the room and the Power BI line stays at zero. If you let it drift toward "we'll deliver your reporting through Power BI," you have just invented a cost for your own customer.

**C2. Confirm nobody is planning to make Power BI the primary reporting surface for managers.**
→ Same point from the other direction. Watch for someone in the room assuming the deliverable is Power BI dashboards. The deliverable is AgencyTrack; Power BI is a connected extra.

**C3. Do you intend to build Power Automate flows against this data?**
→ The SQL Server connector is a *premium* connector. Flow builders need Power Automate Premium (~US$15/user/month) or per-flow licensing. Affects a handful of people, never the agents — but don't let it surface as a surprise later.

**C4. Confirm: no Power Platform or Dataverse licensing is assumed for the agent population.**
→ Close the loop on §2 explicitly and get it acknowledged.

### D. Scale, growth, and scope

**D1. Confirm the current licensed advisor count and the growth plan — timeline to 350?**
→ Drives pricing structure (§5). You've been told 190 now, 350 target. Get the *timeline* — 350 in two years is a very different deal from 350 "eventually."

**D2. Beyond advisors, how many head-office, admin, and management users?**
→ These are seats too. Easy to forget and easy to leave money on the table.

**D3. Is TATIL General a separate entity? Any interest in extending this to them?**
→ A scoping question that's really a revenue question. Separate legal entity = separate licence. Plant the idea; don't push it.

### E. Integration — bigger than Dataverse

**E1. What other systems must AgencyTrack read from or write to?**
→ The real integration question. Policy administration system, commission engine, underwriting — these matter far more than Power BI. Get names and vendors.

**E2. Is there an existing agency management system being replaced? What data has to migrate out of it?**
→ Directly sizes your implementation fee. Also tells you who your incumbent competitor is.

**E3. Is there a policy admin system of record that AgencyTrack must not contradict?**
→ Data ownership and sync-direction questions. Avoid becoming a second source of truth for policy data.

### F. Security and procurement — the timeline killers

**F1. What's your security review process for a new vendor, and how long does it typically take?**
→ Budget emotionally and financially for 6–18 months. Ask this so the answer is theirs, not your assumption.

**F2. Do you require penetration testing, SOC 2, ISO 27001, or equivalent?**
→ ⚠ **Listen carefully.** A pen test is buyable (US$5–15k). SOC 2 as a solo founder is a 6–12 month, five-figure exercise and may be genuinely out of reach right now. If SOC 2 is mandatory, that's a serious obstacle — say you'll come back with a plan rather than committing on the spot.

**F3. Will you require source code escrow?**
→ Raise it yourself if they don't. It pre-empts the "what if you get hit by a bus" question and makes you look like you've done this before.

**F4. Direct engagement, or does this need to go through a formal RFP?**
→ RFP means months, competitors, and procurement theatre. Worth knowing before you invest.

### G. Commercial — ask late, ask lightly

**G1. Is there budget allocated for this, and in which fiscal year?**

**G2. Whose budget line is it — IT, or Sales/Agency?**
→ **Matters more than it sounds.** If it's the agency budget, your buyer is sales leadership who already want the product. If it's IT budget, you're competing against infrastructure priorities and a CIO who didn't ask for this. It changes who you sell to for the rest of the process.

---

## 4. Dealbreakers and hard signals — what to do if you hear them

| You hear | Reality | Response in the room |
|---|---|---|
| "Data must physically be in Trinidad" | Azure has no T&T region. Plan doesn't work. | Don't argue. "That's important — let me come back to you on what that would require." Then reassess seriously. |
| "Our agents aren't on our M365" | SSO story weakens, cost and complexity rise | "Understood — that changes the identity design, I'll factor it in." Not fatal. |
| "We need SOC 2 before we can proceed" | Out of reach short-term as a solo founder | "Let me come back with a compliance roadmap." Never commit to a certification timeline you can't hit. |
| "We'd need to own the source code" | That's an acquisition, not a licence | "That's a different conversation and a different structure — happy to explore it separately." Price at 8–10× annual licence if serious. |
| "This has to go through a full RFP" | 6–18 months, competitors invited | Fine, but recalibrate your timeline and don't build ahead of it. |
| "Can you start in September?" | They're warm. | Don't over-promise — the migration recon isn't done. "Let me give you a realistic schedule in the proposal." |

---

## 5. Pricing positions — CORRECTED FOR 190 SEATS (supersedes strategy doc §4)

**Do not quote any of this in the meeting.** It exists so you know what you're protecting.

### The problem 190→350 creates

Rev B priced a static 350-seat deployment. Reality is 190 today with 350 as a growth target. Straight band pricing (band 2 now, band 3 when they cross 200) would **penalise them for recruiting** — every advisor past 200 triggers a step change. That's perverse in a product whose stated purpose is helping them recruit and grow, and they will notice.

### Recommended structure: growth-locked flat fee

One annual fee covering **up to 350 seats**, locked for the term. They pay a higher effective rate today and a lower one as they grow — and every advisor they recruit makes the software cheaper per head.

| Position | Annual (TTD) | Per seat/mo @190 | Per seat/mo @350 |
|---|---|---|---|
| **Opening ask** | **600,000** | 263 | 143 |
| **Target settle** | **520,000** | 228 | 124 |
| **Walk-away floor** | **400,000** | 175 | 95 |

Plus **implementation fee: TTD 200,000** one-time (reduced from the 350-seat figure — less training and migration volume). Do not waive it; discount at most.

**Fallback if they reject a flat fee:** band pricing at TTD 460,000/yr up to 200 seats, stepping to TTD 640,000/yr at 201–350, adjusted **at renewal only, never mid-year**. Comparable total value; worse incentive story. Offer it as a choice — buyers like choosing, and both outcomes work for you.

### Modelled deal at target settle

| | TTD |
|---|---|
| Year 1 — implementation 200,000 + licence 390,000 (520k less 25% reference discount) | **590,000** |
| Year 2 — licence at list | **520,000** |
| Year 3 — licence + 5% escalator | **546,000** |
| **3-year TCV** | **≈ 1,656,000** (≈ US$244,000) |

### Why the per-seat rate is higher than the 350-seat figure

Because that is how enterprise software works — per-seat rates rise as volume falls. AgencyBloc charges US$109/user/month whether you have five users or five hundred. At TTD 228/seat/month you are still at roughly **30% of the US comparable rate**, and the growth-lock means it falls to ~TTD 124 as they scale. If challenged, that's the answer, and it's true.

### Talking points if pricing comes up anyway

- All-in cost to Tatil at settle, including their Azure spend: **~TTD 245 per advisor per month today, falling toward TTD 135 at 350 advisors.**
- The architecture choice already saves them TTD 155,000–309,000/year in Microsoft licensing — roughly half the licence fee, before any productivity argument.
- Compare against displaced manual reporting hours, not against software price lists. There is no substitute product configured to Tatil's hierarchy, TTD, their strategic plan deck, and their incentive structures.

### ⚠ Standing strategic risk

TTD 520k/yr from one customer *is* the business. Fine for customer #1 — but Tatil will hold enormous leverage at the year-2 renewal and they'll know it. **Mitigation is commercial, not technical: get a credible second insurer into the pipeline before the first renewal.** The year-1 reference discount exists to buy exactly that — insist on case-study rights, a named referenceable contact, and logo usage in exchange.

---

## 6. What not to say

1. **No price.** Not a range, not a "somewhere around." Discovery first.
2. **No delivery date.** The migration recon isn't complete; you don't yet know the true size of the rebuild.
3. **Don't oversell the Microsoft integration.** You're connecting to Azure SQL as a data source — not living inside Dataverse. Overselling it now is what creates the bait-and-switch you're trying to avoid.
4. **Don't raise the conflict-of-interest topic.** If *they* raise it, you have a strong answer (corporate separation, no vendor access to tenant data enforced in the architecture, contractual clause, data never touching your infrastructure). Have it ready. Don't volunteer it.
5. **Don't agree to anything on the spot.** "Let me come back to you on that" is a complete sentence and costs you nothing.

---

## 7. Post-meeting checklist

1. Written summary to them within 24 hours — what you heard, what you'll confirm. Creates the paper trail and the written confirmation you need.
2. Ask for the regulatory citation (A3) and the security review process doc (F1) in writing.
3. Update strategy doc to **Rev C** once seat count, residency answer, and E3/E5 are confirmed.
4. Only then: write the proposal. Pricing goes in the proposal, not in email, not verbally.
