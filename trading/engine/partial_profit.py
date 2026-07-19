class PartialProfitManager:
    def __init__(self):
        self.active_plans = {}

    def create_plan(self, trade_id, entry, sl, tp, trade_type, confidence=70):
        risk = abs(entry - sl)
        reward = abs(tp - entry)

        plan = {
            'trade_id': trade_id,
            'entry': entry,
            'sl': sl,
            'tp': tp,
            'type': trade_type,
            'remaining_lots': 1.0,
            'breakeven_set': False,
            'levels': [],
        }

        if confidence >= 85:
            levels = [
                {'r_multiple': 1.0, 'close_pct': 33, 'action': 'breakeven'},
                {'r_multiple': 2.0, 'close_pct': 33, 'action': 'trailing'},
                {'r_multiple': 3.0, 'close_pct': 34, 'action': 'trailing'},
            ]
        else:
            levels = [
                {'r_multiple': 1.0, 'close_pct': 50, 'action': 'breakeven'},
                {'r_multiple': 2.0, 'close_pct': 25, 'action': 'trailing'},
                {'r_multiple': 3.0, 'close_pct': 15, 'action': 'trailing'},
                {'r_multiple': 4.0, 'close_pct': 10, 'action': 'trailing'},
            ]

        for lvl in levels:
            if trade_type == 'buy':
                price_target = entry + risk * lvl['r_multiple']
            else:
                price_target = entry - risk * lvl['r_multiple']
            lvl['price_target'] = round(price_target, 5)
            lvl['triggered'] = False

        plan['levels'] = levels
        self.active_plans[trade_id] = plan
        return plan

    def check_price(self, trade_id, current_price):
        plan = self.active_plans.get(trade_id)
        if not plan:
            return {'action': 'none', 'reason': 'no_plan'}

        actions = []
        total_closed = 0
        trade_type = plan['type']

        for lvl in plan['levels']:
            if lvl['triggered']:
                continue

            triggered = False
            if trade_type == 'buy':
                if current_price >= lvl['price_target']:
                    triggered = True
            else:
                if current_price <= lvl['price_target']:
                    triggered = True

            if triggered:
                lvl['triggered'] = True
                close_amount = lvl['close_pct'] / 100.0 * plan['remaining_lots']
                total_closed += lvl['close_pct']
                plan['remaining_lots'] -= close_amount

                action = {
                    'level': lvl['r_multiple'],
                    'close_pct': lvl['close_pct'],
                    'action_type': lvl['action'],
                    'lots_to_close': round(close_amount, 2),
                }

                if lvl['action'] == 'breakeven' and not plan['breakeven_set']:
                    plan['breakeven_set'] = True
                    action['move_sl_to'] = plan['entry']
                    plan['sl'] = plan['entry']

                actions.append(action)

        if total_closed >= 100:
            actions.append({'action': 'close_all', 'reason': 'full_tp_hierarchy'})
            del self.active_plans[trade_id]
        elif total_closed > 0:
            plan['remaining_lots'] = max(0.01, 1.0 - total_closed / 100.0)

        return {
            'action': 'partial_close' if actions else 'hold',
            'actions': actions,
            'remaining_lots': plan.get('remaining_lots', 0),
            'breakeven_set': plan.get('breakeven_set', False),
        }

    def get_plan(self, trade_id):
        return self.active_plans.get(trade_id)

    def remove_plan(self, trade_id):
        return self.active_plans.pop(trade_id, None)

    def get_all_plans(self):
        return list(self.active_plans.keys())
