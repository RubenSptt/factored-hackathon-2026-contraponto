"""Business case estimate for the Card Support agent (Q12).

Turns the Q12 results (measured in Snowflake) and a short list of explicit
assumptions into three scenarios: conservative, base and optimistic, for two
designs of the agent:

- as built: the submitted agent, with no language model in the loop (a local
  intent classifier, rules and tools), so each conversation costs only its
  infrastructure;
- with an LLM: the original AWS target design, a Claude agent on AgentCore,
  where tokens per conversation drive the cost.

Measured inputs live in MEASURED and come from Q12 / profile_core.md.
Everything in ASSUMPTIONS is a team assumption with its source; change it
there and re-run. Standard library only: no new dependencies.

Usage:
    python business_case_estimate.py            # print the tables
    python business_case_estimate.py --svg PATH  # also write the chart
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, replace

# ---------------------------------------------------------------------------
# Measured in the data (Q12, run 2026-10-05; profile_core.md; Q08)
# ---------------------------------------------------------------------------
DAYS_IN_DATA = 1098  # Q12 block 2: 2023-06-17 .. 2026-06-18
YEARS_IN_DATA = DAYS_IN_DATA / 365

# Q12 block 3, card holders only. Card holders and non-holders show the same
# rates (+-0.5 pt), so the segment only sizes the volume.
CATEGORIES = {
    #             contacts  mean s  resolved  simple pool (resolved, no follow-up)
    "Técnico": (62_484, 360.8, 0.698, 0.594),
    "Producto": (91_418, 266.5, 0.897, 0.762),
    "Queja": (71_138, 434.4, 0.437, 0.371),
}
UNRECOGNIZED_CHARGES_CARD_HOLDERS = 7_620  # Q12 block 4 / profile_core.md
CARD_SHARE_OF_PORTFOLIO = 140_040 / 400_000  # Q08: cards / all products

# ---------------------------------------------------------------------------
# Assumptions (never measured facts)
# ---------------------------------------------------------------------------
# Bedrock prices, USD per million tokens (platform.claude.com pricing, read
# 2026-10-03). Regional endpoints carry a 10% premium over global ones.
PRICES = {
    "Claude Haiku 4.5 (global)": (1.00, 5.00),
    "Claude Sonnet 4.5 (global)": (3.00, 15.00),
    "Claude Sonnet 4.5 (regional)": (3.30, 16.50),
}
# Prompt caching: a cache read costs 10% of the input price (same source).
# Cache writes (1.25x, once per conversation) are left out: small next to reads.
CACHE_READ_FACTOR = 0.10
SMALL_MODEL = "Claude Haiku 4.5 (global)"
# AgentCore runtime + gateway + Lambda + DynamoDB per conversation: about one
# cent (AgentCore pricing page, read 2026-10-03; CPU billed only while active).
INFRA_PER_CONVERSATION_USD = 0.01


@dataclass(frozen=True)
class Scenario:
    name: str
    product_weight: float  # share of "Producto" contacts treated as card contacts
    containment: float  # share of the simple pool the agent closes safely
    hourly_cost_usd: float  # fully loaded nearshore agent hour
    after_call_work: float  # extra handling time not in duration_seconds
    model: str
    input_tokens: int  # per conversation, whole conversation
    output_tokens: int
    cached_input_share: float = 0.0  # input tokens served from the prompt cache
    small_model_share: float = 0.0  # model calls routed to SMALL_MODEL


# Conservative = every assumption against the agent; optimistic = in favour.
SCENARIOS = [
    Scenario("conservative", 0.0, 0.30, 12.0, 0.00, "Claude Sonnet 4.5 (regional)", 120_000, 8_000),
    Scenario("base", CARD_SHARE_OF_PORTFOLIO, 0.50, 15.0, 0.15, "Claude Sonnet 4.5 (global)", 60_000, 4_000),
    Scenario("optimistic", 1.0, 0.70, 20.0, 0.30, "Claude Haiku 4.5 (global)", 30_000, 2_000),
]

# Same pessimistic business inputs as "conservative", with three design levers:
# prompt caching, Haiku for 80% of model calls (Sonnet only to confirm the
# block and write the handoff) and shorter conversations (quick actions in the
# UI call endpoints directly instead of the model).
MITIGATED = Scenario(
    "conservative + levers", 0.0, 0.30, 12.0, 0.00, "Claude Sonnet 4.5 (regional)", 60_000, 4_000,
    cached_input_share=0.70, small_model_share=0.80,
)


def as_built(s: Scenario) -> Scenario:
    """The same scenario for the submitted agent: no model call, infrastructure only."""
    return replace(s, name=f"{s.name}, as built", input_tokens=0, output_tokens=0)


def agent_cost_per_conversation(s: Scenario) -> float:
    big_in, big_out = PRICES[s.model]
    small_in, small_out = PRICES[SMALL_MODEL]
    k = s.small_model_share
    p_in = k * small_in + (1 - k) * big_in
    p_out = k * small_out + (1 - k) * big_out
    p_in *= (1 - s.cached_input_share) + s.cached_input_share * CACHE_READ_FACTOR
    return s.input_tokens * p_in / 1e6 + s.output_tokens * p_out / 1e6 + INFRA_PER_CONVERSATION_USD


def human_cost_per_contact(seconds: float, s: Scenario) -> float:
    return seconds * (1 + s.after_call_work) / 3600 * s.hourly_cost_usd


def estimate(s: Scenario) -> dict:
    weights = {"Técnico": 1.0, "Producto": s.product_weight}
    conv = agent_cost_per_conversation(s)
    attempted = contained = avoided_cost = human_spend = human_resolved = 0.0
    for cat, w in weights.items():
        n, secs, resolved, pool = CATEGORIES[cat]
        per_year = n / YEARS_IN_DATA * w
        per_contact = human_cost_per_contact(secs, s)
        attempted += per_year
        contained += per_year * pool * s.containment
        avoided_cost += per_year * pool * s.containment * per_contact
        human_spend += per_year * per_contact
        human_resolved += per_year * resolved
    agent_spend = attempted * conv
    # Containment at which avoided human cost equals agent spend.
    break_even = s.containment * agent_spend / avoided_cost
    # Unrecognized charges: the agent takes the intake call (verified block +
    # handoff); the dispute stays human. Intake call = mean "Queja" duration.
    uc_per_year = UNRECOGNIZED_CHARGES_CARD_HOLDERS / YEARS_IN_DATA
    intake = human_cost_per_contact(CATEGORIES["Queja"][1], s)
    uc_net = uc_per_year * s.containment * intake - uc_per_year * conv
    return {
        "scenario": s.name,
        "agent_cost_per_conversation": conv,
        "contacts_per_year": attempted,
        "contained_per_year": contained,
        "contained_share": contained / attempted,
        "human_cost_per_resolution": human_spend / human_resolved,
        "agent_cost_per_resolution": agent_spend / contained,
        "net_saving_per_year": avoided_cost - agent_spend,
        "net_saving_per_1000_contacts": (avoided_cost - agent_spend) / attempted * 1000,
        "break_even_containment": break_even,
        "unrecognized_charges_per_year": uc_per_year,
        "unrecognized_charges_net_saving": uc_net,
    }


def print_table(rows: list[dict]) -> None:
    fmt = {
        "agent_cost_per_conversation": "${:,.2f}",
        "contacts_per_year": "{:,.0f}",
        "contained_per_year": "{:,.0f}",
        "contained_share": "{:.0%}",
        "human_cost_per_resolution": "${:,.2f}",
        "agent_cost_per_resolution": "${:,.2f}",
        "net_saving_per_year": "${:,.0f}",
        "net_saving_per_1000_contacts": "${:,.0f}",
        "break_even_containment": "{:.0%}",
        "unrecognized_charges_per_year": "{:,.0f}",
        "unrecognized_charges_net_saving": "${:,.0f}",
    }
    print("| Metric | " + " | ".join(r["scenario"] for r in rows) + " |")
    print("| --- |" + " --- |" * len(rows))
    for key, f in fmt.items():
        print(f"| {key} | " + " | ".join(f.format(r[key]) for r in rows) + " |")


def write_svg(rows: list[dict], path: str) -> None:
    """Dot (base) + whisker (conservative..optimistic) per actor, one shared USD axis."""
    by = {r["scenario"]: r for r in rows}
    actors = [
        ("Human agent", "human_cost_per_resolution", "#eb6834", ""),
        ("Agent as built", "agent_cost_per_resolution", "#2a78d6", ", as built"),
        ("Agent with an LLM", "agent_cost_per_resolution", "#7b8794", ""),
    ]
    w, h, left, right, top = 760, 380, 170, 40, 70
    x_max = 3.5
    sx = lambda v: left + v / x_max * (w - left - right)  # noqa: E731
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        f'font-family="Inter, Segoe UI, Arial, sans-serif">',
        f'<rect width="{w}" height="{h}" fill="#fcfcfb"/>',
        '<text x="24" y="32" font-size="18" font-weight="600" fill="#0b0b0b">'
        "Cost per resolved card contact (USD)</text>",
        '<text x="24" y="54" font-size="13" fill="#52514e">'
        "Dot = base scenario · line = conservative to optimistic · synthetic dataset, assumptions in docs/business_case.md</text>",
    ]
    for t in (0, 1, 2, 3):
        x = sx(t)
        out.append(f'<line x1="{x}" y1="{top}" x2="{x}" y2="{h - 50}" stroke="#e4e3df" stroke-width="1"/>')
        out.append(f'<text x="{x}" y="{h - 30}" font-size="12" fill="#52514e" text-anchor="middle">${t}</text>')
    for i, (label, key, color, suffix) in enumerate(actors):
        y = top + 50 + i * 80
        vals = [by[n + suffix][key] for n in ("conservative", "base", "optimistic")]
        lo, hi, base = min(vals), max(vals), by["base" + suffix][key]
        out.append(f'<text x="24" y="{y + 5}" font-size="14" fill="#0b0b0b">{label}</text>')
        out.append(f'<line x1="{sx(lo)}" y1="{y}" x2="{sx(hi)}" y2="{y}" stroke="{color}" stroke-width="2" stroke-linecap="round"/>')
        for v in (lo, hi):
            out.append(f'<line x1="{sx(v)}" y1="{y - 7}" x2="{sx(v)}" y2="{y + 7}" stroke="{color}" stroke-width="2"/>')
        out.append(f'<circle cx="{sx(base)}" cy="{y}" r="7" fill="{color}" stroke="#fcfcfb" stroke-width="2"/>')
        out.append(f'<text x="{sx(base)}" y="{y - 16}" font-size="13" font-weight="600" fill="#0b0b0b" text-anchor="middle">${base:.2f}</text>')
        if sx(hi) - sx(lo) < 40:  # range too narrow for two labels: one label beside it
            out.append(f'<text x="{sx(hi) + 14}" y="{y + 4}" font-size="11" fill="#52514e">${lo:.2f} to ${hi:.2f}</text>')
        else:
            out.append(f'<text x="{sx(lo)}" y="{y + 24}" font-size="11" fill="#52514e" text-anchor="middle">${lo:.2f}</text>')
            out.append(f'<text x="{sx(hi)}" y="{y + 24}" font-size="11" fill="#52514e" text-anchor="middle">${hi:.2f}</text>')
    out.append("</svg>")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--svg", help="write the cost-per-resolution chart to this path")
    args = parser.parse_args()
    built = [estimate(as_built(s)) for s in SCENARIOS]
    llm = [estimate(s) for s in SCENARIOS]
    print("As built (no language model in the loop):\n")
    print_table(built)
    print("\nWith an LLM-based agent (original AWS target design):\n")
    print_table(llm + [estimate(MITIGATED)])
    if args.svg:
        write_svg(built + llm, args.svg)


if __name__ == "__main__":
    main()
