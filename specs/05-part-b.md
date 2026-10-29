# 05: Part B prep

Inputs: Part A output (`routes.txt`), `data/ops-notes.md` (summarized as N-1..N-4 in 01 §3), and what-if runs.
Reproduce: `npm run what-if -- "#2051" "#2056"` (prints to stdout only; Part A code and `routes.txt` are untouched, and a test checks this).
**Every pick here is `proposed`. You make the final calls.**

## 0. Ops notes and their time windows (ET = UTC−4, EDT until Nov 1, 2026)

| note | who | claim | window (ET) | in effect for today's orders (Tue Oct 20, 09:00–10:15:37 ET)? |
|---|---|---|---|---|
| N-1 | Marco (Ops lead) | WH-NV water damage. "Nothing can ship from NV". Router config still says enabled | from **Mon Oct 19 08:10**, "until further notice, at least through next week" (≥ Fri Oct 30) | **Yes, all orders** (it started 24h+ before the first order and has no end date) |
| N-2 | Keisha (WH-GA lead) | GA short-staffed. "Everything is going out", ~**2 business days** late on picking | from **Mon Oct 19 16:30** "until Monday" (**Mon Oct 26**) | **Yes, all orders.** A Tue order gets picked around Thu Oct 22 |
| N-3 | Marco | *asks* to stop routing to GA until Monday | posted **Tue Oct 20 09:05**. Proposed window → Mon Oct 26 | A request, not a decision → Q2 only. (#2031 at 09:00 and #2032 at 09:03:37 came in before it was even posted) |
| N-4 | Priya (Finance) | GA ≈ 420 orders/day. If GA is off: 70% go ≥2 zones farther (+2 transit days, +$2.35); 30% have a warehouse within 1 zone (+0.5 day, +$0.40) | posted **Tue Oct 20 10:20** (after the last order) | Q2 input only. It describes typical volume, not today's stock |

Order timestamps (UTC → ET): #2033 13:07:14Z → **09:07:14** · #2037 13:18:00Z → **09:18:00** · #2040 13:27:00Z → **09:27:00** ·
#2041 13:30:37Z → **09:30:37** (edit at 09:48:37) · #2045 13:43:14Z → **09:43:14** · #2050 13:57:37Z → **09:57:37** · #2051 14:01:14Z → **10:01:14**.

## 1. What-if: what can actually ship today (N-1 applied, NV off)

The only note that changes **where** an order *can* ship is N-1. N-2 makes GA slower, but GA still ships ("Everything is going out").
Re-running the router with WH-NV disabled (scenario `Q1`; GA unchanged; **Q2 not applied**) changes 6 of 26 lines:

| order | Part A | NV off (N-1) | why |
|---|---|---|---|
| #2036 | WH-NV zone 2 | WH-GA zone 7 | GA z7 < NJ z8 (both hold 2 MAG) |
| #2038 | WH-NV zone 4 | WH-NJ zone 8 (tie: cover) | NJ = GA = z8, NJ has more VITD cover |
| #2043 | WH-NV zone 3 | WH-GA zone 8 | NJ out of MAG |
| **#2051** | WH-NV zone 2 | **WH-GA zone 7** | GA has 1 VITD left, z7 < NJ z8 |
| #2052 | WH-NV zone 5 | WH-GA zone 8 | NJ out of MAG |
| #2056 | WH-GA zone 5 | **PARTNER no_stock** | knock-on effect: #2051 took GA's last VITD. NJ has no MAG |

None of the other six Q1 orders change (traces below).

## 2. Q1: where should each order ship from today?

"Router as it runs today + ops notes that affect where an order can ship". The GA-routing policy (Q2) is **not** applied here.

### Stock at routing time (from `npm run what-if`, scenario Q1, NV off)
| order | lines | NJ | GA | NV | TX |
|---|---|---|---|---|---|
| #2033 (zip3 021) | 1 VITD | z3 · 399/40 · ✔ | z6 · 4/30 · ✔ | z8 · off (N-1) | z7 · disabled |
| #2037 (CA, M5V 2T6) | 1 MULTI | — | — | — | — (international) |
| #2040 (100) | 1 VITD + 1 MAG (bundle) | z2 · MAG **0**/20 ✘ | z5 · VITD 3/30, MAG 147/15 · ✔ | z8 · off | z6 · disabled |
| #2041 (891) | 1 VITD + 1 MULTI (edit) | z8 · VITD 397/40, MULTI 120/30 · ✔ | z7 · VITD 2/30, MULTI 299/25 · ✔ | z2 · off (also MULTI 0) | z5 · disabled |
| #2045 (282) | 1 MAG | z4 · MAG **0** ✘ | z3 · 145/15 · ✔ | z7 · off | z5 · disabled |
| #2050 (303) | 2 VITD | z5 · 396/40 · ✔ | z1 · VITD **1** ✘ | z7 · off | z4 · disabled |
| #2051 (891) | 1 VITD | z8 · 394/40 · ✔ | z7 · 1/30 · ✔ | z2 · off (N-1) | z5 · disabled |

### Answers
| order | router said (Part A) | notes affecting it | options (pros / cons) | proposed |
|---|---|---|---|---|
| **#2033** | WH-NJ zone 3 | none. N-1 doesn't matter (NV was z8, not chosen); N-2 doesn't apply (not GA) | **NJ**: closest eligible, no known problems / — · GA: z6, slower (N-2) · Hold: nothing to decide | **WH-NJ** (proposed) |
| **#2037** | PARTNER international | none (no note covers international) | **Partner**: rule 1, Canadian address (country CA, ON, M5V 2T6) / — · any WH-xx: rule 1 rules out US warehouses | **Partner** (proposed) |
| **#2040** | WH-GA zone 5 | N-2 (GA ~2 business days late), N-1 (NV z8 unavailable) | **GA**: the only warehouse that can ship the whole bundle (NJ has 0 MAG; NV is down per N-1; TX disabled) / ~2 days late (N-2) · Hold: no better option to wait for, just adds delay · Partner: rule 7 only applies when *no* warehouse can take it, and GA can | **WH-GA** (proposed). Tell the customer about the delay |
| **#2041** | WH-GA zone 7 | N-2 (GA late). N-1 changes nothing (NV was already out: MULTI 0) | **GA**: what the router picks; N-2 says GA still ships / pick delay ~2 days · NJ z8: 1 zone farther, no known delay / choosing NJ *because of* N-2 is exactly the Q2 option 3 policy, so it's kept out of Q1 · Hold: no reason | **WH-GA** (proposed) |
| **#2045** | WH-GA zone 3 | N-2. N-1 (NV z7 unavailable) | **GA**: the only eligible warehouse (NJ has 0 MAG, NV down) / ~2 days late · Hold/Partner: nothing better | **WH-GA** (proposed) |
| **#2050** | WH-NJ zone 5 | none affect NJ. N-2 would apply to GA, but GA is ineligible anyway (1 VITD, needs 2) | **NJ**: router's pick, no known problems / z5 although GA is z1 · GA: z1 but short on stock, so it would have to split, which rule 3 forbids | **WH-NJ** (proposed) |
| **#2051** | WH-NV zone 2 | **N-1: NV can't ship** (in effect from Mon 08:10 ET, order at Tue 10:01:14 ET). N-2 applies to the fallback | **GA z7**: what the router picks with NV off / ~2-day pick delay (N-2) and it uses GA's **last VITD**, which leaves #2056 (14 min later) with no source (§1) · **NJ z8**: 1 zone farther, no known delay, and it leaves GA's VITD for #2056 / doesn't follow the rules as written; that's a human override · **Hold**: lets a person weigh GA vs NJ (and why TX is disabled; there's no note about it) / delays an order that has 2 good options | **WH-GA** (proposed): consistent with "router + N-1". **Flag:** if you're OK with a manual override, NJ is better for the customer and for #2056. Your call |
| ~~WH-NV~~ for anything | — | N-1 | shipping from NV is not an option for any order today | — |

## 3. Q2: should the router stop sending orders to WH-GA until Monday?

Every option is simulated on today's 26 orders **with N-1 applied (NV off)**. That's the real network today, and the baseline is option 2.
GA picking delay (N-2) ≈ **+2 business days** on every GA order.

| option | what changes vs option 2 (today's orders) | totals | conflicts with a note? | risks | how to undo |
|---|---|---|---|---|---|
| **1. GA off until Monday** | 18 lines change. **8 domestic orders become `PARTNER no_stock`** (#2036, #2039, #2043, #2045, #2049, #2052, #2054, #2056): with NV down (N-1), NJ has only 2 MAG, so GA is the **only real MAG source**. The rest move to NJ at z5–z8 | NJ 15 · PARTNER 11 | **Contradicts N-4's premise** (it assumes alternatives exist; for MAG they don't today). Not needed per N-2 ("Everything is going out") | sends domestic orders to the international partner (cost unknown); NJ empties fast; N-4 itself says +2 days/+$2.35 for 70%, roughly the same as the 2-day GA delay it tries to avoid | config flip (easy), but orders already sent to PARTNER can't be pulled back |
| **2. Keep GA as normal** | none (baseline). 15 orders at GA, each ~2 days late. #2056 → no_stock (§1) | NJ 7 · GA 15 · PARTNER 4 | none | customers wait ~2 extra days (N-2), which is what Marco wants to avoid (N-3) | nothing to undo |
| **3. Avoid GA only if another warehouse is within 1 zone** | 9 lines change. **5 moved off GA** to NJ at +0–1 zone: #2034 (z5→z5), #2041 (z7→z8), #2044 (z6→z7), #2051 (z7→z8), #2055 (z8→z8). **Knock-on effects:** #2034 uses one of NJ's 2 MAG, so #2039 drops from NJ z1 to GA z5 (worse) and #2040 rises from GA z5 to NJ z2 (better); #2050 gets GA z1 (now has VITD, but late); #2056 is saved (no_stock → GA z5) | NJ 11 · GA 12 · PARTNER 3 | none. It's the 30% case in N-4 (+0.5 day, +$0.40 vs +2 days); today 5/15 = 33% of GA orders, close to Priya's 30% | moving off GA can burn scarce stock elsewhere (#2034 → #2039 above); **must ship together with NV disabled** (see §3a) | **shippable now** (R-17, D-29): unset `AVOID_WAREHOUSE` → option 2. It expires on its own at `AVOID_UNTIL` (order time, D-28) |
| **4. GA off, NV back on** | 19 lines change. **11 orders sent to NV** (#2035, #2036, #2038, #2039, #2043, #2045, #2049, #2051, #2052, #2054, #2056) | NJ 12 · NV 11 · PARTNER 3 | **Directly contradicts N-1** ("Nothing can ship from NV until further notice") | 11 parcels sent to a flooded warehouse: no shipment, no fallback | config flip, but those orders sit at NV until someone re-routes them by hand. **Worst option** |

### 3a. Option 3 in the router (R-17, D-28, D-29)
```bash
AVOID_WAREHOUSE=WH-GA AVOID_UNTIL=2026-10-26T00:00:00-04:00 npm start    # AVOID_MAX_ZONE_DELTA defaults to 1
```
- **Flag off** (default): output == `routes.txt` (test). That's option 2.
- **Flag on + NV disabled (N-1)**: exactly the 9 line changes in the option 3 row above (test: `test/avoid-policy.e2e-spec.ts`).
- **Flag on + Part A config (NV still enabled)**: 9 lines change, but **#2035 and #2054 move to WH-NV zone 5**, which can't ship (N-1). #2051 and #2056 don't change because #2051 already went to NV. **So disable NV in config first, then turn on the flag.**
- Orders created at or after `AVOID_UNTIL` are untouched (test). `AVOID_UNTIL` value = D-28 (**proposed**: start of Monday, ET, exclusive).

### Recommendation (proposed)
**Option 3, now shippable behind config and off by default. Option 2 is the state with the flag off.**
- Option 1 turns "slow" into "can't ship". Option 4 routes to a warehouse that can't ship (N-1). Both are out.
- Option 3 gets the N-4 benefit (≈1.5 days saved at +$0.40) only where it's cheap, and keeps GA for the 70% where moving costs more than waiting.
- Caveat to defend: today it also moved #2039 from zone 1 to zone 5 by using NJ's scarce MAG. A production version should skip a reroute that would take the alternative's last units.

**What I'd tell Marco (draft):**
> Turning GA off would backfire today. With NV down, GA is our only real stock of Magnesium. Turning it off would have sent 8 of this morning's 26 orders to the partner warehouse. Instead, until Monday we move GA orders only when another warehouse is at most one zone farther. That's about a third of GA's volume, at ~+$0.40 and half a day, and those customers skip the 2-day delay. The rest stay at GA, and we tell those customers about the delay. Separately: IT needs to actually disable NV in the router (N-1). Today's config still routes to it.

## 4. Points to defend in the call with Sean
1. **The literal reading in Part A vs reality:** Part A sends 5 orders to WH-NV because the config says enabled (D-17). The fix is a process one: the router config has to be the source of truth, and an outage note (N-1) should become a config change with an expiry, not a chat message.
2. **Greedy routing, one order at a time, is short-sighted:** reserving per order (R-11) means #2051 takes GA's last VITD and #2056 gets nothing (§1). A batch or lookahead allocator, or a reserve buffer for SKUs with low cover, would do better. That's what I'd build with more time.
3. **Data-quality assumptions:** numeric ZIP `2134` padded to `02134` (#2033, D-04); `country` is the only source for international, so `state:"CA"` is California (Q-05); lowercase SKUs normalized (#2045); `invalid_order` instead of hiding bad data as `no_stock` (D-03). Each one is in the decisions log, with a test.
4. **Tie-break details:** cover is measured *before* the order's own reservation (D-10; doesn't change today's output). Exact fraction comparison (D-12). Velocity 0 = infinite cover (D-11). There's no `(tie: priority)` in today's data, so that path is covered by unit tests only.
5. **Checking the AI's work:** the golden file came from an independent throwaway script **in the same AI session**, so it can share a misreading of the rules. Mitigations: the author hand-checks #2033 and #2050 against the raw JSON, the traces are generated by the real engine (`npm run what-if`), and every rule maps to a GIVEN/WHEN/THEN requirement with a test.
