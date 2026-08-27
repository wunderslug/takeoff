import unittest

from plan_model import _apply_precedence, _category, _member_role, _scope_for


class PlanModelRegressionTests(unittest.TestCase):
    def test_ewp_and_conventional_floor_callouts_are_classified(self):
        self.assertEqual(_category('9 1/2" NI40X @ 16" O.C.'), 'ewp_callout')
        self.assertEqual(_category('2x10 FLOOR JOISTS @ 16" O.C.'), 'conventional_framing_callout')
        self.assertEqual(_scope_for('9 1/2" NI40X @ 16" O.C.', 'FIRST FLOOR FRAMING PLAN'), 'floor_system')
        self.assertEqual(_scope_for('2x10 FLOOR JOISTS @ 16" O.C.', 'BUILDING SECTION'), 'floor_system')
        self.assertEqual(_member_role('9 1/2" NI40X @ 16" O.C.', 'ewp_callout'), 'joist')
        self.assertEqual(_member_role('2x10 FLOOR JOISTS @ 16" O.C.', 'conventional_framing_callout'), 'joist')

    def test_ewp_precedence_keeps_both_sources_and_creates_review_note(self):
        model = {
            'items': [
                {
                    'id': 'ewp-1',
                    'category': 'ewp_callout',
                    'normalized': {'scope': 'floor_system', 'member_role': 'joist'},
                    'governing_status': 'source_supported',
                    'review_status': 'not_reviewed',
                    'conflict_ids': [],
                },
                {
                    'id': 'conv-1',
                    'category': 'conventional_framing_callout',
                    'normalized': {'scope': 'floor_system', 'member_role': 'joist'},
                    'governing_status': 'source_supported',
                    'review_status': 'not_reviewed',
                    'conflict_ids': [],
                },
            ],
            'conflicts': [],
        }

        _apply_precedence(model)

        self.assertEqual(len(model['items']), 2)
        self.assertEqual(len(model['conflicts']), 1)
        self.assertFalse(model['conflicts'][0]['blocking'])
        self.assertEqual(model['conflicts'][0]['member_role'], 'joist')
        self.assertEqual(model['items'][0]['governing_status'], 'governing_by_ewp_policy')
        self.assertEqual(model['items'][1]['governing_status'], 'superseded_by_ewp_for_takeoff')
        self.assertEqual(model['items'][1]['review_status'], 'review_note')
        self.assertEqual(model['items'][0]['conflict_ids'], model['items'][1]['conflict_ids'])

    def test_no_conflict_is_created_across_different_scopes(self):
        model = {
            'items': [
                {
                    'id': 'ewp-1',
                    'category': 'ewp_callout',
                    'normalized': {'scope': 'floor_system', 'member_role': 'joist'},
                    'governing_status': 'source_supported',
                    'review_status': 'not_reviewed',
                    'conflict_ids': [],
                },
                {
                    'id': 'deck-1',
                    'category': 'conventional_framing_callout',
                    'normalized': {'scope': 'deck_or_porch', 'member_role': 'joist'},
                    'governing_status': 'source_supported',
                    'review_status': 'not_reviewed',
                    'conflict_ids': [],
                },
            ],
            'conflicts': [],
        }

        _apply_precedence(model)
        self.assertEqual(model['conflicts'], [])

    def test_no_conflict_is_created_between_floor_joist_and_lvl_beam(self):
        model = {
            'items': [
                {
                    'id': 'ewp-beam',
                    'category': 'ewp_callout',
                    'normalized': {'scope': 'floor_system', 'member_role': 'beam'},
                    'governing_status': 'source_supported',
                    'review_status': 'not_reviewed',
                    'conflict_ids': [],
                },
                {
                    'id': 'conv-joist',
                    'category': 'conventional_framing_callout',
                    'normalized': {'scope': 'floor_system', 'member_role': 'joist'},
                    'governing_status': 'source_supported',
                    'review_status': 'not_reviewed',
                    'conflict_ids': [],
                },
            ],
            'conflicts': [],
        }

        _apply_precedence(model)
        self.assertEqual(model['conflicts'], [])
        self.assertEqual(model['items'][0]['governing_status'], 'source_supported')
        self.assertEqual(model['items'][1]['governing_status'], 'source_supported')


if __name__ == '__main__':
    unittest.main()
