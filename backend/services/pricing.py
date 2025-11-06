from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from math import exp

from core.config import settings


@dataclass(slots=True)
class MarketPricingInputs:
    baseline_probability: float = 0.5  # expressed as decimal
    yes_shares: float = 0.0
    no_shares: float = 0.0
    liquidity: float = 1.0
    boost: float = 0.0  # allows future feature toggles


def _logistic(value: float) -> float:
    return 1.0 / (1.0 + exp(-value))


def calculate_market_quote(inputs: MarketPricingInputs) -> dict[str, object]:
    """Convert market depth into tradable YES/NO prices."""
    liquidity = max(inputs.liquidity, 1.0)
    skew = (inputs.yes_shares - inputs.no_shares) / liquidity
    momentum = _logistic(skew * settings.pricing_sensitivity)
    blended_probability = (
        0.55 * inputs.baseline_probability + 0.4 * momentum + 0.05 * inputs.boost
    )
    yes_price = min(max(blended_probability * 100.0, settings.pricing_floor), settings.pricing_ceiling)
    no_price = 100.0 - yes_price
    implied_probability = round(yes_price / 100.0, 4)

    return {
        "yesPriceCents": round(yes_price, 2),
        "noPriceCents": round(no_price, 2),
        "impliedProbability": implied_probability,
        "lastCalculatedAt": datetime.now(timezone.utc),
    }
