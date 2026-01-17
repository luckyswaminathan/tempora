from __future__ import annotations

from datetime import datetime, timezone
from math import exp, log
from typing import Dict, List, Optional

from schemas.market import MarketQuote

USE_LS_LMSR = False


def _ls_lmsr_liquidity(quantities: List[float], alpha: float = 0.3) -> float:
    return alpha * sum(abs(q) for q in quantities)


def _lmsr_b(quantities: List[float], liquidity: Optional[float] = None) -> float:
    if liquidity is None or USE_LS_LMSR:
        liquidity = _ls_lmsr_liquidity(quantities)
    return max(liquidity, 1.0)


def _lmsr_softmax_sum(quantities: List[float], b: float) -> float:
    return sum(exp(q / b) for q in quantities)


def _lmsr_cost(quantities: List[float], liquidity: Optional[float] = None) -> float:
    b = _lmsr_b(quantities, liquidity)
    return b * log(_lmsr_softmax_sum(quantities, b))


def _lmsr_implied_probabilities(
    quantities_map: Dict[str, float], liquidity: Optional[float] = None
) -> Dict[str, float]:
    quantities = list(quantities_map.values())
    b = _lmsr_b(quantities, liquidity)
    norm = _lmsr_softmax_sum(quantities, b)
    return {s: exp(q / b) / norm for s, q in quantities_map.items()}


def _lmsr_price_cents(
    quantities_map: Dict[str, float],
    trade_map: Dict[str, float],
    liquidity: Optional[float] = None,
) -> int:
    quantities = list(quantities_map.values())
    base_cost = _lmsr_cost(quantities, liquidity)

    post_trade_quantities = [
        quantities_map[s] + trade_map.get(s, 0.0) for s in quantities_map
    ]
    post_trade_cost = _lmsr_cost(post_trade_quantities, liquidity)

    return round(100 * (post_trade_cost - base_cost))


def calculate_market_quotes(
    quantities_map: Dict[str, float], liquidity: Optional[float] = None
) -> List[MarketQuote]:
    probs = _lmsr_implied_probabilities(quantities_map, liquidity)

    quotes = []
    for security_id, quantity in quantities_map.items():
        quotes.append(
            MarketQuote.model_validate(
                {
                    "security_id": security_id,
                    "quantity_traded": quantity,
                    "buy_unit_price_cents": _lmsr_price_cents(
                        quantities_map, {security_id: 1}, liquidity
                    ),
                    "sell_unit_price_cents": _lmsr_price_cents(
                        quantities_map, {security_id: -1}, liquidity
                    ),
                    "implied_probability": probs[security_id],
                    "last_calculated_at": datetime.now(timezone.utc),
                }
            )
        )

    return quotes


def calculate_market_price_cents(
    quantities_map: Dict[str, float],
    trade_map: Dict[str, float],
    liquidity: Optional[float] = None,
) -> int:
    return _lmsr_price_cents(quantities_map, trade_map, liquidity)
